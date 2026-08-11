/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { vi } from 'vitest';

export interface MockAudioEngineOptions {
  decodeAudioDataDuration?: number;
  getBufferDuration?: number;
}

/**
 * Builds a fresh mock of `AudioEngine` for `vi.mock('@/renderer/audio/AudioEngine', ...)`.
 *
 * Each call returns brand-new `vi.fn()` stubs so tests never share mock call
 * state across files (no cross-test bleed). The stub surface is the union of
 * what the 8 dialog/context/recorder suites need; a file that only calls a
 * subset of these methods is unaffected by the unused extras.
 */
export function createMockAudioEngine(options: MockAudioEngineOptions = {}) {
  const { decodeAudioDataDuration = 3, getBufferDuration = 12 } = options;

  return {
    getRecordingStream: vi.fn(() => ({})),
    audioContext: {
      decodeAudioData: vi.fn(
        async (_b: ArrayBuffer) => ({ duration: decodeAudioDataDuration }) as unknown as AudioBuffer,
      ),
    },
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    getBuffer: vi.fn((_id: string) => ({ duration: getBufferDuration }) as unknown as AudioBuffer),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
    playAll: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setPan: vi.fn(),
    setMasterVolume: vi.fn(),
    setMasterBalance: vi.fn(),
    setLoop: vi.fn(),
    setFadeIn: vi.fn(),
    setFadeOut: vi.fn(),
    setSeekFade: vi.fn(),
    setFadeDurations: vi.fn(),
    setFilterSettings: vi.fn(),
    setDelaySettings: vi.fn(),
    setReverbSettings: vi.fn(),
    setDistortionSettings: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getLevel: vi.fn().mockReturnValue(0),
    getMasterLevel: vi.fn().mockReturnValue(0),
    close: vi.fn(),
  };
}
