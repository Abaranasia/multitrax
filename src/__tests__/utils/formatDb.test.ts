import { describe, expect, it } from 'vitest';
import { formatDb } from '@/renderer/utils/formatDb';

describe('formatDb', () => {
  it('returns 0.0 dB for full volume', () => {
    expect(formatDb(1)).toBe('0.0 dB');
  });

  it('returns a negative dB reading for reduced volume', () => {
    expect(formatDb(0.5)).toBe(`${(20 * Math.log10(0.5)).toFixed(1)} dB`);
  });

  it('returns -∞ dB for zero volume', () => {
    expect(formatDb(0)).toBe('-∞ dB');
  });

  it('returns -∞ dB for negative volume', () => {
    expect(formatDb(-1)).toBe('-∞ dB');
  });
});
