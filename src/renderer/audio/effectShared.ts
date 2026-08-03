// Lowpass cutoff range shared by the delay "tone" and reverb "damping"
// controls: 0% = no damping (fully open, bright), 100% = heavy damping
// (dark, muffled).
export const DAMPING_MIN_HZ = 500;
export const DAMPING_MAX_HZ = 20000;

/**
 * Builds the dry/wet/output gain triple shared by every insert effect
 * (filter, distortion, delay, reverb):
 *   dryGain ──────────┐
 *                      ┴→ outputGain
 *   wetGain ──────────┘
 * Initialises dryGain=1/wetGain=0/outputGain=1 (mix = 0 ⇒ fully dry, full
 * output level) — the shared default every builder previously set inline.
 * `outputGain` is intentionally left unconnected here; each caller
 * (`addTrack`) wires it onward into the next insert's entry points.
 * Callers create their own effect-specific middle node(s) and connect the
 * last one into the returned `wetGain`.
 */
export function createDryWetOutput(
  ctx: AudioContext,
): { dryGain: GainNode; wetGain: GainNode; outputGain: GainNode } {
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const outputGain = ctx.createGain();

  dryGain.connect(outputGain);
  wetGain.connect(outputGain);

  dryGain.gain.value = 1;
  wetGain.gain.value = 0;
  outputGain.gain.value = 1;

  return { dryGain, wetGain, outputGain };
}
