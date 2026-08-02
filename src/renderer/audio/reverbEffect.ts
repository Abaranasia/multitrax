import { ReverbRoom } from '../domain/TrackState';
import { ReverbSettings } from './effectSettings';
import { clamp, PARAM_RAMP_TIME_CONSTANT_S } from './audioParams';
import { createDryWetOutput, DAMPING_MIN_HZ, DAMPING_MAX_HZ } from './effectShared';

// duration (seconds) and decay exponent for each room preset's synthesised
// impulse response. Higher decay = faster fade to silence.
const ROOM_IR_PRESETS: Record<ReverbRoom, { duration: number; decay: number }> = {
  'small-room': { duration: 0.4, decay: 3 },
  hall: { duration: 2.2, decay: 2 },
  plate: { duration: 1.4, decay: 2.5 },
  cathedral: { duration: 4.5, decay: 1.5 },
};

// Reverb pre-delay clamp ceiling (ms). Distinct from DAMPING_MIN_HZ —
// same literal value, unrelated semantics.
export const REVERB_PREDELAY_MAX_MS = 500;

/** Per-track reverb insert: GainNode → [dry/wet split] → outputGain → pannerNode. */
export interface ReverbNodes {
  dryGain: GainNode;
  preDelay: DelayNode;
  convolver: ConvolverNode;
  damping: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  room: ReverbRoom;
  mix: number; // 0–100 (%)
  preDelayMs: number; // 0–500 (ms)
  dampingAmount: number; // 0–100 (%)
  output: number; // 0–100 (%)
}

/**
 * Synthesises (and caches) noise-burst impulse responses for room presets.
 * Owned per-`AudioEngine` instance (constructed once, passed around) rather
 * than a module-level singleton, so each engine instance keeps its own
 * independent cache.
 */
export class ImpulseResponseCache {
  private readonly cache = new Map<ReverbRoom, AudioBuffer>();

  constructor(private readonly ctx: AudioContext) {}

  /** Synthesises (and caches) a noise-burst impulse response for a room preset. */
  get(room: ReverbRoom): AudioBuffer {
    const cached = this.cache.get(room);
    if (cached) return cached;

    const { duration, decay } = ROOM_IR_PRESETS[room];
    const length = Math.max(1, Math.round(this.ctx.sampleRate * duration));
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    this.cache.set(room, impulse);
    return impulse;
  }
}

/**
 * Builds the per-track reverb insert and wires its internal routing:
 *   dryGain ────────────────────────────────┐
 *   preDelay → convolver → damping → wetGain ┴→ outputGain
 * Callers connect the track's GainNode into both dryGain and preDelay, and
 * connect outputGain onward (into the panner, since reverb no longer sits
 * last in the chain).
 */
export function createReverbNodes(ctx: AudioContext, cache: ImpulseResponseCache): ReverbNodes {
  const { dryGain, wetGain, outputGain } = createDryWetOutput(ctx);
  const preDelay = ctx.createDelay(0.5);
  const convolver = ctx.createConvolver();
  const damping = ctx.createBiquadFilter();

  damping.type = 'lowpass';
  convolver.normalize = true;

  preDelay.connect(convolver);
  convolver.connect(damping);
  damping.connect(wetGain);
  // outputGain wiring onward (into the panner, since reverb no longer sits
  // last in the chain) is done by the caller — see addTrack().

  const reverb: ReverbNodes = {
    dryGain,
    preDelay,
    convolver,
    damping,
    wetGain,
    outputGain,
    room: 'hall',
    mix: 0,
    preDelayMs: 20,
    dampingAmount: 50,
    output: 100,
  };

  // Initialise the reverb/filter to match the default (mix = 0 ⇒ fully dry).
  // Gains are already dry=1/wet=0/out=1 via createDryWetOutput().
  preDelay.delayTime.value = reverb.preDelayMs / 1000;
  damping.frequency.value =
    DAMPING_MAX_HZ - (reverb.dampingAmount / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
  convolver.buffer = cache.get(reverb.room);

  return reverb;
}

/** Applies (in place) a new set of reverb settings to an existing ReverbNodes instance. */
export function applyReverbSettings(
  reverb: ReverbNodes,
  s: ReverbSettings,
  now: number,
  cache: ImpulseResponseCache,
): void {
  const { room, mix, preDelay, damping, output } = s;

  reverb.room = room;
  reverb.mix = clamp(mix, 0, 100);
  reverb.preDelayMs = clamp(preDelay, 0, REVERB_PREDELAY_MAX_MS);
  reverb.dampingAmount = clamp(damping, 0, 100);
  reverb.output = clamp(output, 0, 100);

  reverb.convolver.buffer = cache.get(reverb.room);

  const wet = reverb.mix / 100;
  reverb.dryGain.gain.setTargetAtTime(1 - wet, now, PARAM_RAMP_TIME_CONSTANT_S);
  reverb.wetGain.gain.setTargetAtTime(wet, now, PARAM_RAMP_TIME_CONSTANT_S);

  reverb.preDelay.delayTime.setTargetAtTime(reverb.preDelayMs / 1000, now, PARAM_RAMP_TIME_CONSTANT_S);

  const dampingRatio = reverb.dampingAmount / 100;
  const frequency = DAMPING_MAX_HZ - dampingRatio * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
  reverb.damping.frequency.setTargetAtTime(frequency, now, PARAM_RAMP_TIME_CONSTANT_S);

  reverb.outputGain.gain.setTargetAtTime(reverb.output / 100, now, PARAM_RAMP_TIME_CONSTANT_S);
}
