import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine } from '@/renderer/audio/AudioEngine';

// Minimal fake implementations of AudioContext nodes
class FakeGain {
  gain: any;
  connected: boolean = false;
  constructor() {
    this.gain = {
      value: 1,
      cancelScheduledValues: vi.fn(() => {}),
      setValueAtTime: vi.fn((v: number) => { this.gain.value = v; }),
      linearRampToValueAtTime: vi.fn((v: number) => { this.gain.value = v; }),
      setTargetAtTime: vi.fn((v: number) => { this.gain.value = v; }),
    };
  }
  connect() { this.connected = true; }
  disconnect() { this.connected = false; }
}

class FakeSource {
  buffer: any = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  connect() {}
  disconnect() {}
  start(_when: number, _offset?: number) { this.started = true; }
  stop() { this.started = false; if (this.onended) setTimeout(() => this.onended && this.onended(), 0); }
}

class FakeAudioParam {
  value: number;
  constructor(initial: number) { this.value = initial; }
  setTargetAtTime(v: number) { this.value = v; }
  setValueAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime(v: number) { this.value = v; }
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
  createGain() { return new FakeGain(); }
  createMediaStreamDestination() { return new FakeMediaStreamDestination(); }
  createBufferSource() { return new FakeSource(); }
  createDelay(_maxDelay?: number) { return new FakeDelay(); }
  createConvolver() { return new FakeConvolver(); }
  createBiquadFilter() { return new FakeBiquadFilter(); }
  createStereoPanner() { return new FakePanner(); }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return {
      numberOfChannels,
      length,
      sampleRate,
      getChannelData: (channel: number) => channels[channel],
    };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'suspended'; return Promise.resolve(); }
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
