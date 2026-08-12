import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';
import { useTrackContextMenu } from './components/contextMenu/useTrackContextMenu';

interface UseTrackPlayerProps {
  state: TrackState;
  filePath: string;
  x: number;
  y: number;
}

// How far each arrow-key press seeks, in seconds — a keyboard equivalent of
// the click-to-seek waveform, since the waveform shell has no visible ticks
// to align a keypress to.
const SEEK_STEP_S = 5;

/** POSIX (`/music/song.wav`) or Windows (`C:\music\song.wav`) absolute path. */
const isAbsolutePath = (filePath: string) =>
  filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath);

export const useTrackPlayer = ({ state, filePath, x, y }: UseTrackPlayerProps) => {
  const {
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPan,
    setLoop,
    setFadeIn,
    setFadeOut,
    setSeekFade,
    removeTrack,
    duplicateTrack,
    updatePosition,
  } = useAudio();

  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const {
    position: contextMenuPosition,
    open: openContextMenu,
    close: closeContextMenu,
  } = useTrackContextMenu();

  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY);
    },
    [openContextMenu],
  );

  const duplicate = useCallback(() => {
    duplicateTrack(state.id);
    closeContextMenu();
  }, [duplicateTrack, state.id, closeContextMenu]);

  // Revealing is a pure OS side effect with no track state to mutate, so it
  // goes straight to the preload bridge rather than through AudioContext —
  // same treatment as `saveRecording` in useRecorder.
  const canReveal = Boolean(window.electronAPI) && isAbsolutePath(filePath);

  const reveal = useCallback(() => {
    closeContextMenu();
    void window.electronAPI.revealFile(filePath).then((result) => {
      if (!result.revealed) console.error('Failed to reveal file', filePath, result.error);
    });
  }, [filePath, closeContextMenu]);

  const fmt = useCallback((v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1)), []);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.track-controls')) return;
      e.preventDefault();

      dragOffset.current = { x: e.clientX - x, y: e.clientY - y };

      const onMove = (ev: globalThis.MouseEvent) => {
        updatePosition(
          state.id,
          ev.clientX - dragOffset.current.x,
          ev.clientY - dragOffset.current.y,
        );
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [x, y, state.id, updatePosition],
  );

  const onProgressClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seek(state.id, ratio * state.duration);
    },
    [seek, state.duration, state.id],
  );

  const onProgressKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      if (e.key === 'ArrowLeft') next = Math.max(0, state.currentTime - SEEK_STEP_S);
      else if (e.key === 'ArrowRight') next = Math.min(state.duration, state.currentTime + SEEK_STEP_S);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = state.duration;

      if (next === null) return;
      e.preventDefault();
      seek(state.id, next);
    },
    [seek, state.id, state.currentTime, state.duration],
  );

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    cardRef,
    fmt,
    onMouseDown,
    onProgressClick,
    onProgressKeyDown,
    progress,
    play,
    pause,
    stop,
    setLoop,
    setFadeIn,
    setFadeOut,
    setSeekFade,
    removeTrack,
    setVolume,
    setPan,
    contextMenuPosition,
    onContextMenu,
    closeContextMenu,
    duplicate,
    reveal,
    canReveal,
  };
};
