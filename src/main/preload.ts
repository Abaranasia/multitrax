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

  // Electron removed `File.path` in v32; `webUtils.getPathForFile` is the
  // replacement and is only reachable from the preload context.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
});
