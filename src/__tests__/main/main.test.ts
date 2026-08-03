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

  const shell = {
    showItemInFolder: vi.fn(),
  };

  return { app, BrowserWindow, ipcMain, dialog, shell, __ipcHandlers: handlers };
});

// Mock fs so we can inspect read/write/stat without touching disk
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const writeFileSync = vi.fn();
  const readFileSync = vi.fn();
  const statSync = vi.fn(() => ({ isFile: () => true }));
  return {
    ...actual,
    writeFileSync,
    readFileSync,
    statSync,
    default: { ...actual, writeFileSync, readFileSync, statSync },
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

  it('shell:revealFile shows an existing file in the OS file manager', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    (fs as any).statSync.mockReturnValueOnce({ isFile: () => true });

    const res = await handlers['shell:revealFile'](null, '/music/song.wav');

    expect((electron as any).shell.showItemInFolder).toHaveBeenCalledWith('/music/song.wav');
    expect(res).toEqual({ revealed: true });
  });

  it('shell:revealFile refuses a relative path without touching the shell', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showItemInFolder = (electron as any).shell.showItemInFolder as ReturnType<typeof vi.fn>;
    showItemInFolder.mockClear();

    const res = await handlers['shell:revealFile'](null, 'song.wav');

    expect(showItemInFolder).not.toHaveBeenCalled();
    expect(res).toEqual({ revealed: false, error: 'Path is not absolute' });
  });

  it('shell:revealFile refuses a path that is not a file', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showItemInFolder = (electron as any).shell.showItemInFolder as ReturnType<typeof vi.fn>;
    showItemInFolder.mockClear();
    (fs as any).statSync.mockReturnValueOnce({ isFile: () => false });

    const res = await handlers['shell:revealFile'](null, '/music');

    expect(showItemInFolder).not.toHaveBeenCalled();
    expect(res).toEqual({ revealed: false, error: 'Path is not a file' });
  });

  it('shell:revealFile reports a clean error when the file no longer exists', async () => {
    const electron = await import('electron');
    const fs = await import('fs');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showItemInFolder = (electron as any).shell.showItemInFolder as ReturnType<typeof vi.fn>;
    showItemInFolder.mockClear();
    (fs as any).statSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const res = await handlers['shell:revealFile'](null, '/music/gone.wav');

    expect(showItemInFolder).not.toHaveBeenCalled();
    expect(res).toEqual({ revealed: false, error: 'ENOENT: no such file or directory' });
  });

  it('dialog:saveSession writes JSON and returns saved result', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    const json = '{"version":1,"tracks":[]}';

    const res = await handlers['dialog:saveSession'](null, json, 'session.json');

    expect((electron as any).dialog.showSaveDialog).toHaveBeenCalled();
    expect((fs as any).writeFileSync).toHaveBeenCalledWith('/tmp/out.wav', json, 'utf-8');
    expect(res).toEqual({ saved: true, filePath: '/tmp/out.wav' });
  });

  it('dialog:saveSession returns { saved: false } when the dialog is canceled', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showSaveDialog = (electron as any).dialog.showSaveDialog as ReturnType<typeof vi.fn>;
    showSaveDialog.mockResolvedValueOnce({ canceled: true });

    const res = await handlers['dialog:saveSession'](null, '{}', 'session.json');

    expect(res).toEqual({ saved: false });
  });

  it('dialog:saveSession returns { saved: false, error } when writeFileSync throws', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).writeFileSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    const res = await handlers['dialog:saveSession'](null, '{}', 'session.json');

    expect(res).toEqual({ saved: false, error: 'EACCES: permission denied' });
  });

  it('fs:writeSessionFile writes JSON to the given path and returns saved result', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    const json = '{"version":1,"tracks":[]}';

    const res = await handlers['fs:writeSessionFile'](null, '/tmp/session.json', json);

    expect((fs as any).writeFileSync).toHaveBeenCalledWith('/tmp/session.json', json, 'utf-8');
    expect(res).toEqual({ saved: true });
  });

  it('fs:writeSessionFile returns { saved: false, error } when writeFileSync throws', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).writeFileSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    const res = await handlers['fs:writeSessionFile'](null, '/tmp/session.json', '{}');

    expect(res).toEqual({ saved: false, error: 'EACCES: permission denied' });
  });

  it('dialog:openSession reads the selected file and returns its contents', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showOpenDialog = (electron as any).dialog.showOpenDialog as ReturnType<typeof vi.fn>;
    showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/session.json'] });
    const fs = await import('fs');
    (fs as any).readFileSync.mockReturnValue('{"version":1,"tracks":[]}');

    const res = await handlers['dialog:openSession']();

    expect((fs as any).readFileSync).toHaveBeenCalledWith('/tmp/session.json', 'utf-8');
    expect(res).toEqual({
      opened: true,
      data: '{"version":1,"tracks":[]}',
      filePath: '/tmp/session.json',
    });
  });

  it('dialog:openSession returns { opened: false } when the dialog is canceled', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showOpenDialog = (electron as any).dialog.showOpenDialog as ReturnType<typeof vi.fn>;
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });

    const res = await handlers['dialog:openSession']();

    expect(res).toEqual({ opened: false });
  });

  it('dialog:openSession returns { opened: false, error } when readFileSync throws', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const showOpenDialog = (electron as any).dialog.showOpenDialog as ReturnType<typeof vi.fn>;
    showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/session.json'] });
    const fs = await import('fs');
    (fs as any).readFileSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const res = await handlers['dialog:openSession']();

    expect(res).toEqual({ opened: false, error: 'ENOENT: no such file or directory' });
  });

  it('fs:readSessionAudioFile returns ArrayBuffer for an existing absolute file path', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).statSync.mockReturnValueOnce({ isFile: () => true });
    const data = Buffer.from([1, 2, 3]);
    (fs as any).readFileSync.mockReturnValue(data);

    const res = await handlers['fs:readSessionAudioFile'](null, '/music/song.wav');

    expect(res).toEqual({ ok: true, buffer: data.buffer });
  });

  it('fs:readSessionAudioFile resolves { ok: false } for a relative path', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;

    const res = await handlers['fs:readSessionAudioFile'](null, 'song.wav');

    expect(res).toEqual({ ok: false, error: 'Path is not absolute' });
  });

  it('fs:readSessionAudioFile resolves { ok: false } when the path is not a file', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).statSync.mockReturnValueOnce({ isFile: () => false });

    const res = await handlers['fs:readSessionAudioFile'](null, '/music');

    expect(res).toEqual({ ok: false, error: 'Path is not a file' });
  });

  it('fs:readSessionAudioFile resolves { ok: false } when the file no longer exists', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).statSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const res = await handlers['fs:readSessionAudioFile'](null, '/music/gone.wav');

    expect(res).toEqual({ ok: false, error: 'ENOENT: no such file or directory' });
  });

  it('fs:readSessionAudioFile resolves { ok: false } when readFileSync throws', async () => {
    const electron = await import('electron');
    await import('../../main/main');

    const handlers = (electron as any).__ipcHandlers as Record<string, Function>;
    const fs = await import('fs');
    (fs as any).statSync.mockReturnValueOnce({ isFile: () => true });
    (fs as any).readFileSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    const res = await handlers['fs:readSessionAudioFile'](null, '/music/song.wav');

    expect(res).toEqual({ ok: false, error: 'EACCES: permission denied' });
  });
});
