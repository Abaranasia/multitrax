import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';
import { levelToPercent, RELEASE_PER_FRAME } from './meterLevel';

export const useMasterVUMeter = (engine: AudioEngine) => {
  const [leftLevel, setLeftLevel] = useState(0);
  const [rightLevel, setRightLevel] = useState(0);
  const leftRef = useRef(0);
  const rightRef = useRef(0);

  useEffect(() => {
    let frameId: number;
    const tick = () => {
      const rawLeft = engine.getMasterLevel('left');
      leftRef.current = rawLeft > leftRef.current ? rawLeft : leftRef.current * RELEASE_PER_FRAME;
      setLeftLevel(leftRef.current);

      const rawRight = engine.getMasterLevel('right');
      rightRef.current = rawRight > rightRef.current ? rawRight : rightRef.current * RELEASE_PER_FRAME;
      setRightLevel(rightRef.current);

      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      leftRef.current = 0;
      rightRef.current = 0;
    };
  }, [engine]);

  const leftPercentage = Math.round(levelToPercent(leftLevel));
  const rightPercentage = Math.round(levelToPercent(rightLevel));

  return {
    leftStyle: { '--meter-level': `${leftPercentage}%` } as CSSProperties,
    rightStyle: { '--meter-level': `${rightPercentage}%` } as CSSProperties,
  };
};
