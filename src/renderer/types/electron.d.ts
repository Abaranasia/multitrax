export interface ElectronAPI {
  openAudioFiles: () => Promise<string[]>;
  readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
  saveRecording: (
    buffer: ArrayBuffer,
    suggestedName: string,
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  revealFile: (filePath: string) => Promise<{ revealed: boolean; error?: string }>;
  saveSession: (
    json: string,
    suggestedName: string,
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  openSession: () => Promise<
    { opened: true; data: string; filePath: string } | { opened: false; error?: string }
  >;
  writeSessionFile: (filePath: string, json: string) => Promise<{ saved: boolean; error?: string }>;
  readSessionAudioFile: (filePath: string) => Promise<{
    ok: boolean;
    buffer?: ArrayBuffer;
    error?: string;
  }>;
  getPathForFile: (file: File) => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
