import './FadeSettingsDialog.css';

const fmt = (v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1));

interface FadeSettingsDialogProps {
  draftFadeIn: number;
  setDraftFadeIn: (value: number) => void;
  draftFadeOut: number;
  setDraftFadeOut: (value: number) => void;
  draftSeekFade: number;
  setDraftSeekFade: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const FadeSettingsDialog = ({
  draftFadeIn,
  setDraftFadeIn,
  draftFadeOut,
  setDraftFadeOut,
  draftSeekFade,
  setDraftSeekFade,
  onApply,
  onCancel,
}: FadeSettingsDialogProps) => {
  return (
    <div
      className="fade-settings-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className="fade-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fade-settings-title">⚙ Fade Durations</div>

        <div className="fade-settings-field">
          <span className="fade-settings-label">Fade In</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={draftFadeIn}
            onChange={(e) => setDraftFadeIn(Number(e.target.value))}
          />
          <span className="fade-settings-value">{fmt(draftFadeIn)}s</span>
        </div>

        <div className="fade-settings-field">
          <span className="fade-settings-label">Fade Out</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={draftFadeOut}
            onChange={(e) => setDraftFadeOut(Number(e.target.value))}
          />
          <span className="fade-settings-value">{fmt(draftFadeOut)}s</span>
        </div>

        <div className="fade-settings-field">
          <span className="fade-settings-label">Seek Fade</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={draftSeekFade}
            onChange={(e) => setDraftSeekFade(Number(e.target.value))}
          />
          <span className="fade-settings-value">{fmt(draftSeekFade)}s</span>
        </div>

        <div className="fade-settings-actions">
          <button className="fade-settings-apply" onClick={onApply}>
            Apply
          </button>
          <button className="fade-settings-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
