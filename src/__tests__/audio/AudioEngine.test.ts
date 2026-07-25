/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine } from '@/renderer/audio/AudioEngine';

// Minimal fake implementations of AudioContext nodes
class FakeGain {
  gain: any;
  connected: boolean = false;
  connectedTo: any[] = [];
  constructor() {
    this.gain = {
      value: 1,
      cancelScheduledValues: vi.fn(() => {}),
      setValueAtTime: vi.fn((v: number) => {
        this.gain.value = v;
      }),
      linearRampToValueAtTime: vi.fn((v: number) => {
        this.gain.value = v;
      }),
      setTargetAtTime: vi.fn((v: number) => {
        this.gain.value = v;
      }),
    };
  }
  connect(dest?: any) {
    this.connected = true;
    if (dest !== undefined) this.connectedTo.push(dest);
  }
  disconnect() {
    this.connected = false;
    this.connectedTo = [];
  }
}

class FakeSource {
  buffer: any = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  connect() {}
  disconnect() {}
  start(_when: number, _offset?: number) {
    this.started = true;
  }
  stop() {
    this.started = false;
    if (this.onended) setTimeout(() => this.onended && this.onended(), 0);
  }
}

class FakeAudioParam {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeDelay {
  delayTime = new FakeAudioParam(0);
  connect() {}
  disconnect() {}
}

class FakeConvolver {
  buffer: any = null;
  normalize = true;
  connect() {}
  disconnect() {}
}

class FakeBiquadFilter {
  type = 'lowpass';
  frequency = new FakeAudioParam(20000);
  Q = new FakeAudioParam(1);
  connect() {}
  disconnect() {}
}

class FakeMediaStreamDestination {
  stream = {} as MediaStream;
}

class FakeWaveShaper {
  curve: Float32Array | null = null;
  oversample = 'none';
  connect() {}
  disconnect() {}
}

class FakePanner {
  pan = new FakeAudioParam(0);
  connect() {}
  disconnect() {}
}

class FakeAudioContext {
  currentTime: number = 0;
  sampleRate = 44100;
  destination = {};
  state: 'running' | 'suspended' = 'running';
  createGain() {
    return new FakeGain();
  }
  createMediaStreamDestination() {
    return new FakeMediaStreamDestination();
  }
  createBufferSource() {
    return new FakeSource();
  }
  createDelay(_maxDelay?: number) {
    return new FakeDelay();
  }
  createConvolver() {
    return new FakeConvolver();
  }
  createBiquadFilter() {
    return new FakeBiquadFilter();
  }
  createWaveShaper() {
    return new FakeWaveShaper();
  }
  createStereoPanner() {
    return new FakePanner();
  }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return {
      numberOfChannels,
      length,
      sampleRate,
      getChannelData: (channel: number) => channels[channel],
    };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

describe('AudioEngine (unit)', () => {
  let realAC: any;
  beforeEach(() => {
    realAC = (global as any).AudioContext;
    (global as any).AudioContext = FakeAudioContext as any;
  });

  afterEach(() => {
    (global as any).AudioContext = realAC;
  });

  it('adds a track and reports duration', () => {
    const engine = new AudioEngine();
    const buf = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t1', buf);
    expect(engine.getDuration('t1')).toBe(8);
  });

  it('enables looping by default for newly added tracks', () => {
    const engine = new AudioEngine();
    const buf = { duration: 10 } as unknown as AudioBuffer;
    engine.addTrack('t2', buf);

    const source = (engine as any).tracks.get('t2').sourceNode;
    expect(source).toBeNull();
    expect((engine as any).tracks.get('t2').loop).toBe(true);
  });

  it('plays, reports playing and currentTime progression', () => {
    const engine = new AudioEngine();
    const buf = { duration: 10 } as unknown as AudioBuffer;
    engine.addTrack('t2', buf);

    engine.play('t2');
    expect(engine.isPlaying('t2')).toBe(true);

    // advance context time
    (engine.audioContext as any).currentTime += 2.5;
    const t = engine.getCurrentTime('t2');
    expect(t).toBeGreaterThanOrEqual(2.4);

    engine.pause('t2');
    expect(engine.isPlaying('t2')).toBe(false);
    const after = engine.getCurrentTime('t2');
    expect(after).toBeGreaterThanOrEqual(2.4);
  });

  it('stops and resets current time', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t3', buf);
    engine.play('t3');
    (engine.audioContext as any).currentTime += 1.2;
    engine.stop('t3');
    expect(engine.getCurrentTime('t3')).toBe(0);
    expect(engine.isPlaying('t3')).toBe(false);
  });

  it('getBuffer returns the same buffer reference passed to addTrack, or undefined for an unknown id', () => {
    const engine = new AudioEngine();
    const buf = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t1b', buf);
    expect(engine.getBuffer('t1b')).toBe(buf);
    expect(engine.getBuffer('nonexistent')).toBeUndefined();
  });

  it('stopAll stops every playing track and resets current time', () => {
    const engine = new AudioEngine();
    const buf1 = { duration: 5 } as unknown as AudioBuffer;
    const buf2 = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t3a', buf1);
    engine.addTrack('t3b', buf2);
    engine.play('t3a');
    engine.play('t3b');
    (engine.audioContext as any).currentTime += 1.2;

    engine.stopAll();

    expect(engine.isPlaying('t3a')).toBe(false);
    expect(engine.isPlaying('t3b')).toBe(false);
    expect(engine.getCurrentTime('t3a')).toBe(0);
    expect(engine.getCurrentTime('t3b')).toBe(0);
  });

  it('playAll starts playback on every track', () => {
    const engine = new AudioEngine();
    const buf1 = { duration: 5 } as unknown as AudioBuffer;
    const buf2 = { duration: 8 } as unknown as AudioBuffer;
    engine.addTrack('t3c', buf1);
    engine.addTrack('t3d', buf2);

    engine.playAll();

    expect(engine.isPlaying('t3c')).toBe(true);
    expect(engine.isPlaying('t3d')).toBe(true);
  });

  it('setVolume clamps value and updates gain', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4', buf);
    engine.setVolume('t4', 0.5);
    engine.setVolume('t4', 2);
    // no throw; validate getDuration still works
    expect(engine.getDuration('t4')).toBe(2);
  });

