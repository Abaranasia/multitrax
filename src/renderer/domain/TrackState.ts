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
  filterType: FilterType;
  filterCutoff: number;     // 20–20000 (Hz)
  filterResonance: number;  // 0.1–20 (Q)
  filterMix: number;        // 0–100 (%)
  filterOutput: number;     // 0–100 (%)
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
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export type ReverbRoom = 'small-room' | 'hall' | 'plate' | 'cathedral';
