import { FilterType } from '../../../../../domain/TrackState';
import { EffectDialog } from '../../EffectDialog';
import { SettingsField } from '../../SettingsField';

import './FilterSettingsDialog.css';

interface FilterSettingsDialogProps {
  draftType: FilterType;
  setDraftType: (value: FilterType) => void;
  draftCutoff: number;
  setDraftCutoff: (value: number) => void;
  draftResonance: number;
  setDraftResonance: (value: number) => void;
  draftMix: number;
  setDraftMix: (value: number) => void;
  draftOutput: number;
  setDraftOutput: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const FilterSettingsDialog = ({
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
  onApply,
  onCancel,
}: FilterSettingsDialogProps) => {
  return (
    <EffectDialog effect="filter-settings" title="◢ Filter" onApply={onApply} onCancel={onCancel}>
      <SettingsField
        kind="select"
        effect="filter-settings"
        label="Type"
        value={draftType}
        onChange={(value) => setDraftType(value as FilterType)}
        options={[
          { value: 'lowpass', label: 'Lowpass' },
          { value: 'highpass', label: 'Highpass' },
          { value: 'bandpass', label: 'Bandpass' },
        ]}
      />
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Cutoff"
        min={20}
        max={20000}
        step={10}
        value={draftCutoff}
        onChange={setDraftCutoff}
        format={(v) => `${v}Hz`}
      />
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Resonance"
        min={0.1}
        max={20}
        step={0.1}
        value={draftResonance}
        onChange={setDraftResonance}
        format={(v) => v.toFixed(1)}
      />
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Output"
        min={0}
        max={100}
        step={1}
        value={draftOutput}
        onChange={setDraftOutput}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Mix"
        min={0}
        max={100}
        step={1}
        value={draftMix}
        onChange={setDraftMix}
        format={(v) => `${v}%`}
        mix
      />
    </EffectDialog>
  );
};
