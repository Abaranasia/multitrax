// Peak-hold-style falloff: jumps up instantly on a louder sample, decays
// gradually otherwise — classic VU/peak meter ballistics instead of a
// raw, jittery per-frame RMS readout.
export const RELEASE_PER_FRAME = 0.9;

// Meter floor in dBFS — RMS amplitude at or below this reads as empty.
// A linear amplitude→height mapping looks almost empty for real program
// material (music RMS rarely exceeds ~0.3, i.e. -10 dBFS), since only a
// full-scale sine wave gets close to 1.0. Mapping on a dB scale instead
// (same `20 * log10` convention as formatDb.ts) matches how ears and real
// VU meters perceive loudness, so a "loud" track visibly fills the bar.
export const MIN_DB = -48;

export function levelToPercent(amplitude: number): number {
  if (amplitude <= 0) return 0;
  const db = 20 * Math.log10(amplitude);
  return Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100));
}
