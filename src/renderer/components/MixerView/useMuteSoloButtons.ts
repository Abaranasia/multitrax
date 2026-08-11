import { TrackState } from '../../domain/TrackState';

export const useMuteSoloButtons = (
  state: TrackState,
  setMuted: (id: string, muted: boolean) => void,
  setSoloed: (id: string, soloed: boolean) => void,
) => {
  const onToggleMute = () => setMuted(state.id, !state.muted);
  const onToggleSolo = () => setSoloed(state.id, !state.soloed);

  return {
    muted: state.muted,
    soloed: state.soloed,
    onToggleMute,
    onToggleSolo,
  };
};
