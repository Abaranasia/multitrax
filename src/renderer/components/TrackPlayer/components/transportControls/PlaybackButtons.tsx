interface PlaybackButtonsProps {
  playPauseIcon: string;
  playPauseTitle: string;
  isPlaying: boolean;
  onPlayPauseClick: () => void;
  onStopClick: () => void;
}

export const PlaybackButtons = ({
  playPauseIcon,
  playPauseTitle,
  isPlaying,
  onPlayPauseClick,
  onStopClick,
}: PlaybackButtonsProps) => {
  return (
    <div className="playback-buttons">
      {/* Play / Pause */}
      <button
        className={`btn-playback ${isPlaying ? 'active' : ''}`}
        onClick={onPlayPauseClick}
        title={playPauseTitle}
      >
        {playPauseIcon}
      </button>

      {/* Stop */}
      <button className="btn-playback" onClick={onStopClick} title="Stop">
        ⏹
      </button>
    </div>
  );
};
