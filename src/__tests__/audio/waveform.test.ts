import { describe, expect, it } from 'vitest';
import { computeWaveformPeaks } from '@/renderer/audio/waveform';

function createMockAudioBuffer(channelData: Float32Array): AudioBuffer {
  return {
    length: channelData.length,
    getChannelData: () => channelData,
  } as unknown as AudioBuffer;
}

describe('computeWaveformPeaks', () => {
  it('returns 48 buckets', () => {
    const buffer = createMockAudioBuffer(new Float32Array(480).fill(0.1));
    expect(computeWaveformPeaks(buffer)).toHaveLength(48);
  });

  it('reports the peak absolute amplitude per bucket, scaled by 1.4 and clamped to 1', () => {
    const data = new Float32Array(48);
    data[0] = 0.5;
    const buffer = createMockAudioBuffer(data);

    const peaks = computeWaveformPeaks(buffer);
    expect(peaks[0]).toBeCloseTo(0.7);
    expect(peaks[1]).toBe(0);
  });

  it('clamps very loud peaks to 1', () => {
    const data = new Float32Array(48).fill(1);
    const buffer = createMockAudioBuffer(data);

    const peaks = computeWaveformPeaks(buffer);
    expect(peaks.every((p) => p === 1)).toBe(true);
  });

  it('returns all-zero peaks when getChannelData is unavailable', () => {
    const buffer = { length: 48 } as unknown as AudioBuffer;
    const peaks = computeWaveformPeaks(buffer);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });
});
