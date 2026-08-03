import { FilterType, ReverbRoom } from './TrackState';

/**
 * Serialisable per-track snapshot persisted to a session file.
 *
 * Deliberately excludes `id` (regenerated on load via `crypto.randomUUID()`),
 * `duration`/`currentTime` (derived from the re-decoded audio buffer),
 * `playing` (sessions always load stopped), and `waveform` (recomputed from
 * the re-decoded audio buffer via `computeWaveformPeaks`) — those are runtime
 * or derived values, not settings worth persisting.
 */
export interface SessionTrackSnapshot {
  filePath: string;
  title: string;
  x: number;
  y: number;
  volume: number;
  pan: number;
  loop: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  seekFadeDuration: number;
  filterType: FilterType;
  filterCutoff: number;
  filterResonance: number;
  filterMix: number;
  filterOutput: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  delayDamping: number;
  delayOutput: number;
  reverbRoom: ReverbRoom;
  reverbMix: number;
  reverbPreDelay: number;
  reverbDamping: number;
  reverbOutput: number;
  distortionDrive: number;
  distortionTone: number;
  distortionMix: number;
  distortionOutput: number;
}

export interface SessionFile {
  version: 1;
  tracks: SessionTrackSnapshot[];
}
