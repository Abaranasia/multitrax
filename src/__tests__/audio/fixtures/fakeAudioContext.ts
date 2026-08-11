/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { vi } from 'vitest';

// Minimal fake implementations of AudioContext nodes
export class FakeGain {
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

export class FakeSource {
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

export class FakeAudioParam {
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

export class FakeDelay {
  delayTime = new FakeAudioParam(0);
  connect() {}
  disconnect() {}
}

export class FakeConvolver {
  buffer: any = null;
  normalize = true;
  connect() {}
  disconnect() {}
}

export class FakeBiquadFilter {
  type = 'lowpass';
  frequency = new FakeAudioParam(20000);
  Q = new FakeAudioParam(1);
  connect() {}
  disconnect() {}
}

export class FakeMediaStreamDestination {
  stream = {} as MediaStream;
}

export class FakeWaveShaper {
  curve: Float32Array | null = null;
  oversample = 'none';
  connect() {}
  disconnect() {}
}

export class FakePanner {
  pan = new FakeAudioParam(0);
  connect() {}
  disconnect() {}
}

export class FakeAnalyser {
  fftSize = 2048;
  connect() {}
  disconnect() {}
  getFloatTimeDomainData(array: Float32Array) {
    array.fill(0);
  }
}

export class FakeChannelSplitter {
  connect() {}
  disconnect() {}
}

export class FakeAudioContext {
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
  createAnalyser() {
    return new FakeAnalyser();
  }
  createChannelSplitter(_numberOfOutputs?: number) {
    return new FakeChannelSplitter();
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
