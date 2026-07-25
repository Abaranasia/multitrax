import { useEffect, useRef } from 'react';
import { ReverbRoom, TrackState } from '../../domain/TrackState';
import { formatTime } from '../../utils/formatTime';
import { useTrackPlayer } from './useTrackPlayer';
import { TrackContextMenu } from './TrackContextMenu';
import { FilterSettingsDialog } from './FilterSettingsDialog';
import { useFilterSettingsDialog } from './useFilterSettingsDialog';
import { DistortionSettingsDialog } from './DistortionSettingsDialog';
import { useDistortionSettingsDialog } from './useDistortionSettingsDialog';

import './TrackPlayer.css';

interface TrackPlayerProps {
  state: TrackState;
  x: number;
  y: number;
}

export const TrackPlayer = ({ state, x, y }: TrackPlayerProps) => {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
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
    setPan,
    contextMenuPosition,
    onContextMenu,
    duplicate,
  } = useTrackPlayer({ state, x, y });

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const waveform = state.waveform ?? [];
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || canvas.clientWidth || 280;
    const height = rect.height || canvas.clientHeight || 65;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 6 * dpr;
    const availableWidth = Math.max(0, canvas.width - padding * 2);
    const barWidth = Math.max(dpr, Math.min(1.4 * dpr, 2 * dpr));
    const count = Math.max(waveform.length, Math.floor(availableWidth / (barWidth * 1.1)));
    const step = availableWidth / Math.max(count, 1);
    const centerY = canvas.height / 2;
    const maxBarHeight = canvas.height * 0.78;

    const drawWaveform = (fillStyle: CanvasGradient | string, alpha: number) => {
      ctx.fillStyle = fillStyle;
      ctx.globalAlpha = alpha;

      for (let i = 0; i < count; i += 1) {
        const idx = Math.floor((i / Math.max(count - 1, 1)) * Math.max(waveform.length - 1, 0));
        const value = waveform[idx] ?? 0.25;
        const normalized = 0.3 + value * 0.7;
        const height = Math.max(canvas.height * 0.25, normalized * maxBarHeight);
        const x = padding + i * step + (step - barWidth) / 2;
        const y = centerY - height / 2;
        ctx.fillRect(x, y, barWidth, height);
      }
    };

    const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGradient.addColorStop(0, 'rgba(125, 211, 252, 0.28)');
    baseGradient.addColorStop(1, 'rgba(192, 132, 252, 0.28)');
    drawWaveform(baseGradient, 0.72);

    if (progress > 0) {
      const playedWidth = (canvas.width * progress) / 100;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playedWidth, canvas.height);
      ctx.clip();

      const activeGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      activeGradient.addColorStop(0, '#7dd3fc');
      activeGradient.addColorStop(1, '#c084fc');
      drawWaveform(activeGradient, 0.94);

      ctx.restore();
    }
  }, [state.waveform, progress]);
  const filterDialog = useFilterSettingsDialog(state);
  const distortionDialog = useDistortionSettingsDialog(state);

  return (
    <div
      ref={cardRef}
      className={`track-player${reverbSettingsOpen ? ' track-player--reverb-open' : ''}${delaySettingsOpen ? ' track-player--delay-open' : ''}${filterDialog.isOpen ? ' track-player--filter-open' : ''}${distortionDialog.isOpen ? ' track-player--distortion-open' : ''}`}
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
            onClick={openDelaySettings}
            title="Delay settings"
          >
            D
          </button>

          {/* Reverb settings */}
          <button
            className={`btn-reverb${state.reverbMix > 0 ? ' btn-reverb--active' : ''}`}
            onClick={openReverbSettings}
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
              onClick={openSettings}
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
            style={{
              background:
                state.pan === 0
                  ? '#0f3460'
                  : state.pan < 0
                    ? `linear-gradient(90deg, #239989 0%, #abc5c2 ${Math.round((state.pan + 1) * 50)}%, #0f3460 ${Math.round((state.pan + 1) * 50)}%, #0f3460 100%)`
                    : `linear-gradient(90deg, #0f3460 0%, #0f3460 ${Math.round(state.pan * 50 + 50)}%, #abc5c2 ${Math.round(state.pan * 50 + 50)}%, #239989 100%)`,
            }}
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
            style={{
              background: `linear-gradient(90deg, #abc5c2 0%, #239989 ${Math.round(state.volume * 100)}%, #0f3460 ${Math.round(state.volume * 100)}%, #0f3460 100%)`,
            }}
          />
          <span className="volume-value">{Math.round(state.volume * 100)}%</span>
        </div>
      </div>

      {/* ── Fade-duration settings overlay ──────────────────────────────── */}
      {settingsOpen && (
        <div
          className="fade-settings-overlay"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSettingsOpen(false)}
        >
          <div className="fade-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="fade-settings-title">⚙ Fade Durations</div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Fade In</span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={draftFadeIn}
                onChange={(e) => setDraftFadeIn(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftFadeIn)}s</span>
            </div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Fade Out</span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={draftFadeOut}
                onChange={(e) => setDraftFadeOut(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftFadeOut)}s</span>
            </div>

            <div className="fade-settings-field">
              <span className="fade-settings-label">Seek Fade</span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={draftSeekFade}
                onChange={(e) => setDraftSeekFade(Number(e.target.value))}
              />
              <span className="fade-settings-value">{fmt(draftSeekFade)}s</span>
            </div>

            <div className="fade-settings-actions">
              <button className="fade-settings-apply" onClick={applySettings}>
                Apply
              </button>
              <button className="fade-settings-cancel" onClick={() => setSettingsOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delay settings overlay ───────────────────────────────────────── */}
      {delaySettingsOpen && (
        <div
          className="delay-settings-overlay"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setDelaySettingsOpen(false)}
        >
          <div className="delay-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="delay-settings-title">·•● Delay</div>

            <div className="delay-settings-field">
              <span className="delay-settings-label">Time</span>
              <input
                type="range"
                min={1}
                max={2000}
                step={10}
                value={draftDelayTime}
                onChange={(e) => setDraftDelayTime(Number(e.target.value))}
              />
              <span className="delay-settings-value">{draftDelayTime}ms</span>
            </div>

            <div className="delay-settings-field">
              <span className="delay-settings-label">Feedback</span>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={draftDelayFeedback}
                onChange={(e) => setDraftDelayFeedback(Number(e.target.value))}
              />
              <span className="delay-settings-value">{draftDelayFeedback}%</span>
            </div>

            <div className="delay-settings-field">
              <span className="delay-settings-label">Tone</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftDelayDamping}
                onChange={(e) => setDraftDelayDamping(Number(e.target.value))}
              />
              <span className="delay-settings-value">{draftDelayDamping}%</span>
            </div>

            <div className="delay-settings-field">
              <span className="delay-settings-label">Output</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftDelayOutput}
                onChange={(e) => setDraftDelayOutput(Number(e.target.value))}
              />
              <span className="delay-settings-value">{draftDelayOutput}%</span>
            </div>

            <div className="delay-settings-field">
              <span className="delay-settings-label delay-settings-label--mix">Mix</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftDelayMix}
                onChange={(e) => setDraftDelayMix(Number(e.target.value))}
              />
              <span className="delay-settings-value delay-settings-value--mix">
                {draftDelayMix}%
              </span>
            </div>

            <div className="delay-settings-actions">
              <button className="delay-settings-apply" onClick={applyDelaySettings}>
                Apply
              </button>
              <button className="delay-settings-cancel" onClick={() => setDelaySettingsOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reverb settings overlay ──────────────────────────────────────── */}
      {reverbSettingsOpen && (
        <div
          className="reverb-settings-overlay"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setReverbSettingsOpen(false)}
        >
          <div className="reverb-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="reverb-settings-title">🎛️ Reverb</div>

            <div className="reverb-settings-field">
              <span className="reverb-settings-label">Room</span>
              <select
                className="reverb-settings-select"
                value={draftReverbRoom}
                onChange={(e) => setDraftReverbRoom(e.target.value as ReverbRoom)}
              >
                <option value="small-room">Small Room</option>
                <option value="hall">Hall</option>
                <option value="plate">Plate</option>
                <option value="cathedral">Cathedral</option>
              </select>
            </div>

            <div className="reverb-settings-field">
              <span className="reverb-settings-label">Pre-delay</span>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={draftReverbPreDelay}
                onChange={(e) => setDraftReverbPreDelay(Number(e.target.value))}
              />
              <span className="reverb-settings-value">{draftReverbPreDelay}ms</span>
            </div>

            <div className="reverb-settings-field">
              <span className="reverb-settings-label">Damping</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftReverbDamping}
                onChange={(e) => setDraftReverbDamping(Number(e.target.value))}
              />
              <span className="reverb-settings-value">{draftReverbDamping}%</span>
            </div>

            <div className="reverb-settings-field">
              <span className="reverb-settings-label">Output</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftReverbOutput}
                onChange={(e) => setDraftReverbOutput(Number(e.target.value))}
              />
              <span className="reverb-settings-value">{draftReverbOutput}%</span>
            </div>

            <div className="reverb-settings-field">
              <span className="reverb-settings-label reverb-settings-label--mix">Mix</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftReverbMix}
                onChange={(e) => setDraftReverbMix(Number(e.target.value))}
              />
              <span className="reverb-settings-value reverb-settings-value--mix">
                {draftReverbMix}%
              </span>
            </div>

            <div className="reverb-settings-actions">
              <button className="reverb-settings-apply" onClick={applyReverbSettings}>
                Apply
              </button>
              <button
                className="reverb-settings-cancel"
                onClick={() => setReverbSettingsOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter settings overlay ──────────────────────────────────────── */}
      {filterDialog.isOpen && (
        <FilterSettingsDialog
          draftType={filterDialog.draftType}
          setDraftType={filterDialog.setDraftType}
          draftCutoff={filterDialog.draftCutoff}
          setDraftCutoff={filterDialog.setDraftCutoff}
          draftResonance={filterDialog.draftResonance}
          setDraftResonance={filterDialog.setDraftResonance}
          draftMix={filterDialog.draftMix}
          setDraftMix={filterDialog.setDraftMix}
          draftOutput={filterDialog.draftOutput}
          setDraftOutput={filterDialog.setDraftOutput}
          onApply={filterDialog.apply}
          onCancel={filterDialog.close}
        />
      )}

      {/* ── Distortion settings overlay ──────────────────────────────────── */}
      {distortionDialog.isOpen && (
        <DistortionSettingsDialog
          draftDrive={distortionDialog.draftDrive}
          setDraftDrive={distortionDialog.setDraftDrive}
          draftTone={distortionDialog.draftTone}
          setDraftTone={distortionDialog.setDraftTone}
          draftMix={distortionDialog.draftMix}
          setDraftMix={distortionDialog.setDraftMix}
          draftOutput={distortionDialog.draftOutput}
          setDraftOutput={distortionDialog.setDraftOutput}
          onApply={distortionDialog.apply}
          onCancel={distortionDialog.close}
        />
      )}

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
