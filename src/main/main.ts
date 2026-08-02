import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Session-scoped allowlist of paths granted via the native open-file dialog.
// Replaced (not accumulated) on every `dialog:openAudioFiles` invocation.
const grantedPaths = new Set<string>();

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

  if (isDev) {
    void win.loadURL('http://localhost:5173').catch((error) => {
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
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'] }],
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
