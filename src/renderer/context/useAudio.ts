import { useContext } from 'react';
import { AudioContextValue, Ctx } from './audioContextInstance';

export const useAudio = (): AudioContextValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
};
