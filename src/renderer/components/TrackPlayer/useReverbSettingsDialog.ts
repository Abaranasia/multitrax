import { useCallback, useState } from 'react';
import { ReverbRoom, TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

/** Owns the open/closed state and draft values for a track's Reverb settings dialog. */
export const useReverbSettingsDialog = (state: TrackState) => {
  const { setReverbSettings } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const [draftReverbRoom, setDraftReverbRoom] = useState<ReverbRoom>(state.reverbRoom);
  const [draftReverbMix, setDraftReverbMix] = useState(state.reverbMix);
  const [draftReverbPreDelay, setDraftReverbPreDelay] = useState(state.reverbPreDelay);
  const [draftReverbDamping, setDraftReverbDamping] = useState(state.reverbDamping);
  const [draftReverbOutput, setDraftReverbOutput] = useState(state.reverbOutput);

  const open = useCallback(() => {
    setDraftReverbRoom(state.reverbRoom);
    setDraftReverbMix(state.reverbMix);
    setDraftReverbPreDelay(state.reverbPreDelay);
    setDraftReverbDamping(state.reverbDamping);
    setDraftReverbOutput(state.reverbOutput);
    setIsOpen(true);
  }, [
    state.reverbRoom,
    state.reverbMix,
    state.reverbPreDelay,
    state.reverbDamping,
    state.reverbOutput,
  ]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setReverbSettings(
      state.id,
      draftReverbRoom,
      draftReverbMix,
      draftReverbPreDelay,
      draftReverbDamping,
      draftReverbOutput,
    );
    setIsOpen(false);
  }, [
    state.id,
    draftReverbRoom,
    draftReverbMix,
    draftReverbPreDelay,
    draftReverbDamping,
    draftReverbOutput,
    setReverbSettings,
  ]);

  return {
    isOpen,
    open,
    close,
    apply,
    draftReverbRoom,
    setDraftReverbRoom,
    draftReverbMix,
    setDraftReverbMix,
    draftReverbPreDelay,
    setDraftReverbPreDelay,
    draftReverbDamping,
    setDraftReverbDamping,
    draftReverbOutput,
    setDraftReverbOutput,
  };
};
