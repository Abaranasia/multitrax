import type { CSSProperties } from 'react';
import { TrackState } from '../../domain/TrackState';
import { formatTime } from '../../utils/formatTime';
import { useTrackPlayer } from './useTrackPlayer';
import { useWaveformCanvas } from './useWaveformCanvas';
import {
  TrackContextMenu,
  EffectDialogs,
  useFilterSettingsDialog,
  useDistortionSettingsDialog,
  useFadeSettingsDialog,
  useDelaySettingsDialog,
  useReverbSettingsDialog,
} from './components';

import './TrackPlayer.css';

interface TrackPlayerProps {
  state: TrackState;
  x: number;
  y: number;
}

export const TrackPlayer = ({ state, x, y }: TrackPlayerProps) => {
  const {
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
    duplicate,
  } = useTrackPlayer({ state, x, y });

  const waveformCanvasRef = useWaveformCanvas(state.waveform, progress);
  const filterDialog = useFilterSettingsDialog(state);
  const distortionDialog = useDistortionSettingsDialog(state);
  const fadeDialog = useFadeSettingsDialog(state);
  const delayDialog = useDelaySettingsDialog(state);
  const reverbDialog = useReverbSettingsDialog(state);

  return (
    <div
      ref={cardRef}
      className={`track-player${reverbDialog.isOpen ? ' track-player--reverb-open' : ''}${delayDialog.isOpen ? ' track-player--delay-open' : ''}${filterDialog.isOpen ? ' track-player--filter-open' : ''}${distortionDialog.isOpen ? ' track-player--distortion-open' : ''}${fadeDialog.isOpen ? ' track-player--fade-open' : ''}`}
      style={{ left: x, top: y }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      {/* Header */}
      <div className="track-header">
        <span className="track-title" title={state.title}>
          {state.title.split(/[\\/]/).pop() ?? state.title}
        </span>

        {/* Effects section — per-track effect toggles live here, separate from
            the transport/toggle controls below, so this row has room to grow
            as more effects are added. */}
        <div className="track-effects">
          {/* Filter settings */}
          <button
            className={`btn-filter${state.filterMix > 0 ? ' btn-filter--active' : ''}`}
            onClick={filterDialog.open}
            title="Filter settings"
          >
            F
          </button>

          {/* Distortion settings */}
          <button
            className={`btn-distortion${state.distortionMix > 0 ? ' btn-distortion--active' : ''}`}
            onClick={distortionDialog.open}
            title="Waveshape settings"
          >
            W
          </button>

          {/* Delay settings */}
          <button
            className={`btn-delay${state.delayMix > 0 ? ' btn-delay--active' : ''}`}
            onClick={delayDialog.open}
            title="Delay settings"
          >
            D
          </button>

          {/* Reverb settings */}
          <button
            className={`btn-reverb${state.reverbMix > 0 ? ' btn-reverb--active' : ''}`}
            onClick={reverbDialog.open}
            title="Reverb settings"
          >
            R
          </button>
        </div>

        <button className="btn-close" onClick={() => removeTrack(state.id)} title="Remove track">
          ✕
        </button>
      </div>

      {/* Time info */}
      <div className="track-time">
        <span>{formatTime(state.currentTime)}</span>
        <span className="track-duration">{formatTime(state.duration)}</span>
      </div>

      {/* Waveform preview */}
      <div className="waveform-shell" onClick={onProgressClick} title="Seek">
        <canvas
          ref={waveformCanvasRef}
          className="waveform-canvas"
          role="img"
          aria-label={`Waveform preview for ${state.title}`}
          style={{ width: '100%', height: '100%' }}
        />
        <div className="waveform-progress" style={{ width: `${progress}%` }} />
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

          <div className="controls-group">
            {/* Loop toggle */}
            <button
              type="button"
              className={`loop-toggle toggle--loop${state.loop ? ' loop-on' : ''}`}
              title={state.loop ? 'Disable loop' : 'Enable loop'}
              onClick={() => setLoop(state.id, !state.loop)}
            >
              <span className="loop-label">L</span>
            </button>

            {/* Fade In toggle */}
            <button
              type="button"
              className={`loop-toggle toggle--fade-in${state.fadeIn ? ' loop-on' : ''}`}
              title={
                state.fadeIn
                  ? 'Disable fade in'
                  : `Enable ${fmt(state.fadeInDuration)}s fade in on play`
              }
              onClick={() => setFadeIn(state.id, !state.fadeIn)}
            >
              <span className="loop-label">I</span>
            </button>

            {/* Fade Out toggle */}
            <button
              type="button"
              className={`loop-toggle toggle--fade-out${state.fadeOut ? ' loop-on' : ''}`}
              title={
                state.fadeOut
                  ? 'Disable fade out'
                  : `Enable ${fmt(state.fadeOutDuration)}s fade out on stop/pause`
              }
              onClick={() => setFadeOut(state.id, !state.fadeOut)}
            >
              <span className="loop-label">O</span>
            </button>

            {/* Seek Fade toggle */}
            <button
              type="button"
              className={`loop-toggle toggle--seek-fade${state.seekFade ? ' loop-on' : ''}`}
              title={
                state.seekFade
                  ? 'Disable seek fade'
                  : `Enable ${fmt(state.seekFadeDuration)}s fade out/in on seek`
              }
              onClick={() => setSeekFade(state.id, !state.seekFade)}
            >
              <span className="loop-label">S</span>
            </button>

            {/* Fade-duration settings */}
            <button
              className="btn-settings"
              onClick={fadeDialog.open}
              title="Configure fade durations"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Pan — full width on its own row, above Volume */}
        <div className="pan-control">
          <span className="pan-label">L</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={state.pan}
            onChange={(e) => setPan(state.id, parseFloat(e.target.value))}
            onDoubleClick={() => setPan(state.id, 0)}
            title={`Pan: ${
              state.pan === 0
                ? 'Center'
                : state.pan < 0
                  ? `${Math.round(-state.pan * 100)}% Left`
                  : `${Math.round(state.pan * 100)}% Right`
            }`}
            className={
              state.pan < 0
                ? 'pan-input pan-input--left'
                : state.pan > 0
                  ? 'pan-input pan-input--right'
                  : 'pan-input'
            }
            style={{ '--pan-fill': `${Math.round((state.pan + 1) * 50)}%` } as CSSProperties}
          />
          <span className="pan-label">R</span>
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
            onChange={(e) => setVolume(state.id, parseFloat(e.target.value))}
            title={`Volume: ${Math.round(state.volume * 100)}%`}
            style={{ '--volume-fill': `${Math.round(state.volume * 100)}%` } as CSSProperties}
          />
          <span className="volume-value">{Math.round(state.volume * 100)}%</span>
        </div>
      </div>

      <EffectDialogs
        filterDialog={filterDialog}
        distortionDialog={distortionDialog}
        fadeDialog={fadeDialog}
        delayDialog={delayDialog}
        reverbDialog={reverbDialog}
      />

      {/* ── Right-click context menu ─────────────────────────────────────── */}
      {contextMenuPosition && (
        <TrackContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onDuplicate={duplicate}
        />
      )}
    </div>
  );
};
