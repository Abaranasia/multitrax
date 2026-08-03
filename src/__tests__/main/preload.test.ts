/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi } from 'vitest';

// Mock electron methods used in preload
vi.mock('electron', () => {
  const exposeInMainWorld = vi.fn((name: string, api: any) => {
    // expose the API object so tests can call it
    (global as any).__EXPOSED_API = api;
  });

  const ipcRenderer = {
    invoke: vi.fn().mockResolvedValue('ok'),
  };

  const webUtils = {
    getPathForFile: vi.fn().mockReturnValue('/resolved/path.wav'),
  };

  return { contextBridge: { exposeInMainWorld }, ipcRenderer, webUtils };
});

describe('preload bridge', () => {
  it('exposes electronAPI with correct methods that call ipcRenderer.invoke', async () => {
    const electron = await import('electron');
    // import preload after mock
    await import('../../main/preload');

    const exposed = (global as any).__EXPOSED_API;
    expect(exposed).toBeTruthy();
    // call each method and assert ipcRenderer.invoke called with correct channels
    await exposed.openAudioFiles();
    expect((electron as any).ipcRenderer.invoke).toHaveBeenCalledWith('dialog:openAudioFiles');

    await exposed.readAudioFile('path/to/file');
    expect((electron as any).ipcRenderer.invoke).toHaveBeenCalledWith(
      'fs:readAudioFile',
      'path/to/file',
    );

    const buffer = new ArrayBuffer(4);
    await exposed.saveRecording(buffer, 'name.wav');
    expect((electron as any).ipcRenderer.invoke).toHaveBeenCalledWith(
      'dialog:saveRecording',
      buffer,
      'name.wav',
    );

    await exposed.revealFile('/music/song.wav');
    expect((electron as any).ipcRenderer.invoke).toHaveBeenCalledWith(
      'shell:revealFile',
      '/music/song.wav',
    );
  });

  it('resolves a dropped File to its on-disk path through webUtils', async () => {
    const electron = await import('electron');
    await import('../../main/preload');

    const exposed = (global as any).__EXPOSED_API;
    const file = { name: 'song.wav' } as unknown as File;

    expect(exposed.getPathForFile(file)).toBe('/resolved/path.wav');
    expect((electron as any).webUtils.getPathForFile).toHaveBeenCalledWith(file);
  });
});
