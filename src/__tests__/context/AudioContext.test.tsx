/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';

const TRACK_ID = '00000000-0000-0000-0000-000000000000';

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
});
