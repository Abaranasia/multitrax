import { useCallback } from 'react';
import { TrackState } from '../../../../domain/TrackState';
import { useAudio } from '../../../../context/useAudio';
import { useSettingsDialog } from '../useSettingsDialog';

interface FadeDraft {
  fadeIn: number;
  fadeOut: number;
  seekFade: number;
}

/** Owns the open/closed state and draft values for a track's Fade settings dialog. */
export const useFadeSettingsDialog = (state: TrackState) => {
  const { setFadeDurations } = useAudio();

  const seed = useCallback(
    (): FadeDraft => ({
      fadeIn: state.fadeInDuration,
      fadeOut: state.fadeOutDuration,
      seekFade: state.seekFadeDuration,
    }),
    [state.fadeInDuration, state.fadeOutDuration, state.seekFadeDuration],
  );

  const onApply = useCallback(
    (draft: FadeDraft) => setFadeDurations(state.id, draft.fadeIn, draft.fadeOut, draft.seekFade),
    [state.id, setFadeDurations],
  );

  const { isOpen, draft, setField, open, close, apply } = useSettingsDialog<FadeDraft>(
    seed,
    onApply,
  );

  return {
    isOpen,
    open,
    close,
    apply,
    draftFadeIn: draft.fadeIn,
    setDraftFadeIn: (value: number) => setField('fadeIn', value),
    draftFadeOut: draft.fadeOut,
    setDraftFadeOut: (value: number) => setField('fadeOut', value),
    draftSeekFade: draft.seekFade,
    setDraftSeekFade: (value: number) => setField('seekFade', value),
  };
};
