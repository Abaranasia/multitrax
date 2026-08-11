import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';
import { levelToPercent, RELEASE_PER_FRAME } from './meterLevel';

export const useVUMeter = (engine: AudioEngine, id: string, playing: boolean) => {
  const [level, setLevel] = useState(0);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!playing) return;

    let frameId: number;
    const tick = () => {
      const raw = engine.getLevel(id);
      levelRef.current = raw > levelRef.current ? raw : levelRef.current * RELEASE_PER_FRAME;
      setLevel(levelRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      levelRef.current = 0;
    };
  }, [engine, id, playing]);

  const displayLevel = playing ? level : 0;
  const percentage = Math.round(levelToPercent(displayLevel));

  return {
    style: { '--meter-level': `${percentage}%` } as CSSProperties,
  };
};
