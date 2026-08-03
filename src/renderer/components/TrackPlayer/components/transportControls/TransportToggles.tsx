interface TransportTogglesProps {
  loopOn: boolean;
  loopTitle: string;
  onLoopClick: () => void;
  fadeInOn: boolean;
  fadeInTitle: string;
  onFadeInClick: () => void;
  fadeOutOn: boolean;
  fadeOutTitle: string;
  onFadeOutClick: () => void;
  seekFadeOn: boolean;
  seekFadeTitle: string;
  onSeekFadeClick: () => void;
  onOpenFadeSettings: () => void;
}

export const TransportToggles = ({
  loopOn,
  loopTitle,
  onLoopClick,
  fadeInOn,
  fadeInTitle,
  onFadeInClick,
  fadeOutOn,
  fadeOutTitle,
  onFadeOutClick,
  seekFadeOn,
  seekFadeTitle,
  onSeekFadeClick,
  onOpenFadeSettings,
}: TransportTogglesProps) => {
  return (
    <div className="controls-group">
      {/* Loop toggle */}
      <button
        type="button"
        className={`loop-toggle toggle--loop${loopOn ? ' loop-on' : ''}`}
        title={loopTitle}
        onClick={onLoopClick}
      >
        <span className="loop-label">L</span>
      </button>

      {/* Fade In toggle */}
      <button
        type="button"
        className={`loop-toggle toggle--fade-in${fadeInOn ? ' loop-on' : ''}`}
        title={fadeInTitle}
        onClick={onFadeInClick}
      >
        <span className="loop-label">I</span>
      </button>

      {/* Fade Out toggle */}
      <button
        type="button"
        className={`loop-toggle toggle--fade-out${fadeOutOn ? ' loop-on' : ''}`}
        title={fadeOutTitle}
        onClick={onFadeOutClick}
      >
        <span className="loop-label">O</span>
      </button>

      {/* Seek Fade toggle */}
      <button
        type="button"
        className={`loop-toggle toggle--seek-fade${seekFadeOn ? ' loop-on' : ''}`}
        title={seekFadeTitle}
        onClick={onSeekFadeClick}
      >
        <span className="loop-label">S</span>
      </button>

      {/* Fade-duration settings */}
      <button className="btn-settings" onClick={onOpenFadeSettings} title="Configure fade durations">
        ⚙
      </button>
    </div>
  );
};
