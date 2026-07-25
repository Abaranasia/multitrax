import { EffectDialog } from '../EffectDialog';
import { SettingsField } from '../SettingsField';

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
    <EffectDialog
      effect="fade-settings"
      title="⚙ Fade Durations"
      onApply={onApply}
      onCancel={onCancel}
    >
      <SettingsField
        kind="slider"
        effect="fade-settings"
        label="Fade In"
        min={0}
        max={10}
        step={0.5}
        value={draftFadeIn}
        onChange={setDraftFadeIn}
        format={(v) => `${fmt(v)}s`}
      />
      <SettingsField
        kind="slider"
        effect="fade-settings"
        label="Fade Out"
        min={0}
        max={10}
        step={0.5}
        value={draftFadeOut}
        onChange={setDraftFadeOut}
        format={(v) => `${fmt(v)}s`}
      />
      <SettingsField
        kind="slider"
        effect="fade-settings"
        label="Seek Fade"
        min={0}
        max={10}
        step={0.5}
        value={draftSeekFade}
        onChange={setDraftSeekFade}
        format={(v) => `${fmt(v)}s`}
      />
    </EffectDialog>
  );
};
