import { DistortionSettings } from './effectSettings';
import { clamp, PARAM_RAMP_TIME_CONSTANT_S } from './audioParams';
import { createDryWetOutput, DAMPING_MIN_HZ, DAMPING_MAX_HZ } from './effectShared';

// Maximum "k" coefficient fed into the distortion waveshaper curve formula;
// drive% (0–100) is scaled linearly onto this range.
const DISTORTION_MAX_K = 100;

/**
 * Per-track distortion/saturation insert: dry/wet split around a
 * WaveShaperNode, with a post-shaper lowpass (tone) filter on the wet path.
 * `outputGain` is intentionally left unconnected by `createDistortionNodes`
 * — this insert sits before delay in the chain, so the caller (`addTrack`)
 * wires `outputGain` onward into delay's entry points.
 */
export interface DistortionNodes {
  dryGain: GainNode;
  waveShaper: WaveShaperNode;
  toneFilter: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  drive: number; // 0–100 (%)
  tone: number; // 0–100 (%)
  mix: number; // 0–100 (%)
  output: number; // 0–100 (%)
}

/**
 * Builds the per-track distortion/saturation insert and wires its internal
 * routing:
 *   dryGain ────────────────────────────────────────────────┐
 *   waveShaper ──────────→ toneFilter ──────────→ wetGain    ┴→ outputGain
 * Callers connect the track's upstream node into both dryGain and
 * waveShaper, and connect outputGain onward (into delay's entry points,
 * since distortion sits before delay in the chain).
 */
export function createDistortionNodes(ctx: AudioContext): DistortionNodes {
  const { dryGain, wetGain, outputGain } = createDryWetOutput(ctx);
  const waveShaper = ctx.createWaveShaper();
  const toneFilter = ctx.createBiquadFilter();

  toneFilter.type = 'lowpass';
  waveShaper.oversample = '4x';

  waveShaper.connect(toneFilter);
  toneFilter.connect(wetGain);

  const distortion: DistortionNodes = {
    dryGain,
    waveShaper,
    toneFilter,
    wetGain,
    outputGain,
    drive: 0,
    tone: 100,
    mix: 0,
    output: 100,
  };

  // Initialise the filter/curve to match the default (mix = 0 ⇒ fully dry).
  // Gains are already dry=1/wet=0/out=1 via createDryWetOutput().
  waveShaper.curve = makeDistortionCurve(distortion.drive);
  toneFilter.frequency.value =
    DAMPING_MIN_HZ + (distortion.tone / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);

  return distortion;
}

/** Applies (in place) a new set of distortion settings to an existing DistortionNodes instance. */
export function applyDistortionSettings(
  distortion: DistortionNodes,
  s: DistortionSettings,
  now: number,
): void {
  const { drive, tone, mix, output } = s;

  distortion.drive = clamp(drive, 0, 100);
  distortion.tone = clamp(tone, 0, 100);
  distortion.mix = clamp(mix, 0, 100);
  distortion.output = clamp(output, 0, 100);

  // `curve` is not an AudioParam, so it rebuilds/swaps instantly — same
  // instant-swap idiom as reverb's `convolver.buffer` / filter's biquad type.
  distortion.waveShaper.curve = makeDistortionCurve(distortion.drive);

  const toneFrequency =
    DAMPING_MIN_HZ + (distortion.tone / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
  distortion.toneFilter.frequency.setTargetAtTime(toneFrequency, now, PARAM_RAMP_TIME_CONSTANT_S);

  const wet = distortion.mix / 100;
  distortion.dryGain.gain.setTargetAtTime(1 - wet, now, PARAM_RAMP_TIME_CONSTANT_S);
  distortion.wetGain.gain.setTargetAtTime(wet, now, PARAM_RAMP_TIME_CONSTANT_S);

  distortion.outputGain.gain.setTargetAtTime(distortion.output / 100, now, PARAM_RAMP_TIME_CONSTANT_S);
}

/**
 * Synthesises a classic soft-clip overdrive transfer curve for the
 * distortion waveshaper. `drive` (0–100) scales the `k` coefficient:
 * `k=0` yields a near-identity (transparent) pass-through; higher `k`
 * increasingly compresses the signal at larger |x|.
 *
 * NOTE: the commonly-copied MDN/StackOverflow version of this formula uses
 * a `20*deg` numerator coefficient, which reduces to `curve(x) = x/3` at
 * k=0 — a fixed ~-9.5dB cut, not a transparent pass-through. Using `60*deg`
 * instead normalizes the k=0 case to exactly `curve(x) = x` (since
 * `3 * 60*deg / pi === 1`), while uniformly scaling — and therefore fully
 * preserving the shape of — the saturation curve at every other drive
 * level.
 */
export function makeDistortionCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = (drive / 100) * DISTORTION_MAX_K;
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 60 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
