/**
 * Formats a linear volume (0–1) as a decibel readout for display.
 * Pure derived value — not a stored field on `TrackState`.
 */
export function formatDb(volume: number): string {
  if (volume <= 0) return '-∞ dB';
  const db = 20 * Math.log10(volume);
  return `${db.toFixed(1)} dB`;
}
