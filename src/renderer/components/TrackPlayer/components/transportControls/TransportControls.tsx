import { PlaybackButtons } from './PlaybackButtons';
import { TransportToggles } from './TransportToggles';

interface TransportControlsProps {
  playPauseIcon: string;
  playPauseTitle: string;
  isPlaying: boolean;
  onPlayPauseClick: () => void;
  onStopClick: () => void;
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

export const TransportControls = (props: TransportControlsProps) => {
  return (
    <div className="controls-row">
      <PlaybackButtons {...props} />
      <TransportToggles {...props} />
    </div>
  );
};
