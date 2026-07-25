import { useCallback, useState } from 'react';
import { FilterType, TrackState } from '../../../../../domain/TrackState';
import { useAudio } from '../../../../../context/useAudio';

/** Owns the open/closed state and draft values for a track's Filter settings dialog. */
export const useFilterSettingsDialog = (state: TrackState) => {
  const { setFilterSettings } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const [draftType, setDraftType] = useState<FilterType>(state.filterType);
  const [draftCutoff, setDraftCutoff] = useState(state.filterCutoff);
  const [draftResonance, setDraftResonance] = useState(state.filterResonance);
  const [draftMix, setDraftMix] = useState(state.filterMix);
  const [draftOutput, setDraftOutput] = useState(state.filterOutput);

  const open = useCallback(() => {
    setDraftType(state.filterType);
    setDraftCutoff(state.filterCutoff);
    setDraftResonance(state.filterResonance);
    setDraftMix(state.filterMix);
    setDraftOutput(state.filterOutput);
    setIsOpen(true);
  }, [
    state.filterType,
    state.filterCutoff,
    state.filterResonance,
    state.filterMix,
    state.filterOutput,
  ]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    setFilterSettings(state.id, draftType, draftCutoff, draftResonance, draftMix, draftOutput);
    setIsOpen(false);
  }, [state.id, draftType, draftCutoff, draftResonance, draftMix, draftOutput, setFilterSettings]);

  return {
    isOpen,
    open,
    close,
    apply,
    draftType,
    setDraftType,
    draftCutoff,
    setDraftCutoff,
    draftResonance,
    setDraftResonance,
    draftMix,
    setDraftMix,
    draftOutput,
    setDraftOutput,
  };
};
