import { EffectDialog } from '../../EffectDialog';
import { SettingsField } from '../../SettingsField';

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
    <EffectDialog effect="delay-settings" title="·•● Delay" onApply={onApply} onCancel={onCancel}>
      <SettingsField
        kind="slider"
        effect="delay-settings"
        label="Time"
        min={1}
        max={2000}
        step={10}
        value={draftDelayTime}
        onChange={setDraftDelayTime}
        format={(v) => `${v}ms`}
      />
      <SettingsField
        kind="slider"
        effect="delay-settings"
        label="Feedback"
        min={0}
        max={90}
        step={1}
        value={draftDelayFeedback}
        onChange={setDraftDelayFeedback}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="delay-settings"
        label="Tone"
        min={0}
        max={100}
        step={1}
        value={draftDelayDamping}
        onChange={setDraftDelayDamping}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="delay-settings"
        label="Output"
        min={0}
        max={100}
        step={1}
        value={draftDelayOutput}
        onChange={setDraftDelayOutput}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="delay-settings"
        label="Mix"
        min={0}
        max={100}
        step={1}
        value={draftDelayMix}
        onChange={setDraftDelayMix}
        format={(v) => `${v}%`}
        mix
      />
    </EffectDialog>
  );
};
