interface EffectTogglesProps {
  filterActive: boolean;
  distortionActive: boolean;
  delayActive: boolean;
  reverbActive: boolean;
  onFilterOpen: () => void;
  onDistortionOpen: () => void;
  onDelayOpen: () => void;
  onReverbOpen: () => void;
}

export const EffectToggles = ({
  filterActive,
  distortionActive,
  delayActive,
  reverbActive,
  onFilterOpen,
  onDistortionOpen,
  onDelayOpen,
  onReverbOpen,
}: EffectTogglesProps) => {
  return (
    <div className="track-effects">
      {/* Filter settings */}
      <button
        className={`btn-filter${filterActive ? ' btn-filter--active' : ''}`}
        onClick={onFilterOpen}
        title="Filter settings"
        aria-pressed={filterActive}
      >
        F
      </button>

      {/* Distortion settings */}
      <button
        className={`btn-distortion${distortionActive ? ' btn-distortion--active' : ''}`}
        onClick={onDistortionOpen}
        title="Waveshape settings"
        aria-pressed={distortionActive}
      >
        W
      </button>

      {/* Delay settings */}
      <button
        className={`btn-delay${delayActive ? ' btn-delay--active' : ''}`}
        onClick={onDelayOpen}
        title="Delay settings"
        aria-pressed={delayActive}
      >
        D
      </button>

      {/* Reverb settings */}
      <button
        className={`btn-reverb${reverbActive ? ' btn-reverb--active' : ''}`}
        onClick={onReverbOpen}
        title="Reverb settings"
        aria-pressed={reverbActive}
      >
        R
      </button>
    </div>
  );
};
