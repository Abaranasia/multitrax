import './DelaySettingsDialog.css';

interface DelaySettingsDialogProps {
  draftDelayTime: number;
  setDraftDelayTime: (value: number) => void;
  draftDelayFeedback: number;
  setDraftDelayFeedback: (value: number) => void;
  draftDelayDamping: number;
  setDraftDelayDamping: (value: number) => void;
  draftDelayOutput: number;
  setDraftDelayOutput: (value: number) => void;
  draftDelayMix: number;
  setDraftDelayMix: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const DelaySettingsDialog = ({
  draftDelayTime,
  setDraftDelayTime,
  draftDelayFeedback,
  setDraftDelayFeedback,
  draftDelayDamping,
  setDraftDelayDamping,
  draftDelayOutput,
  setDraftDelayOutput,
  draftDelayMix,
  setDraftDelayMix,
  onApply,
  onCancel,
}: DelaySettingsDialogProps) => {
  return (
    <div
      className="delay-settings-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className="delay-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="delay-settings-title">·•● Delay</div>

        <div className="delay-settings-field">
          <span className="delay-settings-label">Time</span>
          <input
            type="range"
            min={1}
            max={2000}
            step={10}
            value={draftDelayTime}
            onChange={(e) => setDraftDelayTime(Number(e.target.value))}
          />
          <span className="delay-settings-value">{draftDelayTime}ms</span>
        </div>

        <div className="delay-settings-field">
          <span className="delay-settings-label">Feedback</span>
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={draftDelayFeedback}
            onChange={(e) => setDraftDelayFeedback(Number(e.target.value))}
          />
          <span className="delay-settings-value">{draftDelayFeedback}%</span>
        </div>

        <div className="delay-settings-field">
          <span className="delay-settings-label">Tone</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftDelayDamping}
            onChange={(e) => setDraftDelayDamping(Number(e.target.value))}
          />
          <span className="delay-settings-value">{draftDelayDamping}%</span>
        </div>

        <div className="delay-settings-field">
          <span className="delay-settings-label">Output</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftDelayOutput}
            onChange={(e) => setDraftDelayOutput(Number(e.target.value))}
          />
          <span className="delay-settings-value">{draftDelayOutput}%</span>
        </div>

        <div className="delay-settings-field">
          <span className="delay-settings-label delay-settings-label--mix">Mix</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftDelayMix}
            onChange={(e) => setDraftDelayMix(Number(e.target.value))}
          />
          <span className="delay-settings-value delay-settings-value--mix">{draftDelayMix}%</span>
        </div>

        <div className="delay-settings-actions">
          <button className="delay-settings-apply" onClick={onApply}>
            Apply
          </button>
          <button className="delay-settings-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
