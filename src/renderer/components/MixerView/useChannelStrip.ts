import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/useAudio';

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

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    engine,
    fmt,
    onProgressClick,
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
