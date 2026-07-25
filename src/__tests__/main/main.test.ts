/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi } from 'vitest';

// Mock electron before importing the module under test
vi.mock('electron', () => {
  const handlers: Record<string, Function> = {};

  const ipcMain = {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
  };

  const app = {
    isPackaged: true,
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
  };

  const BrowserWindow = vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    webContents: { openDevTools: vi.fn() },
  }));

  const dialog = {
    showOpenDialog: vi.fn().mockResolvedValue({ filePaths: ['foo.wav'] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/out.wav' }),
  };

  return { app, BrowserWindow, ipcMain, dialog, __ipcHandlers: handlers };
});

// Mock fs so we can inspect read/write without touching disk
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const writeFileSync = vi.fn();
  const readFileSync = vi.fn();
  return {
    ...actual,
    writeFileSync,
    readFileSync,
    default: { ...actual, writeFileSync, readFileSync },
  } as any;
});

describe('main IPC handlers', () => {
  it('dialog:openAudioFiles returns file paths from dialog', async () => {
    const electron = await import('electron');
    // import module after mock is set up so handlers are registered into __ipcHandlers
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const result = await handlers['dialog:openAudioFiles']();
    expect(result).toEqual(['foo.wav']);
    expect((electron as any).dialog.showOpenDialog).toHaveBeenCalled();
  });

  it('dialog:saveRecording writes file and returns saved result', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    const buffer = new ArrayBuffer(8);

    const res = await handlers['dialog:saveRecording'](null, buffer, 'rec.wav');

    expect((electron as any).dialog.showSaveDialog).toHaveBeenCalled();
    expect((fs as any).writeFileSync).toHaveBeenCalled();
    expect(res).toEqual({ saved: true, filePath: '/tmp/out.wav' });
  });

  it('fs:readAudioFile returns ArrayBuffer from fs.readFileSync', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;

    const data = Buffer.from([1, 2, 3]);
    (fs as any).readFileSync.mockReturnValue(data);

    const res = await handlers['fs:readAudioFile'](null, '/some/path');

    expect((fs as any).readFileSync).toHaveBeenCalled();
    expect(res).toEqual(data.buffer);
  });
});