  it('setVolume clamps value to [0,1] at both boundaries', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4c', buf);
    engine.setVolume('t4c', -5);
    expect((engine as any).tracks.get('t4c').volume).toBe(0);
    engine.setVolume('t4c', 5);
    expect((engine as any).tracks.get('t4c').volume).toBe(1);
  });

  it('setPan clamps value and updates the panner', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4b', buf);
    engine.setPan('t4b', -0.5);
    engine.setPan('t4b', 5); // clamps to 1
    // no throw; validate getDuration still works
    expect(engine.getDuration('t4b')).toBe(2);
  });

  it('setPan clamps value to [-1,1] at both boundaries', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4d', buf);
    engine.setPan('t4d', -5);
    expect((engine as any).tracks.get('t4d').pan).toBe(-1);
    engine.setPan('t4d', 5);
    expect((engine as any).tracks.get('t4d').pan).toBe(1);
  });

  it('setFadeDurations clamps each duration independently to [0,10]', () => {
    const engine = new AudioEngine();
    const buf = { duration: 5 } as unknown as AudioBuffer;
    engine.addTrack('t10', buf);

    engine.setFadeDurations('t10', -5, 50, -5);
    let track = (engine as any).tracks.get('t10');
    expect(track.fadeInDuration).toBe(0);
    expect(track.fadeOutDuration).toBe(10);
    expect(track.seekFadeDuration).toBe(0);

    engine.setFadeDurations('t10', 50, -5, 50);
    track = (engine as any).tracks.get('t10');
    expect(track.fadeInDuration).toBe(10);
    expect(track.fadeOutDuration).toBe(0);
    expect(track.seekFadeDuration).toBe(10);
  });

  it('seek updates offsets when not playing and when playing with seekFade', () => {
    const engine = new AudioEngine();
    const buf = { duration: 20 } as unknown as AudioBuffer;
    engine.addTrack('t5', buf);
    engine.seek('t5', 5);
    expect(engine.getCurrentTime('t5')).toBe(5);

    // Now test seek with playing + seekFade
    engine.play('t5');
    engine.setSeekFade('t5', true);
    // advance time slightly so startedAt != 0
    (engine.audioContext as any).currentTime += 0.1;
    engine.seek('t5', 3);
    // Because seek with fade schedules timeout, we fast-forward the fake timers
    // but since implementation uses setTimeout, we can just call clearTimeout path by cancelFade
    // For test purpose ensure no exception and state remains valid
    expect(engine.getDuration('t5')).toBe(20);
  });

  it('seek clamps the offset to [0, buffer.duration]', () => {
    const engine = new AudioEngine();
    const buf = { duration: 12 } as unknown as AudioBuffer;
    engine.addTrack('t5b', buf);

    engine.seek('t5b', -20);
    expect(engine.getCurrentTime('t5b')).toBe(0);

    engine.seek('t5b', 999);
    expect(engine.getCurrentTime('t5b')).toBe(12);
  });

  it('setFilterSettings updates the filter chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t9', buf);
    engine.setFilterSettings('t9', { type: 'highpass', cutoff: 500, resonance: 4, mix: 70, output: 90 });
    // no throw; engine remains valid
    expect(engine.getDuration('t9')).toBe(6);
  });

  it('setFilterSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t9b', buf);

    engine.setFilterSettings('t9b', {
      type: 'lowpass',
      cutoff: -500,
      resonance: 0,
      mix: -10,
      output: -10,
    });
    let filter = (engine as any).tracks.get('t9b').filter;
    expect(filter.cutoff).toBe(20); // FILTER_CUTOFF_MIN_HZ
    expect(filter.resonance).toBe(0.1); // FILTER_RESONANCE_MIN
    expect(filter.mix).toBe(0);
    expect(filter.outputLevel).toBe(0);

    engine.setFilterSettings('t9b', {
      type: 'lowpass',
      cutoff: 999999,
      resonance: 999,
      mix: 999,
      output: 999,
    });
    filter = (engine as any).tracks.get('t9b').filter;
    expect(filter.cutoff).toBe(20000); // FILTER_CUTOFF_MAX_HZ
    expect(filter.resonance).toBe(20); // FILTER_RESONANCE_MAX
    expect(filter.mix).toBe(100);
    expect(filter.outputLevel).toBe(100);
  });

  it('addTrack wires filter.outputGain -> distortion.dryGain/waveShaper -> distortion.outputGain -> delay.dryGain/delayNode', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td1', buf);
    const track = (engine as any).tracks.get('td1');
    const { filter, distortion, delay } = track;

    expect(filter.outputGain.connectedTo).toContain(distortion.dryGain);
    expect(filter.outputGain.connectedTo).toContain(distortion.waveShaper);
    expect(distortion.outputGain.connectedTo).toContain(delay.dryGain);
    expect(distortion.outputGain.connectedTo).toContain(delay.delayNode);
  });

  it('addTrack wires delay.outputGain -> reverb.dryGain/preDelay -> reverb.outputGain -> pannerNode', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td4', buf);
    const track = (engine as any).tracks.get('td4');
    const { delay, reverb, pannerNode } = track;

    expect(delay.outputGain.connectedTo).toContain(reverb.dryGain);
    expect(delay.outputGain.connectedTo).toContain(reverb.preDelay);
    expect(reverb.outputGain.connectedTo).toContain(pannerNode);
  });

  it('_createDryWetOutput builds a dry/wet/output gain triple wired dry->out and wet->out, initialised to dry=1/wet=0/out=1', () => {
    const engine = new AudioEngine();
    const { dryGain, wetGain, outputGain } = (engine as any)._createDryWetOutput();

    expect(dryGain.gain.value).toBe(1);
    expect(wetGain.gain.value).toBe(0);
    expect(outputGain.gain.value).toBe(1);
    expect(dryGain.connectedTo).toContain(outputGain);
    expect(wetGain.connectedTo).toContain(outputGain);
  });

  it('each effect insert wires its own dryGain/wetGain into its own outputGain (via the shared factory)', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td5', buf);
    const { filter, distortion, delay, reverb } = (engine as any).tracks.get('td5');

    for (const insert of [filter, distortion, delay, reverb]) {
      expect(insert.dryGain.connectedTo).toContain(insert.outputGain);
      expect(insert.wetGain.connectedTo).toContain(insert.outputGain);
    }
  });

  it('setDistortionSettings updates existing distortion nodes without throwing or recreating them', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td2', buf);
    const before = (engine as any).tracks.get('td2').distortion;

    engine.setDistortionSettings('td2', { drive: 70, tone: 40, mix: 60, output: 80 });

    const after = (engine as any).tracks.get('td2').distortion;
    expect(after).toBe(before);
    expect(after.drive).toBe(70);
    expect(after.tone).toBe(40);
    expect(after.mix).toBe(60);
    expect(after.outputLevel).toBe(80);
  });

  it('setDistortionSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td2b', buf);

    engine.setDistortionSettings('td2b', { drive: -10, tone: -10, mix: -10, output: -10 });
    let distortion = (engine as any).tracks.get('td2b').distortion;
    expect(distortion.drive).toBe(0);
    expect(distortion.tone).toBe(0);
    expect(distortion.mix).toBe(0);
    expect(distortion.outputLevel).toBe(0);

    engine.setDistortionSettings('td2b', { drive: 999, tone: 999, mix: 999, output: 999 });
    distortion = (engine as any).tracks.get('td2b').distortion;
    expect(distortion.drive).toBe(100);
    expect(distortion.tone).toBe(100);
    expect(distortion.mix).toBe(100);
    expect(distortion.outputLevel).toBe(100);
  });

  it('_makeDistortionCurve is a near-identity pass-through at drive=0 and increasingly compressive at higher |x| for drive=100', () => {
    const engine = new AudioEngine();
    const curve0: Float32Array = (engine as any)._makeDistortionCurve(0);
    const curve100: Float32Array = (engine as any)._makeDistortionCurve(100);
    const n = curve0.length;
    const sampleAt = (curve: Float32Array, x: number) =>
      curve[Math.round(((x + 1) * n) / 2)];

    const lowX = 0.2;
    const highX = 0.9;

    // At drive=0 the curve is linear: the effective gain (curve/x) stays
    // constant across x, so it introduces no audible saturation.
    const ratioLow0 = sampleAt(curve0, lowX) / lowX;
    const ratioHigh0 = sampleAt(curve0, highX) / highX;
    expect(ratioHigh0).toBeCloseTo(ratioLow0, 2);

    // Per spec ("Drive at 0 is near-transparent"), that constant gain must
    // also be close to unity — NOT a fixed attenuation (the classic
    // (3+k)*x*20*deg/(pi+k|x|) formula, taken verbatim, reduces to x/3 at
    // k=0, which is a ~-9.5dB cut, not near-identity).
    expect(ratioLow0).toBeGreaterThan(0.98);
    expect(ratioLow0).toBeLessThan(1.02);
    expect(ratioHigh0).toBeGreaterThan(0.98);
    expect(ratioHigh0).toBeLessThan(1.02);

    // At drive=100 the curve compresses harder as |x| grows, so the
    // effective gain at highX is measurably lower than at lowX.
    const ratioLow100 = sampleAt(curve100, lowX) / lowX;
    const ratioHigh100 = sampleAt(curve100, highX) / highX;
    expect(ratioHigh100).toBeLessThan(ratioLow100);
  });

  it('_makeDistortionCurve stays within a sane amplitude range and preserves sign across the full drive sweep', () => {
    const engine = new AudioEngine();
    const n = 44100;
    const sampleAt = (curve: Float32Array, x: number) =>
      curve[Math.round(((x + 1) * n) / 2)];
    const sampleXs = [0.1, 0.3, 0.5, 0.7, 0.9];

    for (const drive of [0, 25, 50, 75, 100]) {
      const curve: Float32Array = (engine as any)._makeDistortionCurve(drive);
      for (const x of sampleXs) {
        const y = sampleAt(curve, x);
        expect(Math.sign(y)).toBe(Math.sign(x));
        expect(Math.abs(y)).toBeLessThan(2);
      }
    }
  });

  it('removeTrack disconnects all distortion nodes', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td3', buf);
    const distortion = (engine as any).tracks.get('td3').distortion;
    const disconnectSpy = vi.spyOn(distortion.outputGain, 'disconnect');

    engine.removeTrack('td3');

    expect(disconnectSpy).toHaveBeenCalled();
    expect((engine as any).tracks.get('td3')).toBeUndefined();
  });

  it('setDelaySettings updates the delay chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t8', buf);
    engine.setDelaySettings('t8', { delayTime: 450, feedback: 60, mix: 40, damping: 30, output: 90 });
    // no throw; engine remains valid
    expect(engine.getDuration('t8')).toBe(6);
  });

  it('setDelaySettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t8b', buf);

    engine.setDelaySettings('t8b', {
      delayTime: -100,
      feedback: -10,
      mix: -10,
      damping: -10,
      output: -10,
    });
    let delay = (engine as any).tracks.get('t8b').delay;
    expect(delay.delayTimeMs).toBe(1); // floor of 1ms, not 0 (feedback-loop constraint)
    expect(delay.feedback).toBe(0);
    expect(delay.mix).toBe(0);
    expect(delay.dampingAmount).toBe(0);
    expect(delay.outputLevel).toBe(0);

    engine.setDelaySettings('t8b', {
      delayTime: 999999,
      feedback: 999,
      mix: 999,
      damping: 999,
      output: 999,
    });
    delay = (engine as any).tracks.get('t8b').delay;
    expect(delay.delayTimeMs).toBe(2000); // DELAY_TIME_MAX_MS
    expect(delay.feedback).toBe(90); // DELAY_FEEDBACK_MAX
    expect(delay.mix).toBe(100);
    expect(delay.dampingAmount).toBe(100);
    expect(delay.outputLevel).toBe(100);
  });

  it('setReverbSettings updates the reverb chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t7', buf);
    engine.setReverbSettings('t7', {
      room: 'cathedral',
      mix: 60,
      preDelay: 100,
      damping: 20,
      output: 80,
    });
    // no throw; engine remains valid
    expect(engine.getDuration('t7')).toBe(6);
  });

  it('setReverbSettings clamps each parameter to its pre-refactor documented range', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t7b', buf);

    engine.setReverbSettings('t7b', {
      room: 'hall',
      mix: -10,
      preDelay: -10,
      damping: -10,
      output: -10,
    });
    let reverb = (engine as any).tracks.get('t7b').reverb;
    expect(reverb.mix).toBe(0);
    expect(reverb.preDelayMs).toBe(0);
    expect(reverb.dampingAmount).toBe(0);
    expect(reverb.outputLevel).toBe(0);

    engine.setReverbSettings('t7b', { room: 'hall', mix: 999, preDelay: 999, damping: 999, output: 999 });
    reverb = (engine as any).tracks.get('t7b').reverb;
    expect(reverb.mix).toBe(100);
    expect(reverb.preDelayMs).toBe(500); // pre-delay max is 500ms, unlike delay's 2000ms
    expect(reverb.dampingAmount).toBe(100);
    expect(reverb.outputLevel).toBe(100);
  });

  it('close disconnects tracks and closes context', () => {
    const engine = new AudioEngine();
    const buf = { duration: 4 } as unknown as AudioBuffer;
    engine.addTrack('t6', buf);
    engine.close();
    // closing should not throw and duration returns 0
    expect(engine.getDuration('t6')).toBe(0);
  });
});
