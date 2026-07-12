import { FilterType, ReverbRoom } from '../domain/TrackState';

/**
 * AudioEngine — infrastructure layer wrapping the Web Audio API.
 *
 * Each track owns:
 *   - AudioBufferSourceNode  (re-created on every play, as per Web Audio spec)
 *   - GainNode               (persists, controls volume)
 *   - Reverb subgraph        (persists, insert effect — see ReverbNodes below)
 */

const FADE_DURATION = 5;      // seconds (play/stop fades)
const SEEK_FADE_DURATION = 2; // seconds (seek cross-fade)

// Lowpass cutoff range shared by the delay "tone" and reverb "damping"
// controls: 0% = no damping (fully open, bright), 100% = heavy damping
// (dark, muffled).
const DAMPING_MIN_HZ = 500;
const DAMPING_MAX_HZ = 20000;

// duration (seconds) and decay exponent for each room preset's synthesised
// impulse response. Higher decay = faster fade to silence.
const ROOM_IR_PRESETS: Record<ReverbRoom, { duration: number; decay: number }> = {
  'small-room': { duration: 0.4, decay: 3 },
  hall: { duration: 2.2, decay: 2 },
  plate: { duration: 1.4, decay: 2.5 },
  cathedral: { duration: 4.5, decay: 1.5 },
};

// Delay time is user-controllable up to 2 s; createDelay() needs this as its
// maxDelayTime up front.
const DELAY_TIME_MAX_S = 2.0;
const DELAY_TIME_MAX_MS = DELAY_TIME_MAX_S * 1000;
// Feedback is capped below 100% so the delay→feedbackGain→damping→delay loop
// gain always stays under 1.0 — repeats decay to silence and never runaway
// or self-oscillate.
const DELAY_FEEDBACK_MAX = 90;

// Practical sweep range for the filter's cutoff frequency and resonance (Q).
const FILTER_CUTOFF_MIN_HZ = 20;
const FILTER_CUTOFF_MAX_HZ = 20000;
const FILTER_RESONANCE_MIN = 0.1;
const FILTER_RESONANCE_MAX = 20;

/**
 * Per-track filter insert: dry/wet split around a single BiquadFilterNode.
 * `outputGain` is intentionally left unconnected by `_createFilterNodes` —
 * this insert sits before delay in the chain, so the caller (`addTrack`)
 * wires `outputGain` onward into delay's entry points.
 */
interface FilterNodes {
  dryGain: GainNode;
  biquadFilter: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  type: FilterType;
  cutoff: number;      // 20–20000 (Hz)
  resonance: number;   // 0.1–20 (Q)
  mix: number;         // 0–100 (%)
  outputLevel: number; // 0–100 (%)
}

/**
 * Per-track delay/echo insert: dry/wet split around a DelayNode with an
 * internal feedback loop. `outputGain` is intentionally left unconnected by
 * `_createDelayNodes` — this insert sits before reverb in the chain, so the
 * caller (`addTrack`) wires `outputGain` onward into reverb's entry points.
 */
interface DelayNodes {
  dryGain: GainNode;
  delayNode: DelayNode;
  feedbackGain: GainNode;
  damping: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  delayTimeMs: number;    // 1–2000 (ms)
  feedback: number;       // 0–90 (%)
  mix: number;            // 0–100 (%)
  dampingAmount: number;  // 0–100 (%)
  outputLevel: number;    // 0–100 (%)
}

/** Per-track reverb insert: GainNode → [dry/wet split] → outputGain → masterGain. */
interface ReverbNodes {
  dryGain: GainNode;
  preDelay: DelayNode;
  convolver: ConvolverNode;
  damping: BiquadFilterNode;
  wetGain: GainNode;
  outputGain: GainNode;
  room: ReverbRoom;
  mix: number;        // 0–100 (%)
  preDelayMs: number;  // 0–500 (ms)
  dampingAmount: number; // 0–100 (%)
  outputLevel: number; // 0–100 (%)
}

