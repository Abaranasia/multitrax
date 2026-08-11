import type { ChangeEvent, CSSProperties } from 'react';

export const useMasterVolumeControl = (
  masterVolume: number,
  setMasterVolume: (value: number) => void,
) => {
  const percentage = Math.round(masterVolume * 100);

  return {
    volume: masterVolume,
    percentage,
    style: { '--volume-fill': `${percentage}%` } as CSSProperties,
    title: `Volume: ${percentage}%`,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setMasterVolume(parseFloat(e.target.value)),
    isMuted: false,
    onToggleMute: () => {},
  };
};
