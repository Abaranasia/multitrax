interface MuteSoloButtonsProps {
  muted: boolean;
  soloed: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
}

export const MuteSoloButtons = ({
  muted,
  soloed,
  onToggleMute,
  onToggleSolo,
}: MuteSoloButtonsProps) => {
  return (
    <div className="mixer-mute-solo">
      <button
        className={`btn-mute ${muted ? 'active' : ''}`}
        onClick={onToggleMute}
        title={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
      >
        M
      </button>
      <button
        className={`btn-solo ${soloed ? 'active' : ''}`}
        onClick={onToggleSolo}
        title={soloed ? 'Unsolo' : 'Solo'}
        aria-pressed={soloed}
      >
        S
      </button>
    </div>
  );
};
