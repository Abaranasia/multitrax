import { app, BrowserWindow, ipcMain, dialog } from 'electron';
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
