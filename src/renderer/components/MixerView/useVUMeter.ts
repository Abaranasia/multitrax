import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';

// Peak-hold-style falloff: jumps up instantly on a louder sample, decays
// gradually otherwise — classic VU/peak meter ballistics instead of a
// raw, jittery per-frame RMS readout.
const RELEASE_PER_FRAME = 0.9;

// Meter floor in dBFS — RMS amplitude at or below this reads as empty.
// A linear amplitude→height mapping looks almost empty for real program
// material (music RMS rarely exceeds ~0.3, i.e. -10 dBFS), since only a
// full-scale sine wave gets close to 1.0. Mapping on a dB scale instead
// (same `20 * log10` convention as formatDb.ts) matches how ears and real
// VU meters perceive loudness, so a "loud" track visibly fills the bar.
const MIN_DB = -48;

function levelToPercent(amplitude: number): number {
  if (amplitude <= 0) return 0;
  const db = 20 * Math.log10(amplitude);
  return Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100));
}

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
