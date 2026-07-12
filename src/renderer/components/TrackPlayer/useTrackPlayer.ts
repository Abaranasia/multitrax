import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { TrackState } from '../../domain/TrackState';
import { useAudio } from '../../context/AudioContext';
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
    setLoop,
    setFadeIn,
    setFadeOut,
    setSeekFade,
    setFadeDurations,
    setDelaySettings,
    setReverbSettings,
    removeTrack,
    duplicateTrack,
    updatePosition,
  } = useAudio();

  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { position: contextMenuPosition, open: openContextMenu, close: closeContextMenu } =
    useTrackContextMenu();

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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftFadeIn, setDraftFadeIn] = useState(state.fadeInDuration);
  const [draftFadeOut, setDraftFadeOut] = useState(state.fadeOutDuration);
  const [draftSeekFade, setDraftSeekFade] = useState(state.seekFadeDuration);

  const openSettings = useCallback(() => {
    setDraftFadeIn(state.fadeInDuration);
    setDraftFadeOut(state.fadeOutDuration);
    setDraftSeekFade(state.seekFadeDuration);
    setSettingsOpen(true);
  }, [state.fadeInDuration, state.fadeOutDuration, state.seekFadeDuration]);

  const applySettings = useCallback(() => {
    setFadeDurations(state.id, draftFadeIn, draftFadeOut, draftSeekFade);
    setSettingsOpen(false);
  }, [state.id, draftFadeIn, draftFadeOut, draftSeekFade, setFadeDurations]);

  // ── Delay settings ─────────────────────────────────────────────────────────
  const [delaySettingsOpen, setDelaySettingsOpen] = useState(false);
  const [draftDelayTime, setDraftDelayTime] = useState(state.delayTime);
  const [draftDelayFeedback, setDraftDelayFeedback] = useState(state.delayFeedback);
  const [draftDelayMix, setDraftDelayMix] = useState(state.delayMix);
  const [draftDelayDamping, setDraftDelayDamping] = useState(state.delayDamping);
  const [draftDelayOutput, setDraftDelayOutput] = useState(state.delayOutput);

  const openDelaySettings = useCallback(() => {
    setDraftDelayTime(state.delayTime);
    setDraftDelayFeedback(state.delayFeedback);
    setDraftDelayMix(state.delayMix);
    setDraftDelayDamping(state.delayDamping);
    setDraftDelayOutput(state.delayOutput);
    setDelaySettingsOpen(true);
  }, [state.delayTime, state.delayFeedback, state.delayMix, state.delayDamping, state.delayOutput]);

  const applyDelaySettings = useCallback(() => {
    setDelaySettings(
      state.id,
      draftDelayTime,
      draftDelayFeedback,
      draftDelayMix,
      draftDelayDamping,
      draftDelayOutput,
    );
    setDelaySettingsOpen(false);
  }, [
    state.id,
    draftDelayTime,
    draftDelayFeedback,
    draftDelayMix,
    draftDelayDamping,
    draftDelayOutput,
    setDelaySettings,
  ]);

  // ── Reverb settings ────────────────────────────────────────────────────────
  const [reverbSettingsOpen, setReverbSettingsOpen] = useState(false);
  const [draftReverbRoom, setDraftReverbRoom] = useState(state.reverbRoom);
  const [draftReverbMix, setDraftReverbMix] = useState(state.reverbMix);
  const [draftReverbPreDelay, setDraftReverbPreDelay] = useState(state.reverbPreDelay);
  const [draftReverbDamping, setDraftReverbDamping] = useState(state.reverbDamping);
  const [draftReverbOutput, setDraftReverbOutput] = useState(state.reverbOutput);

  const openReverbSettings = useCallback(() => {
    setDraftReverbRoom(state.reverbRoom);
    setDraftReverbMix(state.reverbMix);
    setDraftReverbPreDelay(state.reverbPreDelay);
    setDraftReverbDamping(state.reverbDamping);
    setDraftReverbOutput(state.reverbOutput);
    setReverbSettingsOpen(true);
  }, [state.reverbRoom, state.reverbMix, state.reverbPreDelay, state.reverbDamping, state.reverbOutput]);

  const applyReverbSettings = useCallback(() => {
    setReverbSettings(
      state.id,
      draftReverbRoom,
      draftReverbMix,
      draftReverbPreDelay,
      draftReverbDamping,
      draftReverbOutput,
    );
    setReverbSettingsOpen(false);
  }, [
    state.id,
    draftReverbRoom,
    draftReverbMix,
    draftReverbPreDelay,
    draftReverbDamping,
    draftReverbOutput,
    setReverbSettings,
  ]);

  const fmt = useCallback((v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1)), []);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.track-controls')) return;
      e.preventDefault();

      dragOffset.current = { x: e.clientX - x, y: e.clientY - y };

      const onMove = (ev: globalThis.MouseEvent) => {
        updatePosition(state.id, ev.clientX - dragOffset.current.x, ev.clientY - dragOffset.current.y);
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
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seek(state.id, ratio * state.duration);
    },
    [seek, state.duration, state.id],
  );

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    cardRef,
    settingsOpen,
    setSettingsOpen,
    draftFadeIn,
    setDraftFadeIn,
    draftFadeOut,
    setDraftFadeOut,
    draftSeekFade,
    setDraftSeekFade,
    openSettings,
    applySettings,
    delaySettingsOpen,
    setDelaySettingsOpen,
    draftDelayTime,
    setDraftDelayTime,
    draftDelayFeedback,
    setDraftDelayFeedback,
    draftDelayMix,
    setDraftDelayMix,
    draftDelayDamping,
    setDraftDelayDamping,
    draftDelayOutput,
    setDraftDelayOutput,
    openDelaySettings,
    applyDelaySettings,
    reverbSettingsOpen,
    setReverbSettingsOpen,
    draftReverbRoom,
    setDraftReverbRoom,
    draftReverbMix,
    setDraftReverbMix,
    draftReverbPreDelay,
    setDraftReverbPreDelay,
    draftReverbDamping,
    setDraftReverbDamping,
    draftReverbOutput,
    setDraftReverbOutput,
    openReverbSettings,
    applyReverbSettings,
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
    contextMenuPosition,
    onContextMenu,
    closeContextMenu,
    duplicate,
  };
};
