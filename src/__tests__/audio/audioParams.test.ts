import { describe, it, expect } from 'vitest';
import { clamp } from '@/renderer/audio/audioParams';

describe('clamp', () => {
  it('clamps values into the inclusive [min, max] range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('clamps ±Infinity to the range bounds', () => {
    expect(clamp(Infinity, 0, 10)).toBe(10);
    expect(clamp(-Infinity, 0, 10)).toBe(0);
  });

  it('falls back to min instead of propagating NaN', () => {
    expect(clamp(NaN, 1, 2000)).toBe(1);
    expect(clamp(0 / 0, -1, 1)).toBe(-1);
  });
});
