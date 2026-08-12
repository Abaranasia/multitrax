import {
  FilterSettings,
  DistortionSettings,
  DelaySettings,
  ReverbSettings,
} from './effectSettings';
import { clamp, PARAM_RAMP_TIME_CONSTANT_S } from './audioParams';
import { createDryWetOutput } from './effectShared';
import { FilterNodes, createFilterNodes, applyFilterSettings } from './filterEffect';
import {
  DistortionNodes,
  createDistortionNodes,
  applyDistortionSettings,
  makeDistortionCurve,
} from './distortionEffect';
import { DelayNodes, createDelayNodes, applyDelaySettings } from './delayEffect';
import {
  ReverbNodes,
  ImpulseResponseCache,
  createReverbNodes,
  applyReverbSettings,
} from './reverbEffect';

/**
 * AudioEngine — infrastructure layer wrapping the Web Audio API.
 *
 * Each track owns:
 *   - AudioBufferSourceNode  (re-created on every play, as per Web Audio spec)
 *   - GainNode               (persists, controls volume)
 *   - Reverb subgraph        (persists, insert effect — see ReverbNodes below)
 */

const FADE_DURATION = 5; // seconds (play/stop fades)
const SEEK_FADE_DURATION = 2; // seconds (seek cross-fade)

// User-settable fade-duration clamp ceiling (seconds). Distinct from
// FADE_DURATION above, which is the default play/stop fade length.
const FADE_DURATION_MAX_S = 10;

interface TrackNodes {
  gainNode: GainNode;
  filter: FilterNodes;
  distortion: DistortionNodes;
  delay: DelayNodes;
  reverb: ReverbNodes;
  pannerNode: StereoPannerNode;
  analyser: AnalyserNode;
  levelBuffer: Float32Array<ArrayBuffer>;
  sourceNode: AudioBufferSourceNode | null;
  buffer: AudioBuffer;
  startOffset: number; // seconds — where playback was paused
  startedAt: number; // audioContext.currentTime when last play() called
  loop: boolean;
  playing: boolean;
  volume: number; // target volume (0–1), independent of gain ramp
  pan: number; // target pan (-1 to 1), independent of ramp
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
  fadeInDuration: number; // seconds (0–10)
  fadeOutDuration: number; // seconds (0–10)
  seekFadeDuration: number; // seconds (0–10)
  fadeOutTimer: ReturnType<typeof setTimeout> | null;
}

