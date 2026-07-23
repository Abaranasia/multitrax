import { createContext } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { FilterType, ReverbRoom, TrackState } from '../domain/TrackState';

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
  setFilterSettings: (
    id: string,
    type: FilterType,
    cutoff: number,
    resonance: number,
    mix: number,
    output: number,
  ) => void;
  setDelaySettings: (
    id: string,
    delayTime: number,
    feedback: number,
    mix: number,
    damping: number,
    output: number,
  ) => void;
  setReverbSettings: (
    id: string,
    room: ReverbRoom,
    mix: number,
    preDelay: number,
    damping: number,
    output: number,
  ) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  tickCurrentTimes: () => void;
}

export const Ctx = createContext<AudioContextValue | null>(null);
