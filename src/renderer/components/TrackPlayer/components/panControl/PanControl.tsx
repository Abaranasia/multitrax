import type { ChangeEvent, CSSProperties } from 'react';

interface PanControlProps {
  pan: number;
  className: string;
  style: CSSProperties;
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDoubleClick: () => void;
}

export const PanControl = ({
  pan,
  className,
  style,
  title,
  onChange,
  onDoubleClick,
}: PanControlProps) => {
  return (
    <div className="pan-control">
      <span className="pan-label">L</span>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={pan}
        onChange={onChange}
        onDoubleClick={onDoubleClick}
        title={title}
        className={className}
        style={style}
      />
      <span className="pan-label">R</span>
    </div>
  );
};
