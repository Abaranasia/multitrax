import type { ChangeEvent } from 'react';

interface PanDialProps {
  pan: number;
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDoubleClick: () => void;
}

const DIAL_SWEEP_DEG = 45;

function panLabel(pan: number): string {
  if (pan === 0) return 'Center';
  const pct = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L${pct}` : `R${pct}`;
}

export const PanDial = ({ pan, title, onChange, onDoubleClick }: PanDialProps) => {
  return (
    <div className="mixer-pan">
      <span className="mixer-pan-label">{panLabel(pan)}</span>
      <div className="mixer-pan-dial-wrap">
        <div
          className="mixer-pan-dial"
          style={{ transform: `rotate(${pan * DIAL_SWEEP_DEG}deg)` }}
        />
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={pan}
          onChange={onChange}
          onDoubleClick={onDoubleClick}
          title={title}
          className="mixer-pan-dial-input"
        />
      </div>
    </div>
  );
};
