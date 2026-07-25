import { useCallback } from 'react';
import { TrackState } from '../../../../../domain/TrackState';
import { useAudio } from '../../../../../context/useAudio';
import { useSettingsDialog } from '../../useSettingsDialog';

interface DelayDraft {
  time: number;
  feedback: number;
  mix: number;
  damping: number;
  output: number;
}

/** Owns the open/closed state and draft values for a track's Delay settings dialog. */
export const useDelaySettingsDialog = (state: TrackState) => {
  const { setDelaySettings } = useAudio();

  const seed = useCallback(
    (): DelayDraft => ({
      time: state.delayTime,
      feedback: state.delayFeedback,
      mix: state.delayMix,
      damping: state.delayDamping,
      output: state.delayOutput,
    }),
    [state.delayTime, state.delayFeedback, state.delayMix, state.delayDamping, state.delayOutput],
  );

  const onApply = useCallback(
    (draft: DelayDraft) =>
      setDelaySettings(
        state.id,
        draft.time,
        draft.feedback,
        draft.mix,
        draft.damping,
        draft.output,
      ),
    [state.id, setDelaySettings],
  );

  const { isOpen, draft, setField, open, close, apply } = useSettingsDialog<DelayDraft>(
    seed,
    onApply,
  );

  return {
    isOpen,
    open,
    close,
    apply,
    draftDelayTime: draft.time,
    setDraftDelayTime: (value: number) => setField('time', value),
    draftDelayFeedback: draft.feedback,
    setDraftDelayFeedback: (value: number) => setField('feedback', value),
    draftDelayMix: draft.mix,
    setDraftDelayMix: (value: number) => setField('mix', value),
    draftDelayDamping: draft.damping,
    setDraftDelayDamping: (value: number) => setField('damping', value),
    draftDelayOutput: draft.output,
    setDraftDelayOutput: (value: number) => setField('output', value),
  };
};