interface TrackNodes {
  gainNode: GainNode;
  filter: FilterNodes;
  delay: DelayNodes;
  reverb: ReverbNodes;
  sourceNode: AudioBufferSourceNode | null;
  buffer: AudioBuffer;
  startOffset: number;   // seconds — where playback was paused
  startedAt: number;     // audioContext.currentTime when last play() called
  loop: boolean;
  playing: boolean;
  volume: number;        // target volume (0–1), independent of gain ramp
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
  fadeInDuration: number;   // seconds (0–10)
  fadeOutDuration: number;  // seconds (0–10)
  seekFadeDuration: number; // seconds (0–10)
  fadeOutTimer: ReturnType<typeof setTimeout> | null;
}

export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly recorderDest: MediaStreamAudioDestinationNode;
  private readonly tracks: Map<string, TrackNodes> = new Map();
  // Synthesised impulse responses are pure data (no per-track parameters),
  // so one buffer per room preset is safely shared across every ConvolverNode.
  private readonly impulseResponses: Map<ReverbRoom, AudioBuffer> = new Map();

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.recorderDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.recorderDest);
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  /** Returns the MediaStream that captures the full mixed output. */
  getRecordingStream(): MediaStream {
    return this.recorderDest.stream;
  }

  // ── Track management ───────────────────────────────────────────────────────

  addTrack(id: string, buffer: AudioBuffer): void {
    const gainNode = this.ctx.createGain();
    const filter = this._createFilterNodes();
    const delay = this._createDelayNodes();
    const reverb = this._createReverbNodes();

    // Chain order: gainNode → filter insert → delay insert → reverb insert → masterGain.
    gainNode.connect(filter.dryGain);
    gainNode.connect(filter.biquadFilter);
    filter.outputGain.connect(delay.dryGain);
    filter.outputGain.connect(delay.delayNode);
    delay.outputGain.connect(reverb.dryGain);
    delay.outputGain.connect(reverb.preDelay);

    this.tracks.set(id, {
      gainNode,
      filter,
      delay,
      reverb,
      sourceNode: null,
      buffer,
      startOffset: 0,
      startedAt: 0,
      loop: false,
      playing: false,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      seekFade: false,
      fadeInDuration: 5,
      fadeOutDuration: 5,
      seekFadeDuration: 2,
      fadeOutTimer: null,
    });
  }

  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;
    this._cancelFadeOut(track);
    this._stopSource(track);
    track.gainNode.disconnect();
    track.filter.dryGain.disconnect();
    track.filter.biquadFilter.disconnect();
    track.filter.wetGain.disconnect();
    track.filter.outputGain.disconnect();
    track.delay.dryGain.disconnect();
    track.delay.delayNode.disconnect();
    track.delay.feedbackGain.disconnect();
    track.delay.damping.disconnect();
    track.delay.wetGain.disconnect();
    track.delay.outputGain.disconnect();
    track.reverb.dryGain.disconnect();
    track.reverb.preDelay.disconnect();
    track.reverb.convolver.disconnect();
    track.reverb.damping.disconnect();
    track.reverb.wetGain.disconnect();
    track.reverb.outputGain.disconnect();
    this.tracks.delete(id);
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  play(id: string): void {
    const track = this.tracks.get(id);
    if (!track || track.playing) return;

    // If a fade-out was in progress (source still running), cancel it cleanly
    this._cancelFadeOut(track);

    if (this.ctx.state === 'suspended') this.ctx.resume();

    // When loop and any fade are both active, manage looping manually so that
    // gain automations (fade-out near end, fade-in at restart) can be
    // re-applied on every loop cycle.
    if (track.loop && (track.fadeIn || track.fadeOut)) {
      this._playLoopWithFade(track);
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = track.loop;
    source.connect(track.gainNode);

    source.onended = () => {
      if (track.sourceNode === source) {
        track.playing = false;
        track.startOffset = 0;
        track.sourceNode = null;
      }
    };

    // Apply fade-in: start gain at 0 and ramp up to target volume
    if (track.fadeIn) {
      track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      track.gainNode.gain.linearRampToValueAtTime(
        track.volume,
        this.ctx.currentTime + track.fadeInDuration,
      );
    } else {
      track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gainNode.gain.setValueAtTime(track.volume, this.ctx.currentTime);
    }

    source.start(0, track.startOffset);
    track.sourceNode = source;
    track.startedAt = this.ctx.currentTime;
    track.playing = true;
  }

  pause(id: string): void {
    const track = this.tracks.get(id);
    if (!track || !track.playing) return;

    if (track.fadeOut) {
      const savedOffset = this.getCurrentTime(id);
      track.playing = false;
      track.startOffset = savedOffset;
      this._startFadeOut(track, () => {});
    } else {
      track.startOffset = this.getCurrentTime(id);
      this._stopSource(track);
      track.playing = false;
    }
  }

  stop(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;

    this._cancelFadeOut(track);
    // Cancel any fade-in ramp and restore volume
    track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    track.gainNode.gain.setValueAtTime(track.volume, this.ctx.currentTime);

    if (track.fadeOut && track.playing) {
      track.playing = false;
      this._startFadeOut(track, () => {
        track.startOffset = 0;
      });
    } else {
      this._stopSource(track);
      track.playing = false;
      track.startOffset = 0;
    }
  }

  stopAll(): void {
    for (const id of this.tracks.keys()) {
      this.stop(id);
    }
  }

  playAll(): void {
    for (const id of this.tracks.keys()) {
      this.play(id);
    }
  }

  seek(id: string, seconds: number): void {
    const track = this.tracks.get(id);
    if (!track) return;

    const wasPlaying = track.playing;

    if (wasPlaying && track.seekFade) {
      // ── Seek with cross-fade ──────────────────────────────────────────────
      // Cancel any existing fade so we start fresh.
      this._cancelFadeOut(track);

      // Fade out current audio over seekFadeDuration seconds.
      track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, this.ctx.currentTime);
      track.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + track.seekFadeDuration);

      track.fadeOutTimer = setTimeout(() => {
        track.fadeOutTimer = null;
        this._stopSource(track);
        track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        track.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

        track.startOffset = Math.max(0, Math.min(seconds, track.buffer.duration));
        track.playing = false;

        // Resume playback with fade-in from the new position.
        if (this.ctx.state === 'suspended') void this.ctx.resume();

        // If loop+fade mode is active, delegate to the loop manager so that
        // per-cycle automations are set up correctly.
        if (track.loop && (track.fadeIn || track.fadeOut)) {
          this._playLoopWithFade(track);
          return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = track.buffer;
        source.loop = track.loop;
        source.connect(track.gainNode);

        source.onended = () => {
          if (track.sourceNode === source) {
            track.playing = false;
            track.startOffset = 0;
            track.sourceNode = null;
          }
        };

        // Fade in to target volume.
        track.gainNode.gain.linearRampToValueAtTime(
          track.volume,
          this.ctx.currentTime + track.seekFadeDuration,
        );

        source.start(0, track.startOffset);
        track.sourceNode = source;
        track.startedAt = this.ctx.currentTime;
        track.playing = true;
      }, track.seekFadeDuration * 1000);

      return;
    }

    // ── Instant seek (default) ────────────────────────────────────────────
    this._cancelFadeOut(track);
    track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    track.gainNode.gain.setValueAtTime(track.volume, this.ctx.currentTime);
    if (wasPlaying) this._stopSource(track);

    track.startOffset = Math.max(0, Math.min(seconds, track.buffer.duration));
    track.playing = false;

    if (wasPlaying) this.play(id);
  }

  // ── Volume ─────────────────────────────────────────────────────────────────

  setVolume(id: string, value: number): void {
    const track = this.tracks.get(id);
    if (!track) return;
    track.volume = Math.max(0, Math.min(1, value));
    // Cancel any ongoing fade ramp and jump to the new volume immediately
    track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    track.gainNode.gain.setTargetAtTime(track.volume, this.ctx.currentTime, 0.01);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  setLoop(id: string, loop: boolean): void {
    const track = this.tracks.get(id);
    if (!track) return;
    track.loop = loop;
    if (track.sourceNode) track.sourceNode.loop = loop;
  }

  // ── Fade ───────────────────────────────────────────────────────────────────

  setFadeIn(id: string, enabled: boolean): void {
    const track = this.tracks.get(id);
    if (track) track.fadeIn = enabled;
  }

  setFadeOut(id: string, enabled: boolean): void {
    const track = this.tracks.get(id);
    if (track) track.fadeOut = enabled;
  }

  setSeekFade(id: string, enabled: boolean): void {
    const track = this.tracks.get(id);
    if (track) track.seekFade = enabled;
  }

  setFadeDurations(
    id: string,
    fadeInDuration: number,
    fadeOutDuration: number,
    seekFadeDuration: number,
  ): void {
    const track = this.tracks.get(id);
    if (!track) return;
    track.fadeInDuration   = Math.max(0, Math.min(10, fadeInDuration));
    track.fadeOutDuration  = Math.max(0, Math.min(10, fadeOutDuration));
    track.seekFadeDuration = Math.max(0, Math.min(10, seekFadeDuration));
  }

  // ── Filter (insert effect) ──────────────────────────────────────────────────

  setFilterSettings(
    id: string,
    type: FilterType,
    cutoff: number,
    resonance: number,
    mix: number,
    outputLevel: number,
  ): void {
    const track = this.tracks.get(id);
    if (!track) return;
    const filter = track.filter;
    const now = this.ctx.currentTime;

    filter.type = type;
    filter.cutoff = Math.max(FILTER_CUTOFF_MIN_HZ, Math.min(FILTER_CUTOFF_MAX_HZ, cutoff));
    filter.resonance = Math.max(FILTER_RESONANCE_MIN, Math.min(FILTER_RESONANCE_MAX, resonance));
    filter.mix = Math.max(0, Math.min(100, mix));
    filter.outputLevel = Math.max(0, Math.min(100, outputLevel));

    // `type` is not an AudioParam, so it switches instantly — same as
    // reverb's instant `convolver.buffer` swap on room change.
    filter.biquadFilter.type = filter.type;
    filter.biquadFilter.frequency.setTargetAtTime(filter.cutoff, now, 0.01);
    filter.biquadFilter.Q.setTargetAtTime(filter.resonance, now, 0.01);

    const wet = filter.mix / 100;
    filter.dryGain.gain.setTargetAtTime(1 - wet, now, 0.01);
    filter.wetGain.gain.setTargetAtTime(wet, now, 0.01);

    filter.outputGain.gain.setTargetAtTime(filter.outputLevel / 100, now, 0.01);
  }

  // ── Delay (insert effect) ───────────────────────────────────────────────────

  setDelaySettings(
    id: string,
    delayTimeMs: number,
    feedback: number,
    mix: number,
    dampingAmount: number,
    outputLevel: number,
  ): void {
    const track = this.tracks.get(id);
    if (!track) return;
    const delay = track.delay;
    const now = this.ctx.currentTime;

    // Floor of 1ms (not 0) because this DelayNode sits inside a feedback
    // cycle, unlike reverb's preDelay which doesn't.
    delay.delayTimeMs = Math.max(1, Math.min(DELAY_TIME_MAX_MS, delayTimeMs));
    delay.feedback = Math.max(0, Math.min(DELAY_FEEDBACK_MAX, feedback));
    delay.mix = Math.max(0, Math.min(100, mix));
    delay.dampingAmount = Math.max(0, Math.min(100, dampingAmount));
    delay.outputLevel = Math.max(0, Math.min(100, outputLevel));

    delay.delayNode.delayTime.setTargetAtTime(delay.delayTimeMs / 1000, now, 0.01);
    delay.feedbackGain.gain.setTargetAtTime(delay.feedback / 100, now, 0.01);

    const wet = delay.mix / 100;
    delay.dryGain.gain.setTargetAtTime(1 - wet, now, 0.01);
    delay.wetGain.gain.setTargetAtTime(wet, now, 0.01);

    const dampingRatio = delay.dampingAmount / 100;
    const frequency = DAMPING_MAX_HZ - dampingRatio * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
    delay.damping.frequency.setTargetAtTime(frequency, now, 0.01);

    delay.outputGain.gain.setTargetAtTime(delay.outputLevel / 100, now, 0.01);
  }

  // ── Reverb (insert effect) ──────────────────────────────────────────────────

  setReverbSettings(
    id: string,
    room: ReverbRoom,
    mix: number,
    preDelayMs: number,
    dampingAmount: number,
    outputLevel: number,
  ): void {
    const track = this.tracks.get(id);
    if (!track) return;
    const reverb = track.reverb;
    const now = this.ctx.currentTime;

    reverb.room = room;
    reverb.mix = Math.max(0, Math.min(100, mix));
    reverb.preDelayMs = Math.max(0, Math.min(500, preDelayMs));
    reverb.dampingAmount = Math.max(0, Math.min(100, dampingAmount));
    reverb.outputLevel = Math.max(0, Math.min(100, outputLevel));

    reverb.convolver.buffer = this._getImpulseResponse(reverb.room);

    const wet = reverb.mix / 100;
    reverb.dryGain.gain.setTargetAtTime(1 - wet, now, 0.01);
    reverb.wetGain.gain.setTargetAtTime(wet, now, 0.01);

    reverb.preDelay.delayTime.setTargetAtTime(reverb.preDelayMs / 1000, now, 0.01);

    const dampingRatio = reverb.dampingAmount / 100;
    const frequency = DAMPING_MAX_HZ - dampingRatio * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
    reverb.damping.frequency.setTargetAtTime(frequency, now, 0.01);

    reverb.outputGain.gain.setTargetAtTime(reverb.outputLevel / 100, now, 0.01);
  }

  // ── State queries ──────────────────────────────────────────────────────────

  getCurrentTime(id: string): number {
    const track = this.tracks.get(id);
    if (!track) return 0;
    if (!track.playing) return track.startOffset;
    const elapsed = this.ctx.currentTime - track.startedAt;
    const raw = track.startOffset + elapsed;
    if (track.loop) {
      return raw % track.buffer.duration;
    }
    return Math.min(raw, track.buffer.duration);
  }

  isPlaying(id: string): boolean {
    return this.tracks.get(id)?.playing ?? false;
  }

  getDuration(id: string): number {
    return this.tracks.get(id)?.buffer.duration ?? 0;
  }

  /** Returns the decoded AudioBuffer backing a track, e.g. for cloning it into a new track. */
  getBuffer(id: string): AudioBuffer | undefined {
    return this.tracks.get(id)?.buffer;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  close(): void {
    for (const id of Array.from(this.tracks.keys())) {
      this.removeTrack(id);
    }
    this.masterGain.disconnect();
    void this.ctx.close();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Builds the per-track filter insert and wires its internal routing:
   *   dryGain ─────────────────────────┐
   *   biquadFilter ──────────→ wetGain ┴→ outputGain
   * Callers connect the track's GainNode into both dryGain and biquadFilter,
   * and connect outputGain onward (into delay's entry points, since filter
   * sits before delay in the chain).
   */
  private _createFilterNodes(): FilterNodes {
    const dryGain      = this.ctx.createGain();
    const biquadFilter = this.ctx.createBiquadFilter();
    const wetGain      = this.ctx.createGain();
    const outputGain   = this.ctx.createGain();

    biquadFilter.connect(wetGain);
    dryGain.connect(outputGain);
    wetGain.connect(outputGain);
    // outputGain intentionally left unconnected here — see addTrack().

    const filter: FilterNodes = {
      dryGain,
      biquadFilter,
      wetGain,
      outputGain,
      type: 'lowpass',
      cutoff: 1000,
      resonance: 1,
      mix: 0,
      outputLevel: 100,
    };

    // Initialise gains/filter to match the default (mix = 0 ⇒ fully dry).
    dryGain.gain.value = 1;
    wetGain.gain.value = 0;
    biquadFilter.type = filter.type;
    biquadFilter.frequency.value = filter.cutoff;
    biquadFilter.Q.value = filter.resonance;
    outputGain.gain.value = filter.outputLevel / 100;

    return filter;
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
  private _createDelayNodes(): DelayNodes {
    const dryGain      = this.ctx.createGain();
    const delayNode    = this.ctx.createDelay(DELAY_TIME_MAX_S);
    const feedbackGain = this.ctx.createGain();
    const damping      = this.ctx.createBiquadFilter();
    const wetGain      = this.ctx.createGain();
    const outputGain   = this.ctx.createGain();

    damping.type = 'lowpass';

    // Feedback cycle: legal because delayNode carries inherent non-zero
    // delay (Web Audio requires >=1 DelayNode with delay in any cycle).
    delayNode.connect(wetGain);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(damping);
    damping.connect(delayNode);

    dryGain.connect(outputGain);
    wetGain.connect(outputGain);
    // outputGain intentionally left unconnected here — see addTrack().

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
      outputLevel: 100,
    };

    // Initialise gains/filter to match the default (mix = 0 ⇒ fully dry).
    dryGain.gain.value = 1;
    wetGain.gain.value = 0;
    delayNode.delayTime.value = delay.delayTimeMs / 1000;
    feedbackGain.gain.value = delay.feedback / 100;
    damping.frequency.value = DAMPING_MAX_HZ - (delay.dampingAmount / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
    outputGain.gain.value = delay.outputLevel / 100;

    return delay;
  }

  /**
   * Builds the per-track reverb insert and wires its internal routing:
   *   dryGain ────────────────────────────────┐
   *   preDelay → convolver → damping → wetGain ┴→ outputGain → masterGain
   * Callers connect the track's GainNode into both dryGain and preDelay.
   */
  private _createReverbNodes(): ReverbNodes {
    const dryGain    = this.ctx.createGain();
    const preDelay   = this.ctx.createDelay(0.5);
    const convolver  = this.ctx.createConvolver();
    const damping    = this.ctx.createBiquadFilter();
    const wetGain    = this.ctx.createGain();
    const outputGain = this.ctx.createGain();

    damping.type = 'lowpass';
    convolver.normalize = true;

    preDelay.connect(convolver);
    convolver.connect(damping);
    damping.connect(wetGain);
    dryGain.connect(outputGain);
    wetGain.connect(outputGain);
    outputGain.connect(this.masterGain);

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
      outputLevel: 100,
    };

    // Initialise gains/filter to match the default (mix = 0 ⇒ fully dry).
    dryGain.gain.value = 1;
    wetGain.gain.value = 0;
    preDelay.delayTime.value = reverb.preDelayMs / 1000;
    damping.frequency.value = DAMPING_MAX_HZ - (reverb.dampingAmount / 100) * (DAMPING_MAX_HZ - DAMPING_MIN_HZ);
    outputGain.gain.value = reverb.outputLevel / 100;
    convolver.buffer = this._getImpulseResponse(reverb.room);

    return reverb;
  }

  /** Synthesises (and caches) a noise-burst impulse response for a room preset. */
  private _getImpulseResponse(room: ReverbRoom): AudioBuffer {
    const cached = this.impulseResponses.get(room);
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

    this.impulseResponses.set(room, impulse);
    return impulse;
  }

  private _stopSource(track: TrackNodes): void {
    if (track.sourceNode) {
      try { track.sourceNode.stop(); } catch (_) { /* already stopped */ }
      track.sourceNode.disconnect();
      track.sourceNode = null;
    }
  }

  /**
   * Plays one loop iteration of `track`, scheduling sample-accurate gain
   * automations for fade-in and/or fade-out.  When the source ends naturally
   * it re-invokes itself for the next cycle (manual looping), so the envelope
   * is freshly applied every time.
   *
   * Fade-out begins FADE_DURATION seconds before the buffer's end, reaching
   * silence exactly at the loop point.  Fade-in ramps from silence to the
   * target volume over FADE_DURATION seconds at the start of each cycle.
   * For buffers shorter than 2×FADE_DURATION the two ramps meet at the
   * midpoint so there is always a smooth V-shape.
   */
  private _playLoopWithFade(track: TrackNodes): void {
    const now          = this.ctx.currentTime;
    const iterOffset   = track.startOffset;
    const iterDuration = track.buffer.duration - iterOffset;

    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop   = false; // looping is managed manually here
    source.connect(track.gainNode);

    source.onended = () => {
      // Guard: only act if this source is still the active one and playing.
      if (track.sourceNode !== source || !track.playing) return;
      source.disconnect();
      if (track.loop) {
        // Start the next iteration from the beginning of the buffer.
        track.startOffset = 0;
        this._playLoopWithFade(track);
      } else {
        track.playing     = false;
        track.startOffset = 0;
        track.sourceNode  = null;
      }
    };

    // ── Schedule the gain envelope for this iteration ─────────────────────
    track.gainNode.gain.cancelScheduledValues(now);

    if (track.fadeIn && track.fadeOut) {
      // Fade in from silence, hold at target volume, fade out to silence.
      const fadeInEnd    = Math.min(track.fadeInDuration,  iterDuration / 2);
      const fadeOutStart = Math.max(iterDuration - track.fadeOutDuration, iterDuration / 2);
      track.gainNode.gain.setValueAtTime(0, now);
      track.gainNode.gain.linearRampToValueAtTime(track.volume, now + fadeInEnd);
      // Anchor at target volume so the ramp-down starts from the right point.
      track.gainNode.gain.setValueAtTime(track.volume, now + fadeOutStart);
      track.gainNode.gain.linearRampToValueAtTime(0, now + iterDuration);
    } else if (track.fadeIn) {
      const fadeInEnd = Math.min(track.fadeInDuration, iterDuration);
      track.gainNode.gain.setValueAtTime(0, now);
      track.gainNode.gain.linearRampToValueAtTime(track.volume, now + fadeInEnd);
      // Gain holds at track.volume for the remainder (no further automations).
    } else if (track.fadeOut) {
      const fadeOutStart = Math.max(iterDuration - track.fadeOutDuration, 0);
      track.gainNode.gain.setValueAtTime(track.volume, now);
      // Anchor keeps gain steady until fade-out should begin.
      track.gainNode.gain.setValueAtTime(track.volume, now + fadeOutStart);
      track.gainNode.gain.linearRampToValueAtTime(0, now + iterDuration);
    }

    source.start(now, iterOffset);
    track.sourceNode  = source;
    track.startedAt   = now;
    track.playing     = true;
  }

  /** Ramps gain to 0 over track.fadeOutDuration, then calls _stopSource + afterStop cb. */
  private _startFadeOut(track: TrackNodes, afterStop: () => void): void {
    track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, this.ctx.currentTime);
    track.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + track.fadeOutDuration);

    track.fadeOutTimer = setTimeout(() => {
      this._stopSource(track);
      track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gainNode.gain.setValueAtTime(track.volume, this.ctx.currentTime);
      track.fadeOutTimer = null;
      afterStop();
    }, track.fadeOutDuration * 1000);
  }

  /** Cancels a pending fade-out, stops the source, and restores gain. */
  private _cancelFadeOut(track: TrackNodes): void {
    if (track.fadeOutTimer !== null) {
      clearTimeout(track.fadeOutTimer);
      track.fadeOutTimer = null;
      this._stopSource(track);
      track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gainNode.gain.setValueAtTime(track.volume, this.ctx.currentTime);
    }
  }
}
