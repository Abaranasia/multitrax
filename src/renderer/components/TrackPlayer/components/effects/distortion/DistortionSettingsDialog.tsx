import './DistortionSettingsDialog.css';

interface DistortionSettingsDialogProps {
  draftDrive: number;
  setDraftDrive: (value: number) => void;
  draftTone: number;
  setDraftTone: (value: number) => void;
  draftMix: number;
  setDraftMix: (value: number) => void;
  draftOutput: number;
  setDraftOutput: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const DistortionSettingsDialog = ({
  draftDrive,
  setDraftDrive,
  draftTone,
  setDraftTone,
  draftMix,
  setDraftMix,
  draftOutput,
  setDraftOutput,
  onApply,
  onCancel,
}: DistortionSettingsDialogProps) => {
  return (
    <div
      className="distortion-settings-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className="distortion-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="distortion-settings-title">▲ Waveshape/Distortion</div>

        <div className="distortion-settings-field">
          <span className="distortion-settings-label">Drive</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftDrive}
            onChange={(e) => setDraftDrive(Number(e.target.value))}
          />
          <span className="distortion-settings-value">{draftDrive}%</span>
        </div>

        <div className="distortion-settings-field">
          <span className="distortion-settings-label">Tone</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftTone}
            onChange={(e) => setDraftTone(Number(e.target.value))}
          />
          <span className="distortion-settings-value">{draftTone}%</span>
        </div>

        <div className="distortion-settings-field">
          <span className="distortion-settings-label">Output</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftOutput}
            onChange={(e) => setDraftOutput(Number(e.target.value))}
          />
          <span className="distortion-settings-value">{draftOutput}%</span>
        </div>

        <div className="distortion-settings-field">
          <span className="distortion-settings-label distortion-settings-label--mix">Mix</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftMix}
            onChange={(e) => setDraftMix(Number(e.target.value))}
          />
          <span className="distortion-settings-value distortion-settings-value--mix">
            {draftMix}%
          </span>
        </div>

        <div className="distortion-settings-actions">
          <button className="distortion-settings-apply" onClick={onApply}>
            Apply
          </button>
          <button className="distortion-settings-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
