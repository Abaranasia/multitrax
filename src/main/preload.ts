import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAudioFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openAudioFiles'),

  readAudioFile: (filePath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('fs:readAudioFile', filePath),

  saveRecording: (
    buffer: ArrayBuffer,
    suggestedName: string,
  ): Promise<{ saved: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('dialog:saveRecording', buffer, suggestedName),

  revealFile: (filePath: string): Promise<{ revealed: boolean; error?: string }> =>
    ipcRenderer.invoke('shell:revealFile', filePath),

  saveSession: (
    json: string,
    suggestedName: string,
  ): Promise<{ saved: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('dialog:saveSession', json, suggestedName),

  openSession: (): Promise<
    { opened: true; data: string; filePath: string } | { opened: false; error?: string }
  > => ipcRenderer.invoke('dialog:openSession'),

  writeSessionFile: (filePath: string, json: string): Promise<{ saved: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:writeSessionFile', filePath, json),

  readSessionAudioFile: (
    filePath: string,
  ): Promise<{ ok: boolean; buffer?: ArrayBuffer; error?: string }> =>
    ipcRenderer.invoke('fs:readSessionAudioFile', filePath),

  // Electron removed `File.path` in v32; `webUtils.getPathForFile` is the
  // replacement and is only reachable from the preload context.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
});
