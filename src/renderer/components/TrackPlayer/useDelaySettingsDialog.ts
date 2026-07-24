import { useCallback, useState } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

/** Owns the open/closed state and draft values for a track's Delay settings dialog. */
export const useDelaySettingsDialog = (state: TrackState) => {
  const { setDelaySettings } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const [draftDelayTime, setDraftDelayTime] = useState(state.delayTime);
  const [draftDelayFeedback, setDraftDelayFeedback] = useState(state.delayFeedback);
  const [draftDelayMix, setDraftDelayMix] = useState(state.delayMix);
  const [draftDelayDamping, setDraftDelayDamping] = useState(state.delayDamping);
  const [draftDelayOutput, setDraftDelayOutput] = useState(state.delayOutput);

  const open = useCallback(() => {
    setDraftDelayTime(state.delayTime);
    setDraftDelayFeedback(state.delayFeedback);
    setDraftDelayMix(state.delayMix);
    setDraftDelayDamping(state.delayDamping);
    setDraftDelayOutput(state.delayOutput);
    setIsOpen(true);
  }, [
    state.delayTime,
    state.delayFeedback,
    state.delayMix,
    state.delayDamping,
    state.delayOutput,
  ]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setDelaySettings(
      state.id,
      draftDelayTime,
      draftDelayFeedback,
      draftDelayMix,
      draftDelayDamping,
      draftDelayOutput,
    );
    setIsOpen(false);
  }, [
    state.id,
    draftDelayTime,
    draftDelayFeedback,
    draftDelayMix,
    draftDelayDamping,
    draftDelayOutput,
    setDelaySettings,
  ]);

  return {
    isOpen,
    open,
    close,
    apply,
    draftDelayTime,
    setDraftDelayTime,
    draftDelayFeedback,
    setDraftDelayFeedback,
    draftDelayMix,
    setDraftDelayMix,
    draftDelayDamping,
    setDraftDelayDamping,
    draftDelayOutput,
    setDraftDelayOutput,
  };
};
