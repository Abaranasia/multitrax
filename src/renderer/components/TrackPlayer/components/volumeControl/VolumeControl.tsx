import type { ChangeEvent, CSSProperties } from 'react';

interface VolumeControlProps {
  volume: number;
  percentage: number;
  style: CSSProperties;
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const VolumeControl = ({
  volume,
  percentage,
  style,
  title,
  onChange,
  isMuted,
  onToggleMute,
}: VolumeControlProps) => {
  return (
    <div className="volume-control">
      <button
        type="button"
        className="volume-icon"
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={onChange}
        title={title}
        style={style}
      />
      <span className="volume-value">{percentage}%</span>
    </div>
  );
};
