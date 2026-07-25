import { useCallback } from 'react';
import { ReverbRoom, TrackState } from '../../../../../domain/TrackState';
import { useAudio } from '../../../../../context/useAudio';
import { useSettingsDialog } from '../../useSettingsDialog';

interface ReverbDraft {
  room: ReverbRoom;
  mix: number;
  preDelay: number;
  damping: number;
  output: number;
}

/** Owns the open/closed state and draft values for a track's Reverb settings dialog. */
export const useReverbSettingsDialog = (state: TrackState) => {
  const { setReverbSettings } = useAudio();

  const seed = useCallback(
    (): ReverbDraft => ({
      room: state.reverbRoom,
      mix: state.reverbMix,
      preDelay: state.reverbPreDelay,
      damping: state.reverbDamping,
      output: state.reverbOutput,
    }),
    [
      state.reverbRoom,
      state.reverbMix,
      state.reverbPreDelay,
      state.reverbDamping,
      state.reverbOutput,
    ],
  );

  const onApply = useCallback(
    (draft: ReverbDraft) =>
      setReverbSettings(
        state.id,
        draft.room,
        draft.mix,
        draft.preDelay,
        draft.damping,
        draft.output,
      ),
    [state.id, setReverbSettings],
  );

  const { isOpen, draft, setField, open, close, apply } = useSettingsDialog<ReverbDraft>(
    seed,
    onApply,
  );

  return {
    isOpen,
    open,
    close,
    apply,
    draftReverbRoom: draft.room,
    setDraftReverbRoom: (value: ReverbRoom) => setField('room', value),
    draftReverbMix: draft.mix,
    setDraftReverbMix: (value: number) => setField('mix', value),
    draftReverbPreDelay: draft.preDelay,
    setDraftReverbPreDelay: (value: number) => setField('preDelay', value),
    draftReverbDamping: draft.damping,
    setDraftReverbDamping: (value: number) => setField('damping', value),
    draftReverbOutput: draft.output,
    setDraftReverbOutput: (value: number) => setField('output', value),
  };
};
