import { describe, expect, it } from 'vitest';
import { formatTime } from '@/renderer/utils/formatTime';

describe('formatTime', () => {
  it('converts seconds to mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(125)).toBe('2:05');
  });

  it('returns 0:00 for invalid values', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });
});
