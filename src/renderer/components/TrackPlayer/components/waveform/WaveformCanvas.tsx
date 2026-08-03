import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

interface WaveformCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  progress: number;
  title: string;
  onProgressClick: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

export const WaveformCanvas = ({
  canvasRef,
  progress,
  title,
  onProgressClick,
}: WaveformCanvasProps) => {
  return (
    <div className="waveform-shell" onClick={onProgressClick} title="Seek">
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        role="img"
        aria-label={`Waveform preview for ${title}`}
        style={{ width: '100%', height: '100%' }}
      />
      <div className="waveform-progress" style={{ width: `${progress}%` }} />
    </div>
  );
};
