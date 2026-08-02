import { DelaySettings } from './effectSettings';
import { clamp, PARAM_RAMP_TIME_CONSTANT_S } from './audioParams';
import { createDryWetOutput, DAMPING_MIN_HZ, DAMPING_MAX_HZ } from './effectShared';

// Delay time is user-controllable up to 2 s; createDelay() needs this as its
// maxDelayTime up front.
export const DELAY_TIME_MAX_S = 2.0;
export const DELAY_TIME_MAX_MS = DELAY_TIME_MAX_S * 1000;
// Feedback is capped below 100% so the delay→feedbackGain→damping→delay loop
// gain always stays under 1.0 — repeats decay to silence and never runaway
// or self-oscillate.
export const DELAY_FEEDBACK_MAX = 90;

/**
 * Per-track delay/echo insert: dry/wet split around a DelayNode with an
 * internal feedback loop. `outputGain` is intentionally left unconnected by
 * `createDelayNodes` — this insert sits before reverb in the chain, so the
 * caller (`addTrack`) wires `outputGain` onward into reverb's entry points.
 */
export interface DelayNodes {
  dryGain: GainNode;
  delayNode: DelayNode;
  feedbackGain: GainNode;
  damping: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  delayTimeMs: number; // 1–2000 (ms)
  feedback: number; // 0–90 (%)
  mix: number; // 0–100 (%)
  dampingAmount: number; // 0–100 (%)
  output: number; // 0–100 (%)
}

/**
 * Builds the per-track delay/echo insert and wires its internal routing:
 *   dryGain ─────────────────────────────────────┐
 *   delayNode ──────────────────────────→ wetGain ┴→ outputGain
 *      └→ feedbackGain → damping ─┘ (feedback loop closes back into delayNode)
 * Callers connect the track's GainNode into both dryGain and delayNode, and
 * connect outputGain onward (into reverb's entry points, since delay sits
 * before reverb in the chain).
 */
export function createDelayNodes(ctx: AudioContext): DelayNodes {
  const { dryGain, wetGain, outputGain } = createDryWetOutput(ctx);
  const delayNode = ctx.createDelay(DELAY_TIME_MAX_S);
  const feedbackGain = ctx.createGain();
  const damping = ctx.createBiquadFilter();

  damping.type = 'lowpass';

  // Feedback cycle: legal because delayNode carries inherent non-zero
  // delay (Web Audio requires >=1 DelayNode with delay in any cycle).
  delayNode.connect(wetGain);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(damping);
  damping.connect(delayNode);

  const delay: DelayNodes = {
    dryGain,
    delayNode,
    feedbackGain,
    damping,
    wetGain,
    outputGain,
    delayTimeMs: 300,
    feedback: 35,
    mix: 0,
    dampingAmount: 50,
    output: 100,
  };

  // Initialise the delay/filter to match the default (mix = 0 ⇒ fully dry).
  // Gains are already dry=1/wet=0/out=1 via createDryWetOutput().
  delayNode.delayTime.value = delay.delayTimeMs / 1000;
  feedbackGain.gain.value = delay.feedback / 100;
  damping.frequency.value =
    DAMPING_MAX_HZ - (delay.dampingAmount / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);

  return delay;
}

/** Applies (in place) a new set of delay settings to an existing DelayNodes instance. */
export function applyDelaySettings(delay: DelayNodes, s: DelaySettings, now: number): void {
  const { delayTime, feedback, mix, damping, output } = s;

  // Floor of 1ms (not 0) because this DelayNode sits inside a feedback
  // cycle, unlike reverb's preDelay which doesn't.
  delay.delayTimeMs = clamp(delayTime, 1, DELAY_TIME_MAX_MS);
  delay.feedback = clamp(feedback, 0, DELAY_FEEDBACK_MAX);
  delay.mix = clamp(mix, 0, 100);
  delay.dampingAmount = clamp(damping, 0, 100);
  delay.output = clamp(output, 0, 100);

  delay.delayNode.delayTime.setTargetAtTime(delay.delayTimeMs / 1000, now, PARAM_RAMP_TIME_CONSTANT_S);
  delay.feedbackGain.gain.setTargetAtTime(delay.feedback / 100, now, PARAM_RAMP_TIME_CONSTANT_S);

  const wet = delay.mix / 100;
  delay.dryGain.gain.setTargetAtTime(1 - wet, now, PARAM_RAMP_TIME_CONSTANT_S);
  delay.wetGain.gain.setTargetAtTime(wet, now, PARAM_RAMP_TIME_CONSTANT_S);

  const dampingRatio = delay.dampingAmount / 100;
  const frequency = DAMPING_MAX_HZ - dampingRatio * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
  delay.damping.frequency.setTargetAtTime(frequency, now, PARAM_RAMP_TIME_CONSTANT_S);

  delay.outputGain.gain.setTargetAtTime(delay.output / 100, now, PARAM_RAMP_TIME_CONSTANT_S);
}
