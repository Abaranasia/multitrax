import type { ChangeEvent, CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { TrackState } from '../../../../domain/TrackState';

export const useVolumeControl = (state: TrackState, setVolume: (id: string, v: number) => void) => {
  const percentage = Math.round(state.volume * 100);
  const isMuted = state.volume === 0;

  // Remembers the last non-zero volume so unmuting can restore it, without
  // adding a `muted` field to TrackState — muted is just volume === 0.
  const lastVolumeRef = useRef(state.volume > 0 ? state.volume : 1);
  useEffect(() => {
    if (state.volume > 0) lastVolumeRef.current = state.volume;
  }, [state.volume]);

  return {
    volume: state.volume,
    percentage,
    style: { '--volume-fill': `${percentage}%` } as CSSProperties,
    title: `Volume: ${percentage}%`,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setVolume(state.id, parseFloat(e.target.value)),
    isMuted,
    onToggleMute: () => setVolume(state.id, isMuted ? lastVolumeRef.current : 0),
  };
};
