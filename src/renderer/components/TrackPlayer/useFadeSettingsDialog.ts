import { useCallback, useState } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

/** Owns the open/closed state and draft values for a track's Fade settings dialog. */
export const useFadeSettingsDialog = (state: TrackState) => {
  const { setFadeDurations } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const [draftFadeIn, setDraftFadeIn] = useState(state.fadeInDuration);
  const [draftFadeOut, setDraftFadeOut] = useState(state.fadeOutDuration);
  const [draftSeekFade, setDraftSeekFade] = useState(state.seekFadeDuration);

  const open = useCallback(() => {
    setDraftFadeIn(state.fadeInDuration);
    setDraftFadeOut(state.fadeOutDuration);
    setDraftSeekFade(state.seekFadeDuration);
    setIsOpen(true);
  }, [state.fadeInDuration, state.fadeOutDuration, state.seekFadeDuration]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setFadeDurations(state.id, draftFadeIn, draftFadeOut, draftSeekFade);
    setIsOpen(false);
  }, [state.id, draftFadeIn, draftFadeOut, draftSeekFade, setFadeDurations]);

  return {
    isOpen,
    open,
    close,
    apply,
    draftFadeIn,
    setDraftFadeIn,
    draftFadeOut,
    setDraftFadeOut,
    draftSeekFade,
    setDraftSeekFade,
  };
};
