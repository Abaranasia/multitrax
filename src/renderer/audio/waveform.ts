/**
 * Computes a 48-bucket peak-amplitude waveform preview for `audioBuffer`.
 *
 * Extracted from `AudioContext.tsx`'s `addTracks` so `loadSession` can build
 * the exact same waveform preview for tracks restored from a session file,
 * without duplicating the bucketing/peak logic.
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer): number[] {
  return Array.from({ length: 48 }, (_, index) => {
    const sliceStart = (index / 48) * (audioBuffer.length ?? 0);
    const sliceEnd = ((index + 1) / 48) * (audioBuffer.length ?? 0);
    const channelData =
      typeof audioBuffer.getChannelData === 'function' ? audioBuffer.getChannelData(0) : null;
    let peak = 0;
    for (let i = sliceStart; i < sliceEnd; i += 1) {
      const value = channelData ? Math.abs(channelData[Math.floor(i)] ?? 0) : 0;
      if (value > peak) peak = value;
    }
    return Math.min(1, peak * 1.4);
  });
}
