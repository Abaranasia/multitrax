import type { MouseEvent as ReactMouseEvent } from 'react';
import { TrackEntry } from '../../context/audioContextInstance';
import { formatDb } from '../../utils/formatDb';
import { useChannelStrip } from './useChannelStrip';
import { PanDial } from './PanDial';
import {
  EffectDialogs,
  WaveformCanvas,
  useWaveformCanvas,
  VolumeControl,
  useVolumeControl,
  usePanControl,
  EffectToggles,
  useEffectToggles,
  PlaybackButtons,
  TransportToggles,
  useTransportControls,
  useFilterSettingsDialog,
  useDistortionSettingsDialog,
  useFadeSettingsDialog,
  useDelaySettingsDialog,
  useReverbSettingsDialog,
} from '../TrackPlayer/components';

import './MixerView.css';

interface ChannelStripProps {
  track: TrackEntry;
  isDragging: boolean;
  onDragHandleMouseDown: (id: string, e: ReactMouseEvent) => void;
}

export const ChannelStrip = ({ track, isDragging, onDragHandleMouseDown }: ChannelStripProps) => {
  const { state } = track;
  const {
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
    setPan,
  } = useChannelStrip(state);

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
    <div className={`mixer-strip${isDragging ? ' is-dragging' : ''}`}>
      <div className="mixer-strip-header">
        <span
          className="mixer-strip-grip"
          title="Drag to reorder"
          onMouseDown={(e) => onDragHandleMouseDown(track.state.id, e)}
        >
          ⣿
        </span>
        <div className="mixer-strip-title" title={state.title}>
          {state.title.split(/[\\/]/).pop() ?? state.title}
        </div>
      </div>

      <WaveformCanvas
        canvasRef={waveformCanvasRef}
        progress={progress}
        title={state.title}
        onProgressClick={onProgressClick}
      />

      <EffectToggles {...effectToggles} />

      <PanDial {...panControl} />

      <div className="mixer-middle-row">
        <TransportToggles {...transportControls} />

        <div className="mixer-fader">
          <VolumeControl {...volumeControl} />
        </div>
      </div>

      <div className="mixer-db">{formatDb(state.volume)}</div>

      <PlaybackButtons {...transportControls} />

      <EffectDialogs
        filterDialog={filterDialog}
        distortionDialog={distortionDialog}
        fadeDialog={fadeDialog}
        delayDialog={delayDialog}
        reverbDialog={reverbDialog}
      />
    </div>
  );
};
