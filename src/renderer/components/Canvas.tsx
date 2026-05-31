import React, { useCallback, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import { TrackPlayer } from './TrackPlayer';
import { RecorderBar } from './RecorderBar';
import './Canvas.css';

export const Canvas: React.FC = () => {
  const { tracks, addTracks, tickCurrentTimes } = useAudio();

  // ── Interval for currentTime sync (100 ms is plenty for mm:ss + progress) ──
  useEffect(() => {
    const id = setInterval(tickCurrentTimes, 100);
    return () => clearInterval(id);
  }, [tickCurrentTimes]);

  // ── Drag-and-drop from OS ──────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      const files: { path: string; name: string; buffer: ArrayBuffer }[] = [];

      for (const file of Array.from(e.dataTransfer.files)) {
        if (!file.type.startsWith('audio/') && !isKnownAudio(file.name)) continue;

        // Electron exposes the real path via the `path` property
        const filePath = (file as File & { path?: string }).path ?? file.name;
        const arrayBuffer = await file.arrayBuffer();
        files.push({ path: filePath, name: file.name, buffer: arrayBuffer });
      }

      if (files.length > 0) await addTracks(files);
    },
    [addTracks],
  );

  // ── Open via dialog button ─────────────────────────────────────────────────
  const onOpenFiles = useCallback(async () => {
    if (!window.electronAPI) return;
    const paths = await window.electronAPI.openAudioFiles();
    if (!paths.length) return;

    const files: { path: string; name: string; buffer: ArrayBuffer }[] = [];
    for (const p of paths) {
      const buf = await window.electronAPI.readAudioFile(p);
      const name = p.split('/').pop() ?? p.split('\\').pop() ?? p;
      files.push({ path: p, name, buffer: buf });
    }

    await addTracks(files);
  }, [addTracks]);

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

const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm']);
function isKnownAudio(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTS.has(ext);
}
