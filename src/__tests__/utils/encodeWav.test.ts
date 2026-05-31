import { describe, expect, it } from 'vitest';
import { encodeWav } from '@/renderer/utils/encodeWav';

function createMockAudioBuffer(options: {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  channelData: Float32Array[];
}): AudioBuffer {
  return {
    numberOfChannels: options.numberOfChannels,
    length: options.length,
    sampleRate: options.sampleRate,
    getChannelData: (channel: number) => options.channelData[channel],
  } as unknown as AudioBuffer;
}

describe('encodeWav', () => {
  it('writes a valid WAV RIFF header for mono audio', () => {
    const audioBuffer = createMockAudioBuffer({
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      channelData: [new Float32Array([0, 1, -1, 0.5])],
    });

    const result = encodeWav(audioBuffer);
    const view = new DataView(result);

    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    expect(riff).toBe('RIFF');

    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );
    expect(wave).toBe('WAVE');

    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);

    // Verify sample conversion is clamped and written as 16-bit PCM.
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
    expect(view.getInt16(50, true)).toBe(0x3fff);
  });

  it('interleaves channels for stereo audio', () => {
    const audioBuffer = createMockAudioBuffer({
      numberOfChannels: 2,
      length: 2,
      sampleRate: 22050,
      channelData: [new Float32Array([1, -1]), new Float32Array([0.5, -0.5])],
    });

    const result = encodeWav(audioBuffer);
    const view = new DataView(result);

    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(22050);

    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(0x3fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
    expect(view.getInt16(50, true)).toBe(-0x4000);
  });
});
