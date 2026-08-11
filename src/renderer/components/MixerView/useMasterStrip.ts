import { useAudio } from '../../context/useAudio';

export const useMasterStrip = () => {
  const { engine, masterVolume, masterBalance, setMasterVolume, setMasterBalance } = useAudio();

  return {
    engine,
    masterVolume,
    masterBalance,
    setMasterVolume,
    setMasterBalance,
  };
};
