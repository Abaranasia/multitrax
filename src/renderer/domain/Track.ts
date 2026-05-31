import { TrackState } from './TrackState';

export interface Track {
  state: TrackState;
  audioBuffer: AudioBuffer;
}
