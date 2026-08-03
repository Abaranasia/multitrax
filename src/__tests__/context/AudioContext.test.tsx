/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';
import { createMockElectronAPI } from '@/__tests__/test-utils/mockElectronAPI';
import type { SessionTrackSnapshot } from '@/renderer/domain/SessionFile';

const TRACK_ID = '00000000-0000-0000-0000-000000000000';

function createSessionSnapshot(
  overrides: Partial<SessionTrackSnapshot> = {},
): SessionTrackSnapshot {
  return {
    filePath: '/session/track.wav',
    title: 'Track',
    x: 100,
    y: 50,
    volume: 0.6,
    pan: -0.3,
    loop: false,
    fadeIn: true,
    fadeOut: true,
    seekFade: true,
    fadeInDuration: 2,
    fadeOutDuration: 3,
    seekFadeDuration: 1,
    filterType: 'highpass',
    filterCutoff: 500,
    filterResonance: 2,
    filterMix: 40,
    filterOutput: 90,
    delayTime: 250,
    delayFeedback: 20,
    delayMix: 30,
    delayDamping: 60,
    delayOutput: 80,
    reverbRoom: 'plate',
    reverbMix: 25,
    reverbPreDelay: 15,
    reverbDamping: 45,
    reverbOutput: 70,
    distortionDrive: 10,
    distortionTone: 50,
    distortionMix: 15,
    distortionOutput: 95,
    ...overrides,
  };
}

const mockAudioEngine = createMockAudioEngine({
  decodeAudioDataDuration: 12,
  getBufferDuration: 12,
});

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { AudioProvider } from '@/renderer/context/AudioContext';
import { useAudio } from '@/renderer/context/useAudio';

