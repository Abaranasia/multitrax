import { ReverbRoom } from '../../../../../domain/TrackState';
import { EffectDialog } from '../../EffectDialog';
import { SettingsField } from '../../SettingsField';

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
    <EffectDialog effect="reverb-settings" title="🎛️ Reverb" onApply={onApply} onCancel={onCancel}>
      <SettingsField
        kind="select"
        effect="reverb-settings"
        label="Room"
        value={draftReverbRoom}
        onChange={(value) => setDraftReverbRoom(value as ReverbRoom)}
        options={[
          { value: 'small-room', label: 'Small Room' },
          { value: 'hall', label: 'Hall' },
          { value: 'plate', label: 'Plate' },
          { value: 'cathedral', label: 'Cathedral' },
        ]}
      />
      <SettingsField
        kind="slider"
        effect="reverb-settings"
        label="Pre-delay"
        min={0}
        max={500}
        step={10}
        value={draftReverbPreDelay}
        onChange={setDraftReverbPreDelay}
        format={(v) => `${v}ms`}
      />
      <SettingsField
        kind="slider"
        effect="reverb-settings"
        label="Damping"
        min={0}
        max={100}
        step={1}
        value={draftReverbDamping}
        onChange={setDraftReverbDamping}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="reverb-settings"
        label="Output"
        min={0}
        max={100}
        step={1}
        value={draftReverbOutput}
        onChange={setDraftReverbOutput}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="reverb-settings"
        label="Mix"
        min={0}
        max={100}
        step={1}
        value={draftReverbMix}
        onChange={setDraftReverbMix}
        format={(v) => `${v}%`}
        mix
      />
    </EffectDialog>
  );
};
