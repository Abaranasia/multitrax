import { useCallback } from 'react';
import { TrackState } from '../../../../../domain/TrackState';
import { useAudio } from '../../../../../context/useAudio';
import { useSettingsDialog } from '../../useSettingsDialog';

interface DistortionDraft {
  drive: number;
  tone: number;
  mix: number;
  output: number;
}

/** Owns the open/closed state and draft values for a track's Distortion settings dialog. */
export const useDistortionSettingsDialog = (state: TrackState) => {
  const { setDistortionSettings } = useAudio();

  const seed = useCallback(
    (): DistortionDraft => ({
      drive: state.distortionDrive,
      tone: state.distortionTone,
      mix: state.distortionMix,
      output: state.distortionOutput,
    }),
    [state.distortionDrive, state.distortionTone, state.distortionMix, state.distortionOutput],
  );

  const onApply = useCallback(
    (draft: DistortionDraft) => setDistortionSettings(state.id, draft),
    [state.id, setDistortionSettings],
  );

  const { isOpen, draft, setField, open, close, apply } = useSettingsDialog<DistortionDraft>(
    seed,
    onApply,
  );

  return {
    isOpen,
    open,
    close,
    apply,
    draftDrive: draft.drive,
    setDraftDrive: (value: number) => setField('drive', value),
    draftTone: draft.tone,
    setDraftTone: (value: number) => setField('tone', value),
    draftMix: draft.mix,
    setDraftMix: (value: number) => setField('mix', value),
    draftOutput: draft.output,
    setDraftOutput: (value: number) => setField('output', value),
  };
};
