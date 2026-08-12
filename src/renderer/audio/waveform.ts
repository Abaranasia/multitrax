// Number of peak buckets rendered across the waveform preview's width.
export const WAVEFORM_BUCKET_COUNT = 48;

// Peaks are boosted before clamping to [0,1] so quiet passages still render
// a visible bar instead of a near-flat line.
export const WAVEFORM_PEAK_BOOST = 1.4;

/**
 * Computes a {@link WAVEFORM_BUCKET_COUNT}-bucket peak-amplitude waveform
 * preview for `audioBuffer`.
 *
 * Extracted from `AudioContext.tsx`'s `addTracks` so `loadSession` can build
 * the exact same waveform preview for tracks restored from a session file,
 * without duplicating the bucketing/peak logic.
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer): number[] {
  return Array.from({ length: WAVEFORM_BUCKET_COUNT }, (_, index) => {
    const sliceStart = (index / WAVEFORM_BUCKET_COUNT) * (audioBuffer.length ?? 0);
    const sliceEnd = ((index + 1) / WAVEFORM_BUCKET_COUNT) * (audioBuffer.length ?? 0);
    const channelData =
      typeof audioBuffer.getChannelData === 'function' ? audioBuffer.getChannelData(0) : null;
    let peak = 0;
    for (let i = sliceStart; i < sliceEnd; i += 1) {
      const value = channelData ? Math.abs(channelData[Math.floor(i)] ?? 0) : 0;
      if (value > peak) peak = value;
    }
    return Math.min(1, peak * WAVEFORM_PEAK_BOOST);
  });
}