export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly masterPanner: StereoPannerNode;
  private readonly masterAnalyserL: AnalyserNode;
  private readonly masterAnalyserR: AnalyserNode;
  private readonly masterLevelBufferL: Float32Array<ArrayBuffer>;
  private readonly masterLevelBufferR: Float32Array<ArrayBuffer>;
  private readonly recorderDest: MediaStreamAudioDestinationNode;
  private readonly tracks: Map<string, TrackNodes> = new Map();
  // Synthesised impulse responses are pure data (no per-track parameters),
  // so one buffer per room preset is safely shared across every ConvolverNode
  // within this engine instance.
  private readonly impulseResponses: ImpulseResponseCache;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterPanner = this.ctx.createStereoPanner();
    this.masterGain.connect(this.masterPanner);

    this.recorderDest = this.ctx.createMediaStreamDestination();
    this.masterPanner.connect(this.ctx.destination);
    this.masterPanner.connect(this.recorderDest);

    const splitter = this.ctx.createChannelSplitter(2);
    this.masterPanner.connect(splitter);
    this.masterAnalyserL = this.ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 512;
    this.masterAnalyserR = this.ctx.createAnalyser();
    this.masterAnalyserR.fftSize = 512;
    splitter.connect(this.masterAnalyserL, 0);
    splitter.connect(this.masterAnalyserR, 1);
    this.masterLevelBufferL = new Float32Array(this.masterAnalyserL.fftSize);
    this.masterLevelBufferR = new Float32Array(this.masterAnalyserR.fftSize);

    this.impulseResponses = new ImpulseResponseCache(this.ctx);
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
    const filter = createFilterNodes(this.ctx);
    const distortion = createDistortionNodes(this.ctx);
    const delay = createDelayNodes(this.ctx);
    const reverb = createReverbNodes(this.ctx, this.impulseResponses);
    const pannerNode = this.ctx.createStereoPanner();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    const levelBuffer = new Float32Array(analyser.fftSize);

    // Chain order: gainNode → filter insert → distortion insert → delay insert → reverb insert → masterGain.
    gainNode.connect(filter.dryGain);
    gainNode.connect(filter.biquadFilter);

    filter.outputGain.connect(distortion.dryGain);
    filter.outputGain.connect(distortion.waveShaper);

    distortion.outputGain.connect(delay.dryGain);
    distortion.outputGain.connect(delay.delayNode);

    delay.outputGain.connect(reverb.dryGain);
    delay.outputGain.connect(reverb.preDelay);
    reverb.outputGain.connect(pannerNode);
    // The analyser is inserted serially (pannerNode → analyser → masterGain)
    // rather than tapped in parallel off pannerNode, because AnalyserNode is
    // a unity-gain passthrough: tapping it as a second connection alongside
    // masterGain would double the signal actually reaching masterGain.
    pannerNode.connect(analyser);
    analyser.connect(this.masterGain);

    this.tracks.set(id, {
      gainNode,
      filter,
      distortion,
      delay,
      reverb,
      pannerNode,
      analyser,
      levelBuffer,
      sourceNode: null,
      buffer,
      startOffset: 0,
      startedAt: 0,
      loop: true,
      playing: false,
      volume: 1,
      pan: 0,
      fadeIn: false,
      fadeOut: false,
      seekFade: false,
      fadeInDuration: FADE_DURATION,
      fadeOutDuration: FADE_DURATION,
      seekFadeDuration: SEEK_FADE_DURATION,
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
    track.distortion.dryGain.disconnect();
    track.distortion.waveShaper.disconnect();
    track.distortion.toneFilter.disconnect();
    track.distortion.wetGain.disconnect();
    track.distortion.outputGain.disconnect();
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
    track.pannerNode.disconnect();
    track.analyser.disconnect();
    this.tracks.delete(id);
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  play(id: string): void {
    const track = this.tracks.get(id);
    if (!track || track.playing) return;

    // If a fade-out was in progress (source still running), cancel it cleanly
    this._cancelFadeOut(track);

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

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

        track.startOffset = clamp(seconds, 0, track.buffer.duration);
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

    track.startOffset = clamp(seconds, 0, track.buffer.duration);
    track.playing = false;

    if (wasPlaying) this.play(id);
  }

  // ── Volume ─────────────────────────────────────────────────────────────────

  setVolume(id: string, value: number): void {
    const track = this.tracks.get(id);
    if (!track) return;
    track.volume = clamp(value, 0, 1);
    // Cancel any ongoing fade ramp and jump to the new volume immediately
    track.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    track.gainNode.gain.setTargetAtTime(track.volume, this.ctx.currentTime, PARAM_RAMP_TIME_CONSTANT_S);
  }

  // ── Pan ────────────────────────────────────────────────────────────────────

  setPan(id: string, value: number): void {
    const track = this.tracks.get(id);
    if (!track) return;
    track.pan = clamp(value, -1, 1);
    track.pannerNode.pan.setTargetAtTime(track.pan, this.ctx.currentTime, PARAM_RAMP_TIME_CONSTANT_S);
  }

  // ── Master bus ─────────────────────────────────────────────────────────────

  setMasterVolume(value: number): void {
    const volume = clamp(value, 0, 1);
    this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, PARAM_RAMP_TIME_CONSTANT_S);
  }

  setMasterBalance(value: number): void {
    const balance = clamp(value, -1, 1);
    this.masterPanner.pan.setTargetAtTime(balance, this.ctx.currentTime, PARAM_RAMP_TIME_CONSTANT_S);
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
    track.fadeInDuration = clamp(fadeInDuration, 0, FADE_DURATION_MAX_S);
    track.fadeOutDuration = clamp(fadeOutDuration, 0, FADE_DURATION_MAX_S);
    track.seekFadeDuration = clamp(seekFadeDuration, 0, FADE_DURATION_MAX_S);
  }

  // ── Filter (insert effect) ──────────────────────────────────────────────────

  setFilterSettings(id: string, s: FilterSettings): void {
    const track = this.tracks.get(id);
    if (!track) return;
    applyFilterSettings(track.filter, s, this.ctx.currentTime);
  }

  // ── Distortion (insert effect) ──────────────────────────────────────────────

  setDistortionSettings(id: string, s: DistortionSettings): void {
    const track = this.tracks.get(id);
    if (!track) return;
    applyDistortionSettings(track.distortion, s, this.ctx.currentTime);
  }

  // ── Delay (insert effect) ───────────────────────────────────────────────────

  setDelaySettings(id: string, s: DelaySettings): void {
    const track = this.tracks.get(id);
    if (!track) return;
    applyDelaySettings(track.delay, s, this.ctx.currentTime);
  }

  // ── Reverb (insert effect) ──────────────────────────────────────────────────

  setReverbSettings(id: string, s: ReverbSettings): void {
    const track = this.tracks.get(id);
    if (!track) return;
    applyReverbSettings(track.reverb, s, this.ctx.currentTime, this.impulseResponses);
  }

  // ── Metering ───────────────────────────────────────────────────────────────

  /** Instantaneous RMS amplitude (0–1) of this track's post-fader signal, or 0 when silent/unknown. */
  getLevel(id: string): number {
    const track = this.tracks.get(id);
    if (!track || !track.playing) return 0;

    track.analyser.getFloatTimeDomainData(track.levelBuffer);
    let sumSquares = 0;
    for (const sample of track.levelBuffer) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / track.levelBuffer.length);
  }

  /** Instantaneous RMS amplitude (0–1) of the master bus's L/R channel. No playing gate — the master bus has no "playing" concept. */
  getMasterLevel(channel: 'left' | 'right'): number {
    const analyser = channel === 'left' ? this.masterAnalyserL : this.masterAnalyserR;
    const buffer = channel === 'left' ? this.masterLevelBufferL : this.masterLevelBufferR;

    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (const sample of buffer) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / buffer.length);
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

  private _createDryWetOutput() {
    return createDryWetOutput(this.ctx);
  }

  private _makeDistortionCurve(drive: number) {
    return makeDistortionCurve(drive);
  }

  private _stopSource(track: TrackNodes): void {
    if (track.sourceNode) {
      try {
        track.sourceNode.stop();
      } catch (error) {
        const isExpectedAlreadyStopped =
          error instanceof DOMException && error.name === 'InvalidStateError';
        if (!isExpectedAlreadyStopped) {
          console.error('Unexpected error stopping source node: ', error);
        }
      }
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
    const now = this.ctx.currentTime;
    const iterOffset = track.startOffset;
    const iterDuration = track.buffer.duration - iterOffset;

    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = false; // looping is managed manually here
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
        track.playing = false;
        track.startOffset = 0;
        track.sourceNode = null;
      }
    };

    // ── Schedule the gain envelope for this iteration ─────────────────────
    track.gainNode.gain.cancelScheduledValues(now);

    if (track.fadeIn && track.fadeOut) {
      // Fade in from silence, hold at target volume, fade out to silence.
      const fadeInEnd = Math.min(track.fadeInDuration, iterDuration / 2);
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
    track.sourceNode = source;
    track.startedAt = now;
    track.playing = true;
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
