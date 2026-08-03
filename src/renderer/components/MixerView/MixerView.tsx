import { TrackEntry } from '../../context/audioContextInstance';
import { ChannelStrip } from './ChannelStrip';

import './MixerView.css';

interface MixerViewProps {
  tracks: TrackEntry[];
}

export const MixerView = ({ tracks }: MixerViewProps) => {
  return (
    <div className="mixer-rack">
      {tracks.map((t) => (
        <ChannelStrip key={t.state.id} track={t} />
      ))}
    </div>
  );
};
