import { FilterType, ReverbRoom } from '../domain/TrackState';

/**
 * Named per-effect settings shapes shared by every layer that sets or reads
 * an effect's parameters end-to-end: `AudioEngine`, `AudioContextValue`
 * (`audioContextInstance.ts`), `AudioProvider` (`AudioContext.tsx`, both the
 * per-effect setter callbacks and `duplicateTrack`), the 4 wrapper dialog
 * hooks, and their tests.
 *
 * Using one named object shape (rather than positional parameters or a
 * positional function-type alias) closes the reorder type-safety gap
 * positional same-typed `number` params leave open: a field can only be
 * misrouted here via an explicit, visible `wrongName: value` mismatch, never
 * a silent argument-order swap.
 *
 * `output` is the single canonical name for what was previously a mix of
 * `outputLevel` (`AudioEngine.ts`) and `output` (`audioContextInstance.ts`,
 * `AudioContext.tsx`) — a pure rename, not a behavior or bounds change.
 */

export interface FilterSettings {
  type: FilterType;
  cutoff: number;
  resonance: number;
  mix: number;
  output: number;
}

export interface DelaySettings {
  delayTime: number;
  feedback: number;
  mix: number;
  damping: number;
  output: number;
}

export interface ReverbSettings {
  room: ReverbRoom;
  mix: number;
  preDelay: number;
  damping: number;
  output: number;
}

export interface DistortionSettings {
  drive: number;
  tone: number;
  mix: number;
  output: number;
}
