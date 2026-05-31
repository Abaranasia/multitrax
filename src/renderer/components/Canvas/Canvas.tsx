import React from 'react';
import { useCanvas } from './useCanvas';

import './Canvas.css';
import { TrackPlayer } from '../TrackPlayer/TrackPlayer';
import { RecorderBar } from '../Recorder/RecorderBar';

export const Canvas = () => {
  const { tracks, onDragOver, onDrop, onOpenFiles } = useCanvas();

  return (
    <div className="canvas" onDragOver={onDragOver} onDrop={onDrop}>
      {tracks.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">🎵</div>
          <p>Drop audio files here</p>
          <p className="canvas-empty-sub">or click the button below</p>
        </div>
      )}

      {tracks.map(t => (
        <TrackPlayer key={t.state.id} state={t.state} x={t.x} y={t.y} />
      ))}

      <button className="btn-open" onClick={onOpenFiles} title="Open audio files">
        + Open Files
      </button>

      <RecorderBar />
    </div>
  );
};
