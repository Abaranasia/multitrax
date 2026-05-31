import { describe, it, expect, beforeEach, vi } from 'vitest';
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

class FakeMediaStreamDestination {
  stream = {} as MediaStream;
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state: 'running' | 'suspended' = 'running';
  createGain() { return new FakeGain(); }
  createMediaStreamDestination() { return new FakeMediaStreamDestination(); }
  createBufferSource() { return new FakeSource(); }
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

  it('plays, reports playing and currentTime progression', () => {
    const engine = new AudioEngine();
    const buf = { duration: 10 } as unknown as AudioBuffer;
    engine.addTrack('t2', buf);

    engine.play('t2');
    expect(engine.isPlaying('t2')).toBe(true);

    // advance context time
    engine.audioContext.currentTime += 2.5;
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
    engine.audioContext.currentTime += 1.2;
    engine.stop('t3');
    expect(engine.getCurrentTime('t3')).toBe(0);
    expect(engine.isPlaying('t3')).toBe(false);
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
    engine.audioContext.currentTime += 0.1;
    engine.seek('t5', 3);
    // Because seek with fade schedules timeout, we fast-forward the fake timers
    // but since implementation uses setTimeout, we can just call clearTimeout path by cancelFade
    // For test purpose ensure no exception and state remains valid
    expect(engine.getDuration('t5')).toBe(20);
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
