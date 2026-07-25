import { EffectDialog } from '../../EffectDialog';
import { SettingsField } from '../../SettingsField';

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
    <EffectDialog
      effect="distortion-settings"
      title="▲ Waveshape/Distortion"
      onApply={onApply}
      onCancel={onCancel}
    >
      <SettingsField
        kind="slider"
        effect="distortion-settings"
        label="Drive"
        min={0}
        max={100}
        step={1}
        value={draftDrive}
        onChange={setDraftDrive}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="distortion-settings"
        label="Tone"
        min={0}
        max={100}
        step={1}
        value={draftTone}
        onChange={setDraftTone}
        format={(v) => `${v}%`}
      />
      <SettingsField
        kind="slider"
        effect="distortion-settings"
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
        effect="distortion-settings"
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
