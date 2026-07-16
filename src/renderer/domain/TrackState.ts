export interface TrackState {
  id: string;
  title: string;
  duration: number;         // seconds
  currentTime: number;      // seconds
  volume: number;           // 0–1
  loop: boolean;
  playing: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
  fadeInDuration: number;   // seconds (0–10)
  fadeOutDuration: number;  // seconds (0–10)
  seekFadeDuration: number; // seconds (0–10)
  delayTime: number;        // 1–2000 (ms)
  delayFeedback: number;    // 0–90 (%)
  delayMix: number;         // 0–100 (%)
  delayDamping: number;     // 0–100 (%)
  delayOutput: number;      // 0–100 (%)
  reverbRoom: ReverbRoom;
  reverbMix: number;        // 0–100 (%)
  reverbPreDelay: number;   // 0–500 (ms)
  reverbDamping: number;    // 0–100 (%)
  reverbOutput: number;     // 0–100 (%)
  waveform?: number[];
}

export type ReverbRoom = 'small-room' | 'hall' | 'plate' | 'cathedral';
