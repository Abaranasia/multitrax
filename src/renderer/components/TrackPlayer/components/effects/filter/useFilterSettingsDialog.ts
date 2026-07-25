import { useCallback } from 'react';
import { FilterType, TrackState } from '../../../../../domain/TrackState';
import { useAudio } from '../../../../../context/useAudio';
import { useSettingsDialog } from '../../useSettingsDialog';

interface FilterDraft {
  type: FilterType;
  cutoff: number;
  resonance: number;
  mix: number;
  output: number;
}

/** Owns the open/closed state and draft values for a track's Filter settings dialog. */
export const useFilterSettingsDialog = (state: TrackState) => {
  const { setFilterSettings } = useAudio();

  const seed = useCallback(
    (): FilterDraft => ({
      type: state.filterType,
      cutoff: state.filterCutoff,
      resonance: state.filterResonance,
      mix: state.filterMix,
      output: state.filterOutput,
    }),
    [
      state.filterType,
      state.filterCutoff,
      state.filterResonance,
      state.filterMix,
      state.filterOutput,
    ],
  );

  const onApply = useCallback(
    (draft: FilterDraft) => setFilterSettings(state.id, draft),
    [state.id, setFilterSettings],
  );

  const { isOpen, draft, setField, open, close, apply } = useSettingsDialog<FilterDraft>(
    seed,
    onApply,
  );

  return {
    isOpen,
    open,
    close,
    apply,
    draftType: draft.type,
    setDraftType: (value: FilterType) => setField('type', value),
    draftCutoff: draft.cutoff,
    setDraftCutoff: (value: number) => setField('cutoff', value),
    draftResonance: draft.resonance,
    setDraftResonance: (value: number) => setField('resonance', value),
    draftMix: draft.mix,
    setDraftMix: (value: number) => setField('mix', value),
    draftOutput: draft.output,
    setDraftOutput: (value: number) => setField('output', value),
  };
};
