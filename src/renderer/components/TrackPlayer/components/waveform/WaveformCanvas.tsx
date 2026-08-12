import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';

interface WaveformCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  progress: number;
  title: string;
  onProgressClick: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onProgressKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

export const WaveformCanvas = ({
  canvasRef,
  progress,
  title,
  onProgressClick,
  onProgressKeyDown,
}: WaveformCanvasProps) => {
  return (
    <div
      className="waveform-shell"
      onClick={onProgressClick}
      onKeyDown={onProgressKeyDown}
      title="Seek"
      role="slider"
      tabIndex={0}
      aria-label={`Seek ${title}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
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
