import { useRef } from 'react';
import { TrackEntry } from '../../context/audioContextInstance';
import { ChannelStrip } from './ChannelStrip';
import { MasterStrip } from './MasterStrip';
import { useMixerReorder } from './useMixerReorder';

import './MixerView.css';

interface MixerViewProps {
  tracks: TrackEntry[];
  reorderTracks: (id: string, toIndex: number) => void;
}

export const MixerView = ({ tracks, reorderTracks }: MixerViewProps) => {
  const rackRef = useRef<HTMLDivElement>(null);
  const { draggingId, onHandleMouseDown } = useMixerReorder(tracks, reorderTracks, rackRef);

  return (
    <div className="mixer-view">
      <div className="mixer-rack" ref={rackRef}>
        {tracks.map((t) => (
          <ChannelStrip
            key={t.state.id}
            track={t}
            isDragging={t.state.id === draggingId}
            onDragHandleMouseDown={onHandleMouseDown}
          />
        ))}
      </div>
      <div className="mixer-master-dock">
        <MasterStrip />
      </div>
    </div>
  );
};
