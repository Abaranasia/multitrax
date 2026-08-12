import { describe, expect, it } from 'vitest';
import {
  computeWaveformPeaks,
  WAVEFORM_BUCKET_COUNT,
  WAVEFORM_PEAK_BOOST,
} from '@/renderer/audio/waveform';

function createMockAudioBuffer(channelData: Float32Array): AudioBuffer {
  return {
    length: channelData.length,
    getChannelData: () => channelData,
  } as unknown as AudioBuffer;
}

describe('computeWaveformPeaks', () => {
  it('returns WAVEFORM_BUCKET_COUNT buckets', () => {
    const buffer = createMockAudioBuffer(new Float32Array(480).fill(0.1));
    expect(computeWaveformPeaks(buffer)).toHaveLength(WAVEFORM_BUCKET_COUNT);
  });

  it('reports the peak absolute amplitude per bucket, scaled by WAVEFORM_PEAK_BOOST and clamped to 1', () => {
    const data = new Float32Array(WAVEFORM_BUCKET_COUNT);
    data[0] = 0.5;
    const buffer = createMockAudioBuffer(data);

    const peaks = computeWaveformPeaks(buffer);
    expect(peaks[0]).toBeCloseTo(0.5 * WAVEFORM_PEAK_BOOST);
    expect(peaks[1]).toBe(0);
  });

  it('clamps very loud peaks to 1', () => {
    const data = new Float32Array(WAVEFORM_BUCKET_COUNT).fill(1);
    const buffer = createMockAudioBuffer(data);

    const peaks = computeWaveformPeaks(buffer);
    expect(peaks.every((p) => p === 1)).toBe(true);
  });

  it('returns all-zero peaks when getChannelData is unavailable', () => {
    const buffer = { length: WAVEFORM_BUCKET_COUNT } as unknown as AudioBuffer;
    const peaks = computeWaveformPeaks(buffer);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });
});
