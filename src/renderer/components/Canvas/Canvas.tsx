import { useCanvas } from './useCanvas';
import { useSessionMenu } from '../SessionMenu/useSessionMenu';
import { SessionMenu } from '../SessionMenu/SessionMenu';

import './Canvas.css';
import { TrackPlayer } from '../TrackPlayer/TrackPlayer';
import { RecorderBar } from '../Recorder/RecorderBar';

export const Canvas = () => {
  const {
    tracks,
    onDragOver,
    onDrop,
    onOpenFiles,
    isOpeningFiles,
    stopAll,
    playAll,
    onSaveSession,
    onSaveNewSession,
    isSavingSession,
    onLoadSession,
    isLoadingSession,
    onNewSession,
  } = useCanvas();

  const { isOpen: isSessionMenuOpen, toggle: toggleSessionMenu, close: closeSessionMenu } =
    useSessionMenu();

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    void onDragOver(event);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    void onDrop(event);
  };

  const handleOpenFiles = () => {
    void onOpenFiles();
  };

  const handleSaveSession = () => {
    void onSaveSession();
  };

  const handleSaveNewSession = () => {
    void onSaveNewSession();
  };

  const handleLoadSession = () => {
    void onLoadSession();
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
        <TrackPlayer key={t.state.id} state={t.state} filePath={t.filePath} x={t.x} y={t.y} />
      ))}

      <SessionMenu
        isOpen={isSessionMenuOpen}
        onToggle={toggleSessionMenu}
        onClose={closeSessionMenu}
        onLoadSession={handleLoadSession}
        onSaveSession={handleSaveSession}
        onSaveNewSession={handleSaveNewSession}
        onNewSession={onNewSession}
        saveDisabled={isSavingSession || tracks.length === 0}
        loadDisabled={isLoadingSession}
      />

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

        <button
          className="btn-open"
          onClick={handleOpenFiles}
          title="Open audio files"
          disabled={isOpeningFiles}
        >
          + Open Files
        </button>
      </div>

      <RecorderBar />
    </div>
  );
};
