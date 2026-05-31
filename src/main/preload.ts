import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAudioFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:openAudioFiles'),

  readAudioFile: (filePath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('fs:readAudioFile', filePath),

  saveRecording: (
    buffer: ArrayBuffer,
    suggestedName: string,
  ): Promise<{ saved: boolean; filePath?: string }> =>
    ipcRenderer.invoke('dialog:saveRecording', buffer, suggestedName),
});
