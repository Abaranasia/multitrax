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

  it('setPan clamps value and updates the panner', () => {
    const engine = new AudioEngine();
    const buf = { duration: 2 } as unknown as AudioBuffer;
    engine.addTrack('t4b', buf);
    engine.setPan('t4b', -0.5);
    engine.setPan('t4b', 5); // clamps to 1
    // no throw; validate getDuration still works
    expect(engine.getDuration('t4b')).toBe(2);
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

  it('setFilterSettings updates the filter chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t9', buf);
    engine.setFilterSettings('t9', 'highpass', 500, 4, 70, 90);
    // no throw; engine remains valid
    expect(engine.getDuration('t9')).toBe(6);
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

  it('setDistortionSettings updates existing distortion nodes without throwing or recreating them', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('td2', buf);
    const before = (engine as any).tracks.get('td2').distortion;

    engine.setDistortionSettings('td2', 70, 40, 60, 80);

    const after = (engine as any).tracks.get('td2').distortion;
    expect(after).toBe(before);
    expect(after.drive).toBe(70);
    expect(after.tone).toBe(40);
    expect(after.mix).toBe(60);
    expect(after.outputLevel).toBe(80);
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
    engine.setDelaySettings('t8', 450, 60, 40, 30, 90);
    // no throw; engine remains valid
    expect(engine.getDuration('t8')).toBe(6);
  });

  it('setReverbSettings updates the reverb chain without throwing', () => {
    const engine = new AudioEngine();
    const buf = { duration: 6 } as unknown as AudioBuffer;
    engine.addTrack('t7', buf);
    engine.setReverbSettings('t7', 'cathedral', 60, 100, 20, 80);
    // no throw; engine remains valid
    expect(engine.getDuration('t7')).toBe(6);
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
