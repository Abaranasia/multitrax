export interface ElectronAPI {
  openAudioFiles: () => Promise<string[]>;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  saveRecording: (
    buffer: ArrayBuffer,
    suggestedName: string,
  ) => Promise<{ saved: boolean; filePath?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