describe('AudioContext', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();

    const randomUUID = vi.fn(() => '00000000-0000-0000-0000-000000000000');
    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID },
        configurable: true,
      });
    } else {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
        () => '00000000-0000-0000-0000-000000000000',
      );
    }
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'electronAPI');
  });

  it('throws when useAudio is used outside AudioProvider', () => {
    const Consumer = () => {
      useAudio();
      return null;
    };

    expect(() => render(<Consumer />)).toThrow('useAudio must be used inside AudioProvider');
  });

  it('adds a track and exposes it through context', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="track-title">{audio.tracks[0]?.state.title ?? ''}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));
    expect(screen.getByTestId('track-title').textContent).toBe('Test file');
  });

  it('keeps already-decoded files in the batch when an earlier file fails to decode', async () => {
    const decodeError = new Error('corrupt audio data');
    mockAudioEngine.audioContext.decodeAudioData.mockImplementationOnce(() =>
      Promise.reject(decodeError),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/corrupt.mp3', name: 'Corrupt file', buffer: new ArrayBuffer(4) },
                { path: '/good.mp3', name: 'Good file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Tracks
          </button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="track-title">{audio.tracks[0]?.state.title ?? ''}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Tracks'));

    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));
    expect(screen.getByTestId('track-title').textContent).toBe('Good file');
    expect(errorSpy).toHaveBeenCalledWith('Corrupt file', decodeError);
  });

  it('gives a new track default distortion settings', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <div data-testid="distortion-drive">{audio.tracks[0]?.state.distortionDrive ?? ''}</div>
          <div data-testid="distortion-tone">{audio.tracks[0]?.state.distortionTone ?? ''}</div>
          <div data-testid="distortion-mix">{audio.tracks[0]?.state.distortionMix ?? ''}</div>
          <div data-testid="distortion-output">{audio.tracks[0]?.state.distortionOutput ?? ''}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('distortion-drive').textContent).toBe('0'));
    expect(screen.getByTestId('distortion-tone').textContent).toBe('100');
    expect(screen.getByTestId('distortion-mix').textContent).toBe('0');
    expect(screen.getByTestId('distortion-output').textContent).toBe('100');
  });

  it('calls engine.play and updates track playing state', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.play(TRACK_ID)}>Play</button>
          <div data-testid="playing">{String(audio.tracks[0]?.state.playing ?? false)}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('false'));

    fireEvent.click(screen.getByText('Play'));
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('true'));
    expect(mockAudioEngine.play).toHaveBeenCalledWith(TRACK_ID);
  });

  it('calls engine.pause and updates track playing state', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.pause(TRACK_ID)}>Pause</button>
          <div data-testid="playing">{String(audio.tracks[0]?.state.playing ?? false)}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('false'));

    fireEvent.click(screen.getByText('Pause'));
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('false'));
    expect(mockAudioEngine.pause).toHaveBeenCalledWith(TRACK_ID);
  });

  it('calls engine.stop and resets current time', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.stop(TRACK_ID)}>Stop</button>
          <div data-testid="playing">{String(audio.tracks[0]?.state.playing ?? false)}</div>
          <div data-testid="currentTime">{String(audio.tracks[0]?.state.currentTime ?? 0)}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('currentTime').textContent).toBe('0'));

    fireEvent.click(screen.getByText('Stop'));
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('false'));
    expect(screen.getByTestId('currentTime').textContent).toBe('0');
    expect(mockAudioEngine.stop).toHaveBeenCalledWith(TRACK_ID);
  });

  it('calls engine.seek and updates current time', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([
                { path: '/test.mp3', name: 'Test file', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.seek(TRACK_ID, 5)}>Seek</button>
          <div data-testid="currentTime">{String(audio.tracks[0]?.state.currentTime ?? 0)}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('currentTime').textContent).toBe('0'));

    fireEvent.click(screen.getByText('Seek'));
    await waitFor(() => expect(screen.getByTestId('currentTime').textContent).toBe('5'));
    expect(mockAudioEngine.seek).toHaveBeenCalledWith(TRACK_ID, 5);
  });

  it('duplicates a track, reusing the same buffer and copying its settings', async () => {
    const SOURCE_ID = '11111111-1111-1111-1111-111111111111';
    const CLONE_ID = '22222222-2222-2222-2222-222222222222';
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() =>
      call++ === 0 ? SOURCE_ID : CLONE_ID,
    );

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([{ path: '/guitar.wav', name: 'Guitar', buffer: new ArrayBuffer(4) }])
            }
          >
            Add Track
          </button>
          <button
            onClick={() =>
              audio.setDistortionSettings(SOURCE_ID, { drive: 40, tone: 60, mix: 50, output: 80 })
            }
          >
            Set Distortion
          </button>
          <button onClick={() => audio.duplicateTrack(SOURCE_ID)}>Duplicate</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="clone-title">{audio.tracks[1]?.state.title ?? ''}</div>
          <div data-testid="clone-playing">{String(audio.tracks[1]?.state.playing ?? '')}</div>
          <div data-testid="clone-distortion-drive">
            {audio.tracks[1]?.state.distortionDrive ?? ''}
          </div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));

    fireEvent.click(screen.getByText('Set Distortion'));
    await waitFor(() =>
      expect(mockAudioEngine.setDistortionSettings).toHaveBeenCalledWith(SOURCE_ID, {
        drive: 40,
        tone: 60,
        mix: 50,
        output: 80,
      }),
    );

    fireEvent.click(screen.getByText('Duplicate'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('2'));

    const clonedBuffer = mockAudioEngine.getBuffer(SOURCE_ID);
    expect(mockAudioEngine.addTrack).toHaveBeenLastCalledWith(CLONE_ID, clonedBuffer);
    expect(screen.getByTestId('clone-title').textContent).toBe('Guitar copy');
    expect(screen.getByTestId('clone-playing').textContent).toBe('false');
    expect(mockAudioEngine.setPan).toHaveBeenCalledWith(CLONE_ID, 0);
    expect(mockAudioEngine.setFilterSettings).toHaveBeenCalledWith(CLONE_ID, {
      type: 'lowpass',
      cutoff: 1000,
      resonance: 1,
      mix: 0,
      output: 100,
    });
    expect(mockAudioEngine.setDistortionSettings).toHaveBeenCalledWith(CLONE_ID, {
      drive: 40,
      tone: 60,
      mix: 50,
      output: 80,
    });
    expect(screen.getByTestId('clone-distortion-drive').textContent).toBe('40');
  });

  it('loadSession replaces existing tracks and applies every engine setting from the snapshot', async () => {
    const OLD_ID = '11111111-1111-1111-1111-111111111111';
    const NEW_ID = '22222222-2222-2222-2222-222222222222';
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() =>
      call++ === 0 ? OLD_ID : NEW_ID,
    );

    const readSessionAudioFile = vi.fn(() =>
      Promise.resolve({ ok: true, buffer: new ArrayBuffer(4) }),
    );
    window.electronAPI = createMockElectronAPI({ readSessionAudioFile });

    const snapshot = createSessionSnapshot({ filePath: '/session/guitar.wav', title: 'Guitar' });

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([{ path: '/old.mp3', name: 'Old', buffer: new ArrayBuffer(4) }])
            }
          >
            Add Track
          </button>
          <button onClick={() => void audio.loadSession([snapshot])}>Load Session</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="track-title">{audio.tracks[0]?.state.title ?? ''}</div>
          <div data-testid="track-x">{audio.tracks[0]?.x ?? ''}</div>
          <div data-testid="track-y">{audio.tracks[0]?.y ?? ''}</div>
          <div data-testid="track-filepath">{audio.tracks[0]?.filePath ?? ''}</div>
          <div data-testid="track-playing">{String(audio.tracks[0]?.state.playing ?? '')}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));

    fireEvent.click(screen.getByText('Load Session'));
    await waitFor(() => expect(screen.getByTestId('track-title').textContent).toBe('Guitar'));

    expect(screen.getByTestId('track-count').textContent).toBe('1');
    expect(screen.getByTestId('track-x').textContent).toBe('100');
    expect(screen.getByTestId('track-y').textContent).toBe('50');
    expect(screen.getByTestId('track-filepath').textContent).toBe('/session/guitar.wav');
    expect(screen.getByTestId('track-playing').textContent).toBe('false');

    expect(readSessionAudioFile).toHaveBeenCalledWith('/session/guitar.wav');
    expect(mockAudioEngine.removeTrack).toHaveBeenCalledWith(OLD_ID);
    expect(mockAudioEngine.addTrack).toHaveBeenCalledWith(NEW_ID, expect.anything());
    expect(mockAudioEngine.setFilterSettings).toHaveBeenCalledWith(NEW_ID, {
      type: 'highpass',
      cutoff: 500,
      resonance: 2,
      mix: 40,
      output: 90,
    });
    expect(mockAudioEngine.setDelaySettings).toHaveBeenCalledWith(NEW_ID, {
      delayTime: 250,
      feedback: 20,
      mix: 30,
      damping: 60,
      output: 80,
    });
    expect(mockAudioEngine.setReverbSettings).toHaveBeenCalledWith(NEW_ID, {
      room: 'plate',
      mix: 25,
      preDelay: 15,
      damping: 45,
      output: 70,
    });
    expect(mockAudioEngine.setDistortionSettings).toHaveBeenCalledWith(NEW_ID, {
      drive: 10,
      tone: 50,
      mix: 15,
      output: 95,
    });
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(NEW_ID, 0.6);
    expect(mockAudioEngine.setPan).toHaveBeenCalledWith(NEW_ID, -0.3);
    expect(mockAudioEngine.setLoop).toHaveBeenCalledWith(NEW_ID, false);
  });

  it('loadSession skips a missing/moved file, reports it in missing, and still loads the rest', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const readSessionAudioFile = vi.fn((filePath: string) =>
      filePath === '/missing.wav'
        ? Promise.resolve({ ok: false, error: 'ENOENT: no such file or directory' })
        : Promise.resolve({ ok: true, buffer: new ArrayBuffer(4) }),
    );
    window.electronAPI = createMockElectronAPI({ readSessionAudioFile });

    const missingSnapshot = createSessionSnapshot({ filePath: '/missing.wav', title: 'Missing' });
    const goodSnapshot = createSessionSnapshot({ filePath: '/good.wav', title: 'Good' });

    const Consumer = () => {
      const audio = useAudio();
      const [result, setResult] = React.useState<{ loaded: number; missing: string[] } | null>(
        null,
      );
      return (
        <>
          <button
            onClick={() =>
              void audio.loadSession([missingSnapshot, goodSnapshot]).then(setResult)
            }
          >
            Load Session
          </button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="track-title">{audio.tracks[0]?.state.title ?? ''}</div>
          <div data-testid="loaded">{result?.loaded ?? ''}</div>
          <div data-testid="missing">{result?.missing.join(',') ?? ''}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Load Session'));

    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));
    expect(screen.getByTestId('track-title').textContent).toBe('Good');
    expect(screen.getByTestId('loaded').textContent).toBe('1');
    expect(screen.getByTestId('missing').textContent).toBe('/missing.wav');
  });
});
