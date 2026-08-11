import { formatDb } from '../../utils/formatDb';
import { useMasterStrip } from './useMasterStrip';
import { useMasterVolumeControl } from './useMasterVolumeControl';
import { useMasterBalanceControl } from './useMasterBalanceControl';
import { useMasterVUMeter } from './useMasterVUMeter';
import { PanDial } from './PanDial';
import { VUMeter } from './VUMeter';
import { VolumeControl } from '../TrackPlayer/components';

import './MixerView.css';

export const MasterStrip = () => {
  const { engine, masterVolume, masterBalance, setMasterVolume, setMasterBalance } = useMasterStrip();

  const volumeControl = useMasterVolumeControl(masterVolume, setMasterVolume);
  const balanceControl = useMasterBalanceControl(masterBalance, setMasterBalance);
  const { leftStyle, rightStyle } = useMasterVUMeter(engine);

  return (
    <div className="mixer-strip master">
      <div className="mixer-strip-header">
        <div className="mixer-strip-title" title="Master">
          Master
        </div>
      </div>

      <div className="mixer-strip-out">OUT</div>

      <PanDial {...balanceControl} />

      <div className="mixer-middle-row">
        <div className="mixer-fader">
          <VolumeControl {...volumeControl} />
        </div>

        <div className="mixer-master-meters">
          <VUMeter style={leftStyle} />
          <VUMeter style={rightStyle} />
        </div>
      </div>

      <div className="mixer-db">{formatDb(masterVolume)}</div>
    </div>
  );
};
