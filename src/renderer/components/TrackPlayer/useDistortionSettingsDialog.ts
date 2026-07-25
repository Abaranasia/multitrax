import { useCallback, useState } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

/** Owns the open/closed state and draft values for a track's Distortion settings dialog. */
export const useDistortionSettingsDialog = (state: TrackState) => {
  const { setDistortionSettings } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const [draftDrive, setDraftDrive] = useState(state.distortionDrive);
  const [draftTone, setDraftTone] = useState(state.distortionTone);
  const [draftMix, setDraftMix] = useState(state.distortionMix);
  const [draftOutput, setDraftOutput] = useState(state.distortionOutput);

  const open = useCallback(() => {
    setDraftDrive(state.distortionDrive);
    setDraftTone(state.distortionTone);
    setDraftMix(state.distortionMix);
    setDraftOutput(state.distortionOutput);
    setIsOpen(true);
  }, [
    state.distortionDrive,
    state.distortionTone,
    state.distortionMix,
    state.distortionOutput,
  ]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setDistortionSettings(state.id, draftDrive, draftTone, draftMix, draftOutput);
    setIsOpen(false);
  }, [state.id, draftDrive, draftTone, draftMix, draftOutput, setDistortionSettings]);

  return {
    isOpen,
    open,
    close,
    apply,
    draftDrive,
    setDraftDrive,
    draftTone,
    setDraftTone,
    draftMix,
    setDraftMix,
    draftOutput,
    setDraftOutput,
  };
};
