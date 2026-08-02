import type { ChangeEvent, CSSProperties } from 'react';
import { TrackState } from '../../../../domain/TrackState';

export const usePanControl = (state: TrackState, setPan: (id: string, v: number) => void) => {
  const { pan } = state;
  return {
    pan,
    className: pan < 0 ? 'pan-input pan-input--left' : pan > 0 ? 'pan-input pan-input--right' : 'pan-input',
    style: { '--pan-fill': `${Math.round((pan + 1) * 50)}%` } as CSSProperties,
    title: `Pan: ${pan === 0 ? 'Center' : pan < 0 ? `${Math.round(-pan * 100)}% Left` : `${Math.round(pan * 100)}% Right`}`,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setPan(state.id, parseFloat(e.target.value)),
    onDoubleClick: () => setPan(state.id, 0),
  };
};
