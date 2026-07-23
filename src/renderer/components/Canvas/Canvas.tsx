import { useCanvas } from './useCanvas';

import './Canvas.css';
import { TrackPlayer } from '../TrackPlayer/TrackPlayer';
import { RecorderBar } from '../Recorder/RecorderBar';

export const Canvas = () => {
  const { tracks, onDragOver, onDrop, onOpenFiles, stopAll, playAll } = useCanvas();

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    void onDragOver(event);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    void onDrop(event);
  };

  const handleOpenFiles = () => {
    void onOpenFiles();
  };

  return (
    <div className="canvas" onDragOver={handleDragOver} onDrop={handleDrop}>
      {tracks.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">🎵</div>
          <p>Drop audio files here</p>
          <p className="canvas-empty-sub">or click the button below</p>
        </div>
      )}

      {tracks.map((t) => (
        <TrackPlayer key={t.state.id} state={t.state} x={t.x} y={t.y} />
      ))}

      <div className="controls-bar" role="group" aria-label="Playback controls">
        <button
          className="btn-play-all"
          onClick={playAll}
          title="Play all tracks"
          disabled={tracks.length === 0 || tracks.every((t) => t.state.playing)}
        >
          ▶ Play All
        </button>

        <button
          className="btn-stop-all"
          onClick={stopAll}
          title="Stop all tracks"
          disabled={!tracks.some((t) => t.state.playing)}
        >
          ⏹ Stop All
        </button>

        <button className="btn-open" onClick={handleOpenFiles} title="Open audio files">
          + Open Files
        </button>
      </div>

      <RecorderBar />
    </div>
  );
};
