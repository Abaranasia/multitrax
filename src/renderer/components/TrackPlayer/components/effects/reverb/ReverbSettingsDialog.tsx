import { ReverbRoom } from '../../../../../domain/TrackState';
import './ReverbSettingsDialog.css';

interface ReverbSettingsDialogProps {
  draftReverbRoom: ReverbRoom;
  setDraftReverbRoom: (value: ReverbRoom) => void;
  draftReverbMix: number;
  setDraftReverbMix: (value: number) => void;
  draftReverbPreDelay: number;
  setDraftReverbPreDelay: (value: number) => void;
  draftReverbDamping: number;
  setDraftReverbDamping: (value: number) => void;
  draftReverbOutput: number;
  setDraftReverbOutput: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export const ReverbSettingsDialog = ({
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
  onApply,
  onCancel,
}: ReverbSettingsDialogProps) => {
  return (
    <div
      className="reverb-settings-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className="reverb-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="reverb-settings-title">🎛️ Reverb</div>

        <div className="reverb-settings-field">
          <span className="reverb-settings-label">Room</span>
          <select
            className="reverb-settings-select"
            value={draftReverbRoom}
            onChange={(e) => setDraftReverbRoom(e.target.value as ReverbRoom)}
          >
            <option value="small-room">Small Room</option>
            <option value="hall">Hall</option>
            <option value="plate">Plate</option>
            <option value="cathedral">Cathedral</option>
          </select>
        </div>

        <div className="reverb-settings-field">
          <span className="reverb-settings-label">Pre-delay</span>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={draftReverbPreDelay}
            onChange={(e) => setDraftReverbPreDelay(Number(e.target.value))}
          />
          <span className="reverb-settings-value">{draftReverbPreDelay}ms</span>
        </div>

        <div className="reverb-settings-field">
          <span className="reverb-settings-label">Damping</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftReverbDamping}
            onChange={(e) => setDraftReverbDamping(Number(e.target.value))}
          />
          <span className="reverb-settings-value">{draftReverbDamping}%</span>
        </div>

        <div className="reverb-settings-field">
          <span className="reverb-settings-label">Output</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftReverbOutput}
            onChange={(e) => setDraftReverbOutput(Number(e.target.value))}
          />
          <span className="reverb-settings-value">{draftReverbOutput}%</span>
        </div>

        <div className="reverb-settings-field">
          <span className="reverb-settings-label reverb-settings-label--mix">Mix</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftReverbMix}
            onChange={(e) => setDraftReverbMix(Number(e.target.value))}
          />
          <span className="reverb-settings-value reverb-settings-value--mix">
            {draftReverbMix}%
          </span>
        </div>

        <div className="reverb-settings-actions">
          <button className="reverb-settings-apply" onClick={onApply}>
            Apply
          </button>
          <button className="reverb-settings-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
