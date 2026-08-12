import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const DEV_SERVER_URL = 'http://localhost:5173';

// Session-scoped allowlist of paths granted via the native open-file dialog.
// Replaced (not accumulated) on every `dialog:openAudioFiles` invocation.
const grantedPaths = new Set<string>();

// Shared with `fs:readSessionAudioFile`'s extension gate below, so the two
// paths a file can enter the app through (the native picker's filter, and a
// loaded session's `filePath`) agree on what "an audio file" means.
const AUDIO_FILE_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm'];

// Only the app's own dev-server origin (dev) or its packaged renderer file
// (prod) may be top-level-navigated to; everything else is denied. Guards
// against a compromised/buggy renderer navigating the window to an
// arbitrary remote URL.
function isAllowedNavigationTarget(url: string): boolean {
  if (isDev) {
    try {
      return new URL(url).origin === DEV_SERVER_URL;
    } catch {
      return false;
    }
  }
  return url.startsWith('file://');
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Electron security checklist: this app never needs to open child windows
  // or navigate away from itself, so deny/block both outright.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationTarget(url)) event.preventDefault();
  });

  if (isDev) {
    void win.loadURL(DEV_SERVER_URL).catch((error) => {
      console.error('Failed to load dev server URL:', error);
    });
    win.webContents.openDevTools();
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html')).catch((error) => {
      console.error('Failed to load renderer:', error);
    });
  }
}

void app.whenReady()
  .then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    console.error('Failed to initialize app:', error);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: open file dialog for audio files
ipcMain.handle('dialog:openAudioFiles', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Audio Files',
    filters: [{ name: 'Audio', extensions: AUDIO_FILE_EXTENSIONS }],
    properties: ['openFile', 'multiSelections'],
  });
  grantedPaths.clear();
  for (const filePath of result.filePaths) {
    grantedPaths.add(path.resolve(filePath));
  }
  return result.filePaths;
});

// IPC: save a recording to disk via save dialog
ipcMain.handle(
  'dialog:saveRecording',
  async (_event, buffer: ArrayBuffer, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Recording',
      defaultPath: suggestedName,
      filters: [
        { name: 'WAV Audio', extensions: ['wav'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) return { saved: false };

    try {
      fs.writeFileSync(result.filePath, Buffer.from(buffer));
      return { saved: true, filePath: result.filePath };
    } catch (error) {
      return { saved: false, error: (error as Error).message };
    }
  },
);

// IPC: read audio file as ArrayBuffer (only for paths granted by the open-file dialog)
ipcMain.handle('fs:readAudioFile', (_event, filePath: string): Promise<ArrayBuffer> => {
  const resolved = path.resolve(filePath);
  if (!grantedPaths.has(resolved)) {
    return Promise.reject(new Error('Access denied: path not granted by file dialog'));
  }
  try {
    const data = fs.readFileSync(resolved);
    return Promise.resolve(data.buffer);
  } catch (error) {
    return Promise.reject(
      new Error(`Failed to read audio file: ${(error as Error).message}`, { cause: error }),
    );
  }
});

// IPC: save the current session (tracks + settings) as JSON via save dialog
ipcMain.handle(
  'dialog:saveSession',
  async (_event, json: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Session',
      defaultPath: suggestedName,
      filters: [{ name: 'Session', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) return { saved: false };

    try {
      fs.writeFileSync(result.filePath, json, 'utf-8');
      return { saved: true, filePath: result.filePath };
    } catch (error) {
      return { saved: false, error: (error as Error).message };
    }
  },
);

// IPC: quick-save the current session straight to a known path, no dialog
ipcMain.handle(
  'fs:writeSessionFile',
  (_event, filePath: string, json: string): { saved: boolean; error?: string } => {
    if (!path.isAbsolute(filePath)) return { saved: false, error: 'Path is not absolute' };

    try {
      fs.writeFileSync(filePath, json, 'utf-8');
      return { saved: true };
    } catch (error) {
      return { saved: false, error: (error as Error).message };
    }
  },
);

// IPC: open a session file via open dialog and return its raw JSON contents
ipcMain.handle('dialog:openSession', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Session',
    filters: [{ name: 'Session', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return { opened: false };

  const filePath = result.filePaths[0];
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return { opened: true, data, filePath };
  } catch (error) {
    return { opened: false, error: (error as Error).message };
  }
});

// IPC: read an audio file referenced by a loaded session, as an ArrayBuffer.
//
// Deliberately not gated on `grantedPaths` — session file paths come from a
// previously saved session, not the current open-file dialog grant, so the
// same absolute-path + exists-and-is-a-file gate as `shell:revealFile` is
// used instead, plus an extension check (a hand-edited/untrusted session
// file's `filePath` could otherwise point anywhere readable on disk).
// Resolves with a result object rather than rejecting, so a missing/moved
// file can be skipped per track instead of failing the whole session load.
ipcMain.handle(
  'fs:readSessionAudioFile',
  (_event, filePath: string): { ok: boolean; buffer?: ArrayBuffer; error?: string } => {
    if (!path.isAbsolute(filePath)) return { ok: false, error: 'Path is not absolute' };

    try {
      if (!fs.statSync(filePath).isFile()) return { ok: false, error: 'Path is not a file' };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }

    const extension = path.extname(filePath).toLowerCase().slice(1);
    if (!AUDIO_FILE_EXTENSIONS.includes(extension)) {
      return { ok: false, error: 'Path is not a recognized audio file' };
    }

    try {
      const data = fs.readFileSync(filePath);
      return { ok: true, buffer: data.buffer };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  },
);

// IPC: reveal a file in the OS file manager.
//
// Deliberately not gated on `grantedPaths`: that allowlist is replaced on every
// open-file dialog, so a track loaded in an earlier batch could no longer be
// revealed, and drag-and-drop paths never enter it at all. Revealing only opens
// the OS file manager — it never reads or executes the file — so an
// exists-and-is-a-file check is the proportionate gate here.
//
// Resolves with a result object rather than rejecting, matching
// `dialog:saveRecording`, so the renderer never faces an unhandled rejection.
ipcMain.handle(
  'shell:revealFile',
  (_event, filePath: string): { revealed: boolean; error?: string } => {
    if (!path.isAbsolute(filePath)) return { revealed: false, error: 'Path is not absolute' };

    try {
      if (!fs.statSync(filePath).isFile()) return { revealed: false, error: 'Path is not a file' };
    } catch (error) {
      return { revealed: false, error: (error as Error).message };
    }

    shell.showItemInFolder(filePath);
    return { revealed: true };
  },
);
