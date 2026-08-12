import { TrackState } from '../../domain/TrackState';
import { formatTime } from '../../utils/formatTime';
import { useTrackPlayer } from './useTrackPlayer';
import {
  TrackContextMenu,
  EffectDialogs,
  WaveformCanvas,
  useWaveformCanvas,
  VolumeControl,
  useVolumeControl,
  PanControl,
  usePanControl,
  EffectToggles,
  useEffectToggles,
  TransportControls,
  useTransportControls,
  useFilterSettingsDialog,
  useDistortionSettingsDialog,
  useFadeSettingsDialog,
  useDelaySettingsDialog,
  useReverbSettingsDialog,
} from './components';

import './TrackPlayer.css';

interface TrackPlayerProps {
  state: TrackState;
  filePath: string;
  x: number;
  y: number;
}

export const TrackPlayer = ({ state, filePath, x, y }: TrackPlayerProps) => {
  const {
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
    duplicate,
    reveal,
    canReveal,
  } = useTrackPlayer({ state, filePath, x, y });

  const waveformCanvasRef = useWaveformCanvas(state.waveform, progress);
  const volumeControl = useVolumeControl(state, setVolume);
  const panControl = usePanControl(state, setPan);
  const filterDialog = useFilterSettingsDialog(state);
  const distortionDialog = useDistortionSettingsDialog(state);
  const fadeDialog = useFadeSettingsDialog(state);
  const delayDialog = useDelaySettingsDialog(state);
  const reverbDialog = useReverbSettingsDialog(state);
  const effectToggles = useEffectToggles(state, {
    onFilterOpen: filterDialog.open,
    onDistortionOpen: distortionDialog.open,
    onDelayOpen: delayDialog.open,
    onReverbOpen: reverbDialog.open,
  });
  const transportControls = useTransportControls(
    state,
    { play, pause, stop, setLoop, setFadeIn, setFadeOut, setSeekFade, onOpenFadeSettings: fadeDialog.open },
    fmt,
  );

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
        <EffectToggles {...effectToggles} />

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
      <WaveformCanvas
        canvasRef={waveformCanvasRef}
        progress={progress}
        title={state.title}
        onProgressClick={onProgressClick}
        onProgressKeyDown={onProgressKeyDown}
      />

      {/* Controls */}
      <div className="track-controls">
        <TransportControls {...transportControls} />

        {/* Pan — full width on its own row, above Volume */}
        <PanControl {...panControl} />

        {/* Volume — full width on its own row */}
        <VolumeControl {...volumeControl} />
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
          onReveal={reveal}
          revealDisabled={!canReveal}
        />
      )}
    </div>
  );
};
