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
  reverbRoom: ReverbRoom;
  reverbMix: number;        // 0–100 (%)
  reverbPreDelay: number;   // 0–500 (ms)
  reverbDamping: number;    // 0–100 (%)
  reverbOutput: number;     // 0–100 (%)
}

export type ReverbRoom = 'small-room' | 'hall' | 'plate' | 'cathedral';
