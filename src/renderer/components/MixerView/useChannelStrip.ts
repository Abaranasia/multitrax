import {
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

// How far each arrow-key press seeks, in seconds — mirrors useTrackPlayer's
// own waveform-seek keyboard step.
const SEEK_STEP_S = 5;

export const useChannelStrip = (state: TrackState) => {
  const {
    engine,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setMuted,
    setSoloed,
    setPan,
    setLoop,
    setFadeIn,
    setFadeOut,
    setSeekFade,
  } = useAudio();

  const fmt = useCallback((v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1)), []);

  const onProgressClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seek(state.id, ratio * state.duration);
    },
    [seek, state.id, state.duration],
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
    engine,
    fmt,
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
    setVolume,
    setMuted,
    setSoloed,
    setPan,
  };
};
