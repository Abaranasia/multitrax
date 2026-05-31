import React, { useRef, useCallback, useState } from 'react';
import { TrackState } from '../domain/TrackState';
import { useAudio } from '../context/AudioContext';
import { formatTime } from '../utils/formatTime';
import './TrackPlayer.css';

interface Props {
  state: TrackState;
  x: number;
  y: number;
}

export const TrackPlayer: React.FC<Props> = ({ state, x, y }) => {
  const { play, pause, stop, seek, setVolume, setLoop, setFadeIn, setFadeOut, setSeekFade, setFadeDurations, removeTrack, updatePosition } = useAudio();
  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ── Fade-duration settings dialog ─────────────────────────────────────────
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [draftFadeIn, setDraftFadeIn]       = useState(state.fadeInDuration);
  const [draftFadeOut, setDraftFadeOut]     = useState(state.fadeOutDuration);
  const [draftSeekFade, setDraftSeekFade]   = useState(state.seekFadeDuration);

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

  const fmt = (v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1));

  // ── Dragging ───────────────────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only drag on the header area
      if ((e.target as HTMLElement).closest('.track-controls')) return;
      e.preventDefault();

      dragOffset.current = { x: e.clientX - x, y: e.clientY - y };

      const onMove = (ev: MouseEvent) => {
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

  // ── Progress bar click ─────────────────────────────────────────────────────
  const onProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seek(state.id, ratio * state.duration);
    },
    [state.id, state.duration, seek],
  );

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div
      ref={cardRef}
      className="track-player"
      style={{ left: x, top: y }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div className="track-header">
        <span className="track-title" title={state.title}>
          {state.title}
        </span>
        <button className="btn-close" onClick={() => removeTrack(state.id)} title="Remove track">
          ✕
        </button>
      </div>

      {/* Time info */}
      <div className="track-time">
        <span>{formatTime(state.currentTime)}</span>
        <span className="track-duration">{formatTime(state.duration)}</span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" onClick={onProgressClick} title="Seek">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="track-controls">
        <div className="controls-row">
          {/* Play / Pause */}
          <button
            className={`btn-playback ${state.playing ? 'active' : ''}`}
            onClick={() => (state.playing ? pause(state.id) : play(state.id))}
            title={state.playing ? 'Pause' : 'Play'}
          >
            {state.playing ? '⏸' : '▶'}
          </button>

          {/* Stop */}
          <button className="btn-playback" onClick={() => stop(state.id)} title="Stop">
            ⏹
          </button>

          {/* Loop toggle */}
          <label
            className={`loop-toggle toggle--loop${state.loop ? ' loop-on' : ''}`}
            title={state.loop ? 'Disable loop' : 'Enable loop'}
          >
            <input
              type="checkbox"
              checked={state.loop}
              onChange={e => setLoop(state.id, e.target.checked)}
            />
            <span className="loop-track">
              <span className="loop-thumb" />
            </span>
            <span className="loop-label">L</span>
          </label>

          {/* Fade In toggle */}
          <label
            className={`loop-toggle toggle--fade-in${state.fadeIn ? ' loop-on' : ''}`}
            title={state.fadeIn ? 'Disable fade in' : `Enable ${fmt(state.fadeInDuration)}s fade in on play`}
          >
            <input
              type="checkbox"
              checked={state.fadeIn}
              onChange={e => setFadeIn(state.id, e.target.checked)}
            />
            <span className="loop-track">
              <span className="loop-thumb" />
            </span>
            <span className="loop-label">I</span>
          </label>

          {/* Fade Out toggle */}
          <label
            className={`loop-toggle toggle--fade-out${state.fadeOut ? ' loop-on' : ''}`}
            title={state.fadeOut ? 'Disable fade out' : `Enable ${fmt(state.fadeOutDuration)}s fade out on stop/pause`}
          >
            <input
              type="checkbox"
              checked={state.fadeOut}
              onChange={e => setFadeOut(state.id, e.target.checked)}
            />
            <span className="loop-track">
              <span className="loop-thumb" />
            </span>
            <span className="loop-label">O</span>
          </label>

          {/* Seek Fade toggle */}
          <label
            className={`loop-toggle toggle--seek-fade${state.seekFade ? ' loop-on' : ''}`}
            title={state.seekFade ? 'Disable seek fade' : `Enable ${fmt(state.seekFadeDuration)}s fade out/in on seek`}
          >
            <input
              type="checkbox"
              checked={state.seekFade}
              onChange={e => setSeekFade(state.id, e.target.checked)}
            />
            <span className="loop-track">
              <span className="loop-thumb" />
            </span>
            <span className="loop-label">S</span>
          </label>

          {/* Fade-duration settings */}
          <button
            className="btn-settings"
            onClick={openSettings}
            title="Configure fade durations"
          >
            ⚙
          </button>
        </div>

        {/* Volume — full width on its own row */}
        <div className="volume-control">
          <span className="volume-icon">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onChange={e => setVolume(state.id, parseFloat(e.target.value))}
            title={`Volume: ${Math.round(state.volume * 100)}%`}
          />
          <span className="volume-value">{Math.round(state.volume * 100)}%</span>
        </div>
      </div>

      {/* ── Fade-duration settings overlay ──────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fade-settings-overlay"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="fade-settings-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="fade-settings-title">⚙ Fade Durations</div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Fade In</span>
              <input
                type="range" min={0} max={10} step={0.5}
                value={draftFadeIn}
                onChange={e => setDraftFadeIn(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftFadeIn)}s</span>
            </div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Fade Out</span>
              <input
                type="range" min={0} max={10} step={0.5}
                value={draftFadeOut}
                onChange={e => setDraftFadeOut(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftFadeOut)}s</span>
            </div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Seek Fade</span>
              <input
                type="range" min={0} max={10} step={0.5}
                value={draftSeekFade}
                onChange={e => setDraftSeekFade(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftSeekFade)}s</span>
            </div>

            <div className="fade-settings-actions">
              <button className="fade-settings-apply" onClick={applySettings}>Apply</button>
              <button className="fade-settings-cancel" onClick={() => setSettingsOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
