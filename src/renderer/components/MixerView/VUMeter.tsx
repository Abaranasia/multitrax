import type { CSSProperties } from 'react';

interface VUMeterProps {
  style: CSSProperties;
}

export const VUMeter = ({ style }: VUMeterProps) => (
  <div className="mixer-meter" title="Level">
    <i className="mixer-meter-fill" style={style} />
  </div>
);
