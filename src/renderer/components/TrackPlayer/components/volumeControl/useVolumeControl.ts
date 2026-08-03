import type { ChangeEvent, CSSProperties } from 'react';
import { TrackState } from '../../../../domain/TrackState';

export const useVolumeControl = (state: TrackState, setVolume: (id: string, v: number) => void) => {
  const percentage = Math.round(state.volume * 100);
  return {
    volume: state.volume,
    percentage,
    style: { '--volume-fill': `${percentage}%` } as CSSProperties,
    title: `Volume: ${percentage}%`,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setVolume(state.id, parseFloat(e.target.value)),
  };
};
