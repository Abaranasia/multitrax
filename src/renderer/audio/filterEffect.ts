import { FilterType } from '../domain/TrackState';
import { FilterSettings } from './effectSettings';
import { clamp, PARAM_RAMP_TIME_CONSTANT_S } from './audioParams';
import { createDryWetOutput } from './effectShared';

// Practical sweep range for the filter's cutoff frequency and resonance (Q).
export const FILTER_CUTOFF_MIN_HZ = 20;
export const FILTER_CUTOFF_MAX_HZ = 20000;
export const FILTER_RESONANCE_MIN = 0.1;
export const FILTER_RESONANCE_MAX = 20;

/**
 * Per-track filter insert: dry/wet split around a single BiquadFilterNode.
 * `outputGain` is intentionally left unconnected by `createFilterNodes` —
 * this insert sits before delay in the chain, so the caller (`addTrack`)
 * wires `outputGain` onward into delay's entry points.
 */
export interface FilterNodes {
  dryGain: GainNode;
  biquadFilter: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  type: FilterType;
  cutoff: number; // 20–20000 (Hz)
  resonance: number; // 0.1–20 (Q)
  mix: number; // 0–100 (%)
  output: number; // 0–100 (%)
}

/**
 * Builds the per-track filter insert and wires its internal routing:
 *   dryGain ─────────────────────────┐
 *   biquadFilter ──────────→ wetGain ┴→ outputGain
 * Callers connect the track's GainNode into both dryGain and biquadFilter,
 * and connect outputGain onward (into delay's entry points, since filter
 * sits before delay in the chain).
 */
export function createFilterNodes(ctx: AudioContext): FilterNodes {
  const { dryGain, wetGain, outputGain } = createDryWetOutput(ctx);
  const biquadFilter = ctx.createBiquadFilter();

  biquadFilter.connect(wetGain);

  const filter: FilterNodes = {
    dryGain,
    biquadFilter,
    wetGain,
    outputGain,
    type: 'lowpass',
    cutoff: 1000,
    resonance: 1,
    mix: 0,
    output: 100,
  };

  // Initialise the filter to match the default (mix = 0 ⇒ fully dry).
  // Gains are already dry=1/wet=0/out=1 via createDryWetOutput().
  biquadFilter.type = filter.type;
  biquadFilter.frequency.value = filter.cutoff;
  biquadFilter.Q.value = filter.resonance;

  return filter;
}

/** Applies (in place) a new set of filter settings to an existing FilterNodes instance. */
export function applyFilterSettings(filter: FilterNodes, s: FilterSettings, now: number): void {
  const { type, cutoff, resonance, mix, output } = s;

  filter.type = type;
  filter.cutoff = clamp(cutoff, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ);
  filter.resonance = clamp(resonance, FILTER_RESONANCE_MIN, FILTER_RESONANCE_MAX);
  filter.mix = clamp(mix, 0, 100);
  filter.output = clamp(output, 0, 100);

  // `type` is not an AudioParam, so it switches instantly — same as
  // reverb's instant `convolver.buffer` swap on room change.
  filter.biquadFilter.type = filter.type;
  filter.biquadFilter.frequency.setTargetAtTime(filter.cutoff, now, PARAM_RAMP_TIME_CONSTANT_S);
  filter.biquadFilter.Q.setTargetAtTime(filter.resonance, now, PARAM_RAMP_TIME_CONSTANT_S);

  const wet = filter.mix / 100;
  filter.dryGain.gain.setTargetAtTime(1 - wet, now, PARAM_RAMP_TIME_CONSTANT_S);
  filter.wetGain.gain.setTargetAtTime(wet, now, PARAM_RAMP_TIME_CONSTANT_S);

  filter.outputGain.gain.setTargetAtTime(filter.output / 100, now, PARAM_RAMP_TIME_CONSTANT_S);
}
