import { TrackState } from '../../../../domain/TrackState';

export const useEffectToggles = (
  state: TrackState,
  handlers: {
    onFilterOpen: () => void;
    onDistortionOpen: () => void;
    onDelayOpen: () => void;
    onReverbOpen: () => void;
  },
) => ({
  filterActive: state.filterMix > 0,
  distortionActive: state.distortionMix > 0,
  delayActive: state.delayMix > 0,
  reverbActive: state.reverbMix > 0,
  ...handlers,
});
