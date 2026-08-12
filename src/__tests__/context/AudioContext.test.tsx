/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';
import { createMockElectronAPI } from '@/__tests__/test-utils/mockElectronAPI';
import type { SessionTrackSnapshot } from '@/renderer/domain/SessionFile';
import { SIDE_INSET, TOP_INSET } from '@/renderer/utils/canvasLayout';

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

  it('places the first added track below the top-left buttons, not directly under them', async () => {
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
          <div data-testid="track-x">{audio.tracks[0]?.x ?? ''}</div>
          <div data-testid="track-y">{audio.tracks[0]?.y ?? ''}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('track-y').textContent).toBe(String(TOP_INSET)));
    expect(screen.getByTestId('track-x').textContent).toBe(String(SIDE_INSET));
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

  it('duplicating a muted track keeps the clone silent in the engine, not just in the UI', async () => {
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
          <button onClick={() => audio.setMuted(SOURCE_ID, true)}>Mute</button>
          <button onClick={() => audio.duplicateTrack(SOURCE_ID)}>Duplicate</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
          <div data-testid="clone-muted">{String(audio.tracks[1]?.state.muted ?? '')}</div>
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

    fireEvent.click(screen.getByText('Mute'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(SOURCE_ID, 0));

    fireEvent.click(screen.getByText('Duplicate'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('2'));

    expect(screen.getByTestId('clone-muted').textContent).toBe('true');
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(CLONE_ID, 0);
  });

  it('duplicating a non-soloed track while another track is soloed keeps the clone silent', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) },
                { path: '/b.mp3', name: 'B', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Tracks
          </button>
          <button onClick={() => audio.setSoloed(ids[0], true)}>Solo A</button>
          <button onClick={() => audio.duplicateTrack(ids[1])}>Duplicate B</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Tracks'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('2'));

    fireEvent.click(screen.getByText('Solo A'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 0));

    fireEvent.click(screen.getByText('Duplicate B'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('3'));

    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[2], 0);
  });

  it('adding a track while another track is soloed adds it silenced, not at the engine default gain', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([{ path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) }])
            }
          >
            Add A
          </button>
          <button onClick={() => audio.setSoloed(ids[0], true)}>Solo A</button>
          <button
            onClick={() =>
              void audio.addTracks([{ path: '/b.mp3', name: 'B', buffer: new ArrayBuffer(4) }])
            }
          >
            Add B
          </button>
          <div data-testid="track-count">{audio.tracks.length}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add A'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));

    fireEvent.click(screen.getByText('Solo A'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[0], 1));

    fireEvent.click(screen.getByText('Add B'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('2'));

    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 0);
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

  it('loadSession skips a track whose decode throws, reports it in missing, and still loads the rest', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const readSessionAudioFile = vi.fn(() =>
      Promise.resolve({ ok: true, buffer: new ArrayBuffer(4) }),
    );
    window.electronAPI = createMockElectronAPI({ readSessionAudioFile });

    const decodeError = new Error('corrupt audio data');
    mockAudioEngine.audioContext.decodeAudioData.mockImplementationOnce(() =>
      Promise.reject(decodeError),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const corruptSnapshot = createSessionSnapshot({ filePath: '/corrupt.wav', title: 'Corrupt' });
    const goodSnapshot = createSessionSnapshot({ filePath: '/good2.wav', title: 'Good2' });

    const Consumer = () => {
      const audio = useAudio();
      const [result, setResult] = React.useState<{ loaded: number; missing: string[] } | null>(
        null,
      );
      return (
        <>
          <button
            onClick={() =>
              void audio.loadSession([corruptSnapshot, goodSnapshot]).then(setResult)
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
    expect(screen.getByTestId('track-title').textContent).toBe('Good2');
    expect(screen.getByTestId('loaded').textContent).toBe('1');
    expect(screen.getByTestId('missing').textContent).toBe('/corrupt.wav');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('/corrupt.wav'), decodeError);
  });

  it('applies live solo state to a file decoded within an addTracks batch, not a stale pre-batch snapshot', async () => {
    const EXISTING_ID = '77777777-7777-7777-7777-777777777777';
    const BATCH_ID = '88888888-8888-8888-8888-888888888888';
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [EXISTING_ID, BATCH_ID];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/existing.mp3', name: 'Existing', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Existing
          </button>
          <button
            onClick={() =>
              void audio.addTracks([{ path: '/new.mp3', name: 'New', buffer: new ArrayBuffer(4) }])
            }
          >
            Add New
          </button>
          <button onClick={() => audio.setSoloed(EXISTING_ID, true)}>Solo Existing</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Existing'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));

    // Start the batch — its decodeAudioData call is still pending on a
    // microtask — then toggle solo on the existing track before that decode
    // resolves. The new track must still come in silenced: reading solo
    // state fresh (not a snapshot taken before this click) is the fix.
    fireEvent.click(screen.getByText('Add New'));
    fireEvent.click(screen.getByText('Solo Existing'));

    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('2'));

    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(BATCH_ID, 0);
  });

  it('muting a track sends engine.setVolume(id, 0), unmuting restores the last nominal volume', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([{ path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) }])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.setVolume(TRACK_ID, 0.7)}>Set Volume</button>
          <button onClick={() => audio.setMuted(TRACK_ID, true)}>Mute</button>
          <button onClick={() => audio.setMuted(TRACK_ID, false)}>Unmute</button>
          <div data-testid="muted">{String(audio.tracks[0]?.state.muted ?? '')}</div>
          <div data-testid="volume">{String(audio.tracks[0]?.state.volume ?? '')}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('muted').textContent).toBe('false'));

    fireEvent.click(screen.getByText('Set Volume'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(TRACK_ID, 0.7));

    fireEvent.click(screen.getByText('Mute'));
    await waitFor(() => expect(screen.getByTestId('muted').textContent).toBe('true'));
    expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(TRACK_ID, 0);
    // Nominal volume is preserved while muted, for the fader UI.
    expect(screen.getByTestId('volume').textContent).toBe('0.7');

    fireEvent.click(screen.getByText('Unmute'));
    await waitFor(() => expect(screen.getByTestId('muted').textContent).toBe('false'));
    expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(TRACK_ID, 0.7);
  });

  it('dragging the fader while muted stays silent at the engine level', async () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              audio.addTracks([{ path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) }])
            }
          >
            Add Track
          </button>
          <button onClick={() => audio.setMuted(TRACK_ID, true)}>Mute</button>
          <button onClick={() => audio.setVolume(TRACK_ID, 0.9)}>Set Volume</button>
          <div data-testid="volume">{String(audio.tracks[0]?.state.volume ?? '')}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Track'));
    await waitFor(() => expect(screen.getByTestId('volume').textContent).toBe('1'));

    fireEvent.click(screen.getByText('Mute'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(TRACK_ID, 0));

    fireEvent.click(screen.getByText('Set Volume'));
    // The fader UI value updates...
    await waitFor(() => expect(screen.getByTestId('volume').textContent).toBe('0.9'));
    // ...but the engine still receives 0 because the track is muted.
    expect(mockAudioEngine.setVolume).toHaveBeenLastCalledWith(TRACK_ID, 0);
  });

  it('soloing additively: soloing A silences B, soloing B too keeps both audible, un-soloing both restores B', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) },
                { path: '/b.mp3', name: 'B', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Tracks
          </button>
          <button onClick={() => audio.setSoloed(ids[0], true)}>Solo A</button>
          <button onClick={() => audio.setSoloed(ids[0], false)}>Unsolo A</button>
          <button onClick={() => audio.setSoloed(ids[1], true)}>Solo B</button>
          <button onClick={() => audio.setSoloed(ids[1], false)}>Unsolo B</button>
          <div data-testid="titles">{audio.tracks.map((t) => t.state.title).join(',')}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Tracks'));
    await waitFor(() => expect(screen.getByTestId('titles').textContent).toBe('A,B'));
    mockAudioEngine.setVolume.mockClear();

    // Soloing A silences B (A stays at its nominal volume).
    fireEvent.click(screen.getByText('Solo A'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 0));
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[0], 1);

    mockAudioEngine.setVolume.mockClear();

    // Soloing B too (additive) keeps both A and B audible.
    fireEvent.click(screen.getByText('Solo B'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 1));
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[0], 1);

    mockAudioEngine.setVolume.mockClear();

    // Un-soloing A: B is still soloed, so A is now the one silenced.
    fireEvent.click(screen.getByText('Unsolo A'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[0], 0));
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 1);

    mockAudioEngine.setVolume.mockClear();

    // Un-soloing B: no track soloed anywhere, so A's audible volume is restored.
    fireEvent.click(screen.getByText('Unsolo B'));
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[0], 1));
    expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(ids[1], 1);
  });

  it('newSession removes every track from the engine and clears state', async () => {
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
          <button onClick={() => audio.newSession()}>New Session</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
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

    fireEvent.click(screen.getByText('New Session'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('0'));
    expect(mockAudioEngine.removeTrack).toHaveBeenCalledWith(TRACK_ID);
  });

  it('reorderTracks moves the dragged track to the target index without touching x/y', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) },
                { path: '/b.mp3', name: 'B', buffer: new ArrayBuffer(4) },
                { path: '/c.mp3', name: 'C', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Tracks
          </button>
          <button onClick={() => audio.reorderTracks(ids[0], 2)}>Reorder</button>
          <div data-testid="titles">{audio.tracks.map((t) => t.state.title).join(',')}</div>
          <div data-testid="track-a-pos">
            {(() => {
              const a = audio.tracks.find((t) => t.state.id === ids[0]);
              return a ? `${a.x},${a.y}` : '';
            })()}
          </div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Tracks'));
    await waitFor(() => expect(screen.getByTestId('titles').textContent).toBe('A,B,C'));
    const trackAPosBefore = screen.getByTestId('track-a-pos').textContent;

    fireEvent.click(screen.getByText('Reorder'));

    // Track A moved from index 0 to the last slot, but its own x/y — which
    // travels with the moved TrackEntry, not with the array slot — must be
    // unchanged: reorderTracks only splices array order, never touches x/y.
    await waitFor(() => expect(screen.getByTestId('titles').textContent).toBe('B,C,A'));
    expect(screen.getByTestId('track-a-pos').textContent).toBe(trackAPosBefore);
  });

  it('reorderTracks is a no-op when the id is not found or already at the target index', async () => {
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];
    let call = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => ids[call++]);

    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([
                { path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) },
                { path: '/b.mp3', name: 'B', buffer: new ArrayBuffer(4) },
              ])
            }
          >
            Add Tracks
          </button>
          <button onClick={() => audio.reorderTracks('missing-id', 1)}>Reorder Missing</button>
          <button onClick={() => audio.reorderTracks(ids[0], 0)}>Reorder Same Index</button>
          <div data-testid="titles">{audio.tracks.map((t) => t.state.title).join(',')}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add Tracks'));
    await waitFor(() => expect(screen.getByTestId('titles').textContent).toBe('A,B'));

    fireEvent.click(screen.getByText('Reorder Missing'));
    expect(screen.getByTestId('titles').textContent).toBe('A,B');

    fireEvent.click(screen.getByText('Reorder Same Index'));
    expect(screen.getByTestId('titles').textContent).toBe('A,B');
  });

  // ── Master bus ───────────────────────────────────────────────────────────

  it('defaults masterVolume to 1 and masterBalance to 0', () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <div data-testid="master-volume">{audio.masterVolume}</div>
          <div data-testid="master-balance">{audio.masterBalance}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    expect(screen.getByTestId('master-volume').textContent).toBe('1');
    expect(screen.getByTestId('master-balance').textContent).toBe('0');
  });

  it('setMasterVolume calls engine.setMasterVolume and updates context state', () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button onClick={() => audio.setMasterVolume(0.4)}>Set Master Volume</button>
          <div data-testid="master-volume">{audio.masterVolume}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Set Master Volume'));
    expect(screen.getByTestId('master-volume').textContent).toBe('0.4');
    expect(mockAudioEngine.setMasterVolume).toHaveBeenCalledWith(0.4);
  });

  it('setMasterBalance calls engine.setMasterBalance and updates context state', () => {
    const Consumer = () => {
      const audio = useAudio();
      return (
        <>
          <button onClick={() => audio.setMasterBalance(-0.5)}>Set Master Balance</button>
          <div data-testid="master-balance">{audio.masterBalance}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Set Master Balance'));
    expect(screen.getByTestId('master-balance').textContent).toBe('-0.5');
    expect(mockAudioEngine.setMasterBalance).toHaveBeenCalledWith(-0.5);
  });

  it('tickCurrentTimes keeps the same tracks reference when nothing changed, and produces a new one when currentTime/playing changes', async () => {
    // `beforeEach`'s `vi.restoreAllMocks()` wipes the return values
    // `createMockAudioEngine` configured at module load (it isn't a spy, so
    // there's no "original" to restore to) — set the baseline explicitly
    // rather than relying on those surviving into this test.
    mockAudioEngine.getCurrentTime.mockReturnValue(0);
    mockAudioEngine.isPlaying.mockReturnValue(false);

    let latestTracks: unknown[] = [];
    const Consumer = () => {
      const audio = useAudio();
      latestTracks = audio.tracks;
      return (
        <>
          <button
            onClick={() =>
              void audio.addTracks([{ path: '/a.mp3', name: 'A', buffer: new ArrayBuffer(4) }])
            }
          >
            Add
          </button>
          <button onClick={() => audio.tickCurrentTimes()}>Tick</button>
          <div data-testid="track-count">{audio.tracks.length}</div>
        </>
      );
    };

    render(
      <AudioProvider>
        <Consumer />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByText('Add'));
    await waitFor(() => expect(screen.getByTestId('track-count').textContent).toBe('1'));
    const tracksBeforeTick = latestTracks;

    // getCurrentTime/isPlaying report the same values already reflected in
    // state (0 / not playing) — this tick must be a genuine no-op: the exact
    // same array (and track object) reference comes back, not just an
    // equal-looking new one.
    fireEvent.click(screen.getByText('Tick'));
    expect(latestTracks).toBe(tracksBeforeTick);
    expect(latestTracks[0]).toBe(tracksBeforeTick[0]);

    // Now the engine reports a different currentTime — this tick must
    // produce a new array (and a new object for the changed track).
    mockAudioEngine.getCurrentTime.mockReturnValueOnce(5);
    fireEvent.click(screen.getByText('Tick'));
    expect(latestTracks).not.toBe(tracksBeforeTick);
  });
});
