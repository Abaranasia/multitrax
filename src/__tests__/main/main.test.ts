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

  it('dialog:saveRecording returns { saved: false, error } when writeFileSync throws', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    const buffer = new ArrayBuffer(8);

    (fs as any).writeFileSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    const res = await handlers['dialog:saveRecording'](null, buffer, 'rec.wav');

    expect(res).toEqual({ saved: false, error: 'EACCES: permission denied' });
  });

  it('fs:readAudioFile rejects with Access denied for a path never granted by the dialog', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;

    await expect(handlers['fs:readAudioFile'](null, '/never/granted/path.wav')).rejects.toThrow(
      'Access denied',
    );
  });

  it('fs:readAudioFile returns ArrayBuffer from fs.readFileSync for a dialog-granted path', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const path = (await import('path')).default;
    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;

    // Seed the allowlist via the open-file dialog, as a real renderer flow would.
    await handlers['dialog:openAudioFiles']();

    const data = Buffer.from([1, 2, 3]);
    (fs as any).readFileSync.mockReturnValue(data);

    const res = await handlers['fs:readAudioFile'](null, path.resolve('foo.wav'));

    expect((fs as any).readFileSync).toHaveBeenCalled();
    expect(res).toEqual(data.buffer);
  });

  it('fs:readAudioFile rejects cleanly (no crash) when readFileSync throws for a granted path', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const path = (await import('path')).default;
    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;

    // Seed the allowlist via the open-file dialog again for this test's own grant.
    await handlers['dialog:openAudioFiles']();

    (fs as any).readFileSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await expect(handlers['fs:readAudioFile'](null, path.resolve('foo.wav'))).rejects.toThrow(
      'Failed to read audio file',
    );
  });

  it('a new dialog:openAudioFiles invocation replaces (not accumulates) the granted-path allowlist', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const path = (await import('path')).default;
    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showOpenDialog = (electron as any).dialog.showOpenDialog as ReturnType<typeof vi.fn>;

    const data = Buffer.from([9]);
    (fs as any).readFileSync.mockReturnValue(data);

    // First dialog invocation grants only /path/a.wav.
    showOpenDialog.mockResolvedValueOnce({ filePaths: ['/path/a.wav'] });
    await handlers['dialog:openAudioFiles']();
    await expect(
      handlers['fs:readAudioFile'](null, path.resolve('/path/a.wav')),
    ).resolves.toEqual(data.buffer);

    // Second dialog invocation grants a different path, /path/b.wav.
    showOpenDialog.mockResolvedValueOnce({ filePaths: ['/path/b.wav'] });
    await handlers['dialog:openAudioFiles']();

    // The first grant must be gone (REPLACE, not accumulate)...
    await expect(
      handlers['fs:readAudioFile'](null, path.resolve('/path/a.wav')),
    ).rejects.toThrow('Access denied');
    // ...while the new grant is active.
    await expect(
      handlers['fs:readAudioFile'](null, path.resolve('/path/b.wav')),
    ).resolves.toEqual(data.buffer);
  });
});
