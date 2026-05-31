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
}
