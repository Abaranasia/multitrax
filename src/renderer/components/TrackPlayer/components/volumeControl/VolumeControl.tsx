import type { ChangeEvent, CSSProperties } from 'react';

interface VolumeControlProps {
  volume: number;
  percentage: number;
  style: CSSProperties;
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const VolumeControl = ({ volume, percentage, style, title, onChange }: VolumeControlProps) => {
  return (
    <div className="volume-control">
      <span className="volume-icon">🔊</span>
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
