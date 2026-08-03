import { createContext } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { TrackState } from '../domain/TrackState';
import { SessionTrackSnapshot } from '../domain/SessionFile';
import {
  FilterSettings,
  DistortionSettings,
  DelaySettings,
  ReverbSettings,
} from '../audio/effectSettings';

export interface TrackEntry {
  state: TrackState;
  filePath: string;
  // position of the draggable card on the canvas
  x: number;
  y: number;
}

export interface AudioContextValue {
  engine: AudioEngine;
  tracks: TrackEntry[];
  addTracks: (files: { path: string; name: string; buffer: ArrayBuffer }[]) => Promise<void>;
  duplicateTrack: (id: string) => void;
  removeTrack: (id: string) => void;
  play: (id: string) => void;
  pause: (id: string) => void;
  stop: (id: string) => void;
  stopAll: () => void;
  playAll: () => void;
  seek: (id: string, seconds: number) => void;
  setVolume: (id: string, value: number) => void;
  setPan: (id: string, value: number) => void;
  setLoop: (id: string, loop: boolean) => void;
  setFadeIn: (id: string, enabled: boolean) => void;
  setFadeOut: (id: string, enabled: boolean) => void;
  setSeekFade: (id: string, enabled: boolean) => void;
  setFadeDurations: (id: string, fadeIn: number, fadeOut: number, seekFade: number) => void;
  setFilterSettings: (id: string, s: FilterSettings) => void;
  setDelaySettings: (id: string, s: DelaySettings) => void;
  setReverbSettings: (id: string, s: ReverbSettings) => void;
  setDistortionSettings: (id: string, s: DistortionSettings) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  tickCurrentTimes: () => void;
  loadSession: (snapshots: SessionTrackSnapshot[]) => Promise<{ loaded: number; missing: string[] }>;
}

export const Ctx = createContext<AudioContextValue | null>(null);
