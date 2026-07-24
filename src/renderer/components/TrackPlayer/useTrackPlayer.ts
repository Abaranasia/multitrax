import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';
import { useTrackContextMenu } from './useTrackContextMenu';

interface UseTrackPlayerProps {
  state: TrackState;
  x: number;
  y: number;
}

export const useTrackPlayer = ({ state, x, y }: UseTrackPlayerProps) => {
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

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    cardRef,
    fmt,
    onMouseDown,
    onProgressClick,
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
  };
};
