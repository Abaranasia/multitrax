export interface ElectronAPI {
  openAudioFiles: () => Promise<string[]>;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  saveRecording: (
    buffer: ArrayBuffer,
    suggestedName: string,
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  revealFile: (filePath: string) => Promise<{ revealed: boolean; error?: string }>;
  getPathForFile: (file: File) => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
