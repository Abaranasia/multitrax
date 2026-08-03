import { FilterSettingsDialog } from './effects/filter/FilterSettingsDialog';
import { useFilterSettingsDialog } from './effects/filter/useFilterSettingsDialog';
import { DistortionSettingsDialog } from './effects/distortion/DistortionSettingsDialog';
import { useDistortionSettingsDialog } from './effects/distortion/useDistortionSettingsDialog';
import { FadeSettingsDialog } from './fadeSettings/FadeSettingsDialog';
import { useFadeSettingsDialog } from './fadeSettings/useFadeSettingsDialog';
import { DelaySettingsDialog } from './effects/delay/DelaySettingsDialog';
import { useDelaySettingsDialog } from './effects/delay/useDelaySettingsDialog';
import { ReverbSettingsDialog } from './effects/reverb/ReverbSettingsDialog';
import { useReverbSettingsDialog } from './effects/reverb/useReverbSettingsDialog';

export interface EffectDialogsProps {
  filterDialog: ReturnType<typeof useFilterSettingsDialog>;
  distortionDialog: ReturnType<typeof useDistortionSettingsDialog>;
  fadeDialog: ReturnType<typeof useFadeSettingsDialog>;
  delayDialog: ReturnType<typeof useDelaySettingsDialog>;
  reverbDialog: ReturnType<typeof useReverbSettingsDialog>;
}

export const EffectDialogs = ({
  filterDialog,
  distortionDialog,
  fadeDialog,
  delayDialog,
  reverbDialog,
}: EffectDialogsProps) => {
  return (
    <>
      {/* ── Filter settings overlay ──────────────────────────────────────── */}
      {filterDialog.isOpen && (
        <FilterSettingsDialog
          draftType={filterDialog.draftType}
          setDraftType={filterDialog.setDraftType}
          draftCutoff={filterDialog.draftCutoff}
          setDraftCutoff={filterDialog.setDraftCutoff}
          draftResonance={filterDialog.draftResonance}
          setDraftResonance={filterDialog.setDraftResonance}
          draftMix={filterDialog.draftMix}
          setDraftMix={filterDialog.setDraftMix}
          draftOutput={filterDialog.draftOutput}
          setDraftOutput={filterDialog.setDraftOutput}
          onApply={filterDialog.apply}
          onCancel={filterDialog.close}
        />
      )}

      {/* ── Distortion settings overlay ──────────────────────────────────── */}
      {distortionDialog.isOpen && (
        <DistortionSettingsDialog
          draftDrive={distortionDialog.draftDrive}
          setDraftDrive={distortionDialog.setDraftDrive}
          draftTone={distortionDialog.draftTone}
          setDraftTone={distortionDialog.setDraftTone}
          draftMix={distortionDialog.draftMix}
          setDraftMix={distortionDialog.setDraftMix}
          draftOutput={distortionDialog.draftOutput}
          setDraftOutput={distortionDialog.setDraftOutput}
          onApply={distortionDialog.apply}
          onCancel={distortionDialog.close}
        />
      )}

      {/* ── Fade settings overlay ──────────────────────────────────────────── */}
      {fadeDialog.isOpen && (
        <FadeSettingsDialog
          draftFadeIn={fadeDialog.draftFadeIn}
          setDraftFadeIn={fadeDialog.setDraftFadeIn}
          draftFadeOut={fadeDialog.draftFadeOut}
          setDraftFadeOut={fadeDialog.setDraftFadeOut}
          draftSeekFade={fadeDialog.draftSeekFade}
          setDraftSeekFade={fadeDialog.setDraftSeekFade}
          onApply={fadeDialog.apply}
          onCancel={fadeDialog.close}
        />
      )}

      {/* ── Delay settings overlay ───────────────────────────────────────── */}
      {delayDialog.isOpen && (
        <DelaySettingsDialog
          draftDelayTime={delayDialog.draftDelayTime}
          setDraftDelayTime={delayDialog.setDraftDelayTime}
          draftDelayFeedback={delayDialog.draftDelayFeedback}
          setDraftDelayFeedback={delayDialog.setDraftDelayFeedback}
          draftDelayDamping={delayDialog.draftDelayDamping}
          setDraftDelayDamping={delayDialog.setDraftDelayDamping}
          draftDelayOutput={delayDialog.draftDelayOutput}
          setDraftDelayOutput={delayDialog.setDraftDelayOutput}
          draftDelayMix={delayDialog.draftDelayMix}
          setDraftDelayMix={delayDialog.setDraftDelayMix}
          onApply={delayDialog.apply}
          onCancel={delayDialog.close}
        />
      )}

      {/* ── Reverb settings overlay ──────────────────────────────────────── */}
      {reverbDialog.isOpen && (
        <ReverbSettingsDialog
          draftReverbRoom={reverbDialog.draftReverbRoom}
          setDraftReverbRoom={reverbDialog.setDraftReverbRoom}
          draftReverbMix={reverbDialog.draftReverbMix}
          setDraftReverbMix={reverbDialog.setDraftReverbMix}
          draftReverbPreDelay={reverbDialog.draftReverbPreDelay}
          setDraftReverbPreDelay={reverbDialog.setDraftReverbPreDelay}
          draftReverbDamping={reverbDialog.draftReverbDamping}
          setDraftReverbDamping={reverbDialog.setDraftReverbDamping}
          draftReverbOutput={reverbDialog.draftReverbOutput}
          setDraftReverbOutput={reverbDialog.setDraftReverbOutput}
          onApply={reverbDialog.apply}
          onCancel={reverbDialog.close}
        />
      )}
    </>
  );
};
