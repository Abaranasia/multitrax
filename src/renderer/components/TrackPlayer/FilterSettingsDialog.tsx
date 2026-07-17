import { FilterType } from '../../domain/TrackState';

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
    <div
      className="filter-settings-overlay"
      onMouseDown={e => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className="filter-settings-panel" onClick={e => e.stopPropagation()}>
        <div className="filter-settings-title">◢ Filter</div>

        <div className="filter-settings-field">
          <span className="filter-settings-label">Type</span>
          <select
            className="filter-settings-select"
            value={draftType}
            onChange={e => setDraftType(e.target.value as FilterType)}
          >
            <option value="lowpass">Lowpass</option>
            <option value="highpass">Highpass</option>
            <option value="bandpass">Bandpass</option>
          </select>
        </div>

        <div className="filter-settings-field">
          <span className="filter-settings-label">Cutoff</span>
          <input
            type="range" min={20} max={20000} step={10}
            value={draftCutoff}
            onChange={e => setDraftCutoff(Number(e.target.value))}
          />
          <span className="filter-settings-value">{draftCutoff}Hz</span>
        </div>

        <div className="filter-settings-field">
          <span className="filter-settings-label">Resonance</span>
          <input
            type="range" min={0.1} max={20} step={0.1}
            value={draftResonance}
            onChange={e => setDraftResonance(Number(e.target.value))}
          />
          <span className="filter-settings-value">{draftResonance.toFixed(1)}</span>
        </div>

        <div className="filter-settings-field">
          <span className="filter-settings-label">Output</span>
          <input
            type="range" min={0} max={100} step={1}
            value={draftOutput}
            onChange={e => setDraftOutput(Number(e.target.value))}
          />
          <span className="filter-settings-value">{draftOutput}%</span>
        </div>

        <div className="filter-settings-field">
          <span className="filter-settings-label filter-settings-label--mix">Mix</span>
          <input
            type="range" min={0} max={100} step={1}
            value={draftMix}
            onChange={e => setDraftMix(Number(e.target.value))}
          />
          <span className="filter-settings-value filter-settings-value--mix">{draftMix}%</span>
        </div>

        <div className="filter-settings-actions">
          <button className="filter-settings-apply" onClick={onApply}>Apply</button>
          <button className="filter-settings-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
