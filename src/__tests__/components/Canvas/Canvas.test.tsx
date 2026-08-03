import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
  createEvent,
} from '@testing-library/react';

import { createMockElectronAPI } from '@/__tests__/test-utils/mockElectronAPI';

const mockAddTracks = vi.fn();
const mockTickCurrentTimes = vi.fn();
const mockStopAll = vi.fn();
const mockPlayAll = vi.fn();
const mockLoadSession = vi.fn();
const mockNewSession = vi.fn();

type MockAudioState = {
  tracks: Array<{
    state: {
      id: string;
      title: string;
      playing?: boolean;
      [key: string]: unknown;
    };
    filePath?: string;
    x: number;
    y: number;
  }>;
  addTracks: typeof mockAddTracks;
  tickCurrentTimes: typeof mockTickCurrentTimes;
  stopAll: typeof mockStopAll;
  playAll: typeof mockPlayAll;
  loadSession: typeof mockLoadSession;
  newSession: typeof mockNewSession;
};

const useAudioMock = vi.fn((): MockAudioState => ({
  tracks: [],
  addTracks: mockAddTracks,
  tickCurrentTimes: mockTickCurrentTimes,
  stopAll: mockStopAll,
  playAll: mockPlayAll,
  loadSession: mockLoadSession,
  newSession: mockNewSession,
}));

vi.mock('@/renderer/context/useAudio', () => ({
  useAudio: (): MockAudioState => useAudioMock(),
}));

vi.mock('@/renderer/components/TrackPlayer/TrackPlayer', () => ({
  TrackPlayer: ({ state }: { state: { title: string } }) => (
    <div data-testid="track-player">{state.title}</div>
  ),
}));

vi.mock('@/renderer/components/Recorder/RecorderBar', () => ({
  RecorderBar: () => <div data-testid="recorder-bar" />,
}));

import { Canvas } from '@/renderer/components/Canvas/Canvas';

describe('Canvas', () => {
  beforeEach(() => {
    cleanup();
    mockAddTracks.mockReset();
    mockTickCurrentTimes.mockReset();
    mockStopAll.mockReset();
    mockPlayAll.mockReset();
    mockLoadSession.mockReset();
    mockLoadSession.mockResolvedValue({ loaded: 0, missing: [] });
    mockNewSession.mockReset();
    useAudioMock.mockReturnValue({
      tracks: [],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'electronAPI');
  });

  it('renders empty canvas state and recorder bar when there are no tracks', () => {
    render(<Canvas />);

    expect(screen.queryByText('Drop audio files here')).toBeTruthy();
    expect(screen.queryByText('or click the button below')).toBeTruthy();
    expect(screen.queryByTestId('recorder-bar')).toBeTruthy();
  });

  it('groups playback controls in a floating action bar', () => {
    render(<Canvas />);

    const actionBar = screen.getByRole('group', { name: 'Playback controls' });
    expect(actionBar.contains(screen.getByTitle('Open audio files'))).toBe(true);
    expect(actionBar.contains(screen.getByTitle('Stop all tracks'))).toBe(true);
    expect(actionBar.contains(screen.getByTitle('Play all tracks'))).toBe(true);
  });

  it('starts tickCurrentTimes interval on mount', () => {
    vi.useFakeTimers();
    render(<Canvas />);

    expect(mockTickCurrentTimes).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(mockTickCurrentTimes).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('sets dropEffect to copy when dragging over the canvas', () => {
    render(<Canvas />);

    const canvas = screen.getByText('Drop audio files here').closest('.canvas');
    const dataTransfer: { files: File[]; dropEffect: string } = {
      files: [],
      dropEffect: '',
    };
    const event = createEvent.dragOver(canvas!, { dataTransfer });
    const preventDefault = vi.fn();
    event.preventDefault = preventDefault;

    fireEvent(canvas!, event);

    expect(preventDefault).toHaveBeenCalled();
    expect(dataTransfer.dropEffect).toBe('copy');
  });

  it('drops only recognized audio files and passes them to addTracks', async () => {
    render(<Canvas />);

    const audioFile = new File(['audio'], 'song.mp3', { type: 'text/plain' });
    const textFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const dataTransfer: { files: File[]; dropEffect: string } = {
      files: [audioFile, textFile],
      dropEffect: '',
    };
    const canvas = screen.getByText('Drop audio files here').closest('.canvas');
    if (!canvas) throw new Error('Canvas element not found');

    const event = createEvent.drop(canvas, { dataTransfer });
    act(() => {
      fireEvent(canvas, event);
    });

    await waitFor(() => expect(mockAddTracks).toHaveBeenCalledTimes(1));
    expect(mockAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({
        path: 'song.mp3',
        name: 'song.mp3',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed as `any` in vitest
        buffer: expect.any(ArrayBuffer),
      }),
    ]);
  });

  it('resolves a dropped file to its real on-disk path through the preload bridge', async () => {
    const getPathForFile = vi.fn(() => '/music/library/song.mp3');
    window.electronAPI = {
      ...createMockElectronAPI(),
      getPathForFile,
    };

    render(<Canvas />);

    const audioFile = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    const dataTransfer: { files: File[]; dropEffect: string } = {
      files: [audioFile],
      dropEffect: '',
    };
    const canvas = screen.getByText('Drop audio files here').closest('.canvas');
    if (!canvas) throw new Error('Canvas element not found');

    act(() => {
      fireEvent(canvas, createEvent.drop(canvas, { dataTransfer }));
    });

    await waitFor(() => expect(mockAddTracks).toHaveBeenCalledTimes(1));
    expect(getPathForFile).toHaveBeenCalledWith(audioFile);
    expect(mockAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({ path: '/music/library/song.mp3', name: 'song.mp3' }),
    ]);
  });

  it('opens files through electronAPI and calls addTracks with decoded file data', async () => {
    const openAudioFiles = vi.fn(() => Promise.resolve(['/music/beat.wav']));
    const readAudioFile = vi.fn(() => Promise.resolve(new ArrayBuffer(4)));
    const saveRecording = vi.fn(() => Promise.resolve({ saved: true }));
    window.electronAPI = {
      ...createMockElectronAPI(),
      openAudioFiles,
      readAudioFile,
      saveRecording,
    };

    render(<Canvas />);

    const openButton = screen.getByTitle('Open audio files');
    act(() => {
      fireEvent.click(openButton);
    });

    await waitFor(() => expect(openAudioFiles).toHaveBeenCalled());
    await waitFor(() => expect(readAudioFile).toHaveBeenCalledWith('/music/beat.wav'));
    expect(mockAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({
        path: '/music/beat.wav',
        name: 'beat.wav',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed as `any` in vitest
        buffer: expect.any(ArrayBuffer),
      }),
    ]);
  });

  it('ignores a second Open Files click while a batch is still in flight', async () => {
    let resolveRead: (buf: ArrayBuffer) => void = () => {};
    const readPending = new Promise<ArrayBuffer>((resolve) => {
      resolveRead = resolve;
    });
    const openAudioFiles = vi.fn(() => Promise.resolve(['/music/beat.wav']));
    const readAudioFile = vi.fn(() => readPending);
    window.electronAPI = {
      ...createMockElectronAPI(),
      openAudioFiles,
      readAudioFile,
    };

    render(<Canvas />);

    const openButton = screen.getByTitle('Open audio files');
    await act(async () => {
      fireEvent.click(openButton);
      await Promise.resolve();
    });

    await waitFor(() => expect(readAudioFile).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(openButton);
      await Promise.resolve();
    });

    await act(async () => {
      resolveRead(new ArrayBuffer(4));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockAddTracks).toHaveBeenCalledTimes(1));
    expect(openAudioFiles).toHaveBeenCalledTimes(1);
  });

  it('disables the Open Files button while a batch is in flight and re-enables it after', async () => {
    let resolveRead: (buf: ArrayBuffer) => void = () => {};
    const readPending = new Promise<ArrayBuffer>((resolve) => {
      resolveRead = resolve;
    });
    const openAudioFiles = vi.fn(() => Promise.resolve(['/music/beat.wav']));
    const readAudioFile = vi.fn(() => readPending);
    window.electronAPI = {
      ...createMockElectronAPI(),
      openAudioFiles,
      readAudioFile,
    };

    render(<Canvas />);

    const openButton = screen.getByTitle<HTMLButtonElement>('Open audio files');
    expect(openButton.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(openButton);
      await Promise.resolve();
    });

    await waitFor(() => expect(openButton.disabled).toBe(true));

    await act(async () => {
      resolveRead(new ArrayBuffer(4));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockAddTracks).toHaveBeenCalledTimes(1));
    expect(openButton.disabled).toBe(false);
  });

  it('renders a TrackPlayer for each track returned by useAudio', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [{ state: { id: '1', title: 'Test track' }, x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    expect(screen.getByTestId('track-player').textContent).toBe('Test track');
  });

  it('disables the Stop All button when no tracks are playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [{ state: { id: '1', title: 'Test track', playing: false }, x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    expect(screen.getByTitle<HTMLButtonElement>('Stop all tracks').disabled).toBe(true);
  });

  it('enables the Stop All button and calls stopAll when a track is playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [{ state: { id: '1', title: 'Test track', playing: true }, x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    const stopAllBtn = screen.getByTitle<HTMLButtonElement>('Stop all tracks');
    expect(stopAllBtn.disabled).toBe(false);
    fireEvent.click(stopAllBtn);
    expect(mockStopAll).toHaveBeenCalledTimes(1);
  });

  it('disables the Play All button when there are no tracks or all tracks are playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    const playAllBtn = screen.getByTitle<HTMLButtonElement>('Play all tracks');
    expect(playAllBtn.disabled).toBe(true);

    cleanup();
    useAudioMock.mockReturnValueOnce({
      tracks: [{ state: { id: '1', title: 'Test track', playing: true }, x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    expect(screen.getByTitle<HTMLButtonElement>('Play all tracks').disabled).toBe(true);
  });

  it('enables the Play All button and calls playAll when a track is not playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [{ state: { id: '1', title: 'Test track', playing: false }, x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    render(<Canvas />);

    const playAllBtn = screen.getByTitle<HTMLButtonElement>('Play all tracks');
    expect(playAllBtn.disabled).toBe(false);
    fireEvent.click(playAllBtn);
    expect(mockPlayAll).toHaveBeenCalledTimes(1);
  });

  it('disables the Save Session and Save New Session menu items when there are no tracks', () => {
    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));

    expect(screen.getByText<HTMLButtonElement>('Save Session').disabled).toBe(true);
    expect(screen.getByText<HTMLButtonElement>('Save New Session').disabled).toBe(true);
  });

  it('opens the session menu on toggle click and closes it on a second click', () => {
    render(<Canvas />);

    expect(screen.queryByText('Save Session')).toBeNull();

    fireEvent.click(screen.getByTitle('Session menu'));
    expect(screen.getByText('Save Session')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Session menu'));
    expect(screen.queryByText('Save Session')).toBeNull();
  });

  it('closes the session menu when clicking outside of it', () => {
    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    expect(screen.getByText('Save Session')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Save Session')).toBeNull();
  });

  it('closes the session menu when pressing Escape', () => {
    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    expect(screen.getByText('Save Session')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Save Session')).toBeNull();
  });

  it('saves the current session as a JSON snapshot of every track, opening the save dialog with a date-based name', async () => {
    const fullState = {
      id: '1',
      title: 'Guitar',
      duration: 10,
      currentTime: 3,
      playing: true,
      volume: 0.5,
      pan: 0.2,
      loop: true,
      fadeIn: false,
      fadeOut: false,
      seekFade: false,
      fadeInDuration: 5,
      fadeOutDuration: 5,
      seekFadeDuration: 2,
      filterType: 'lowpass',
      filterCutoff: 1000,
      filterResonance: 1,
      filterMix: 0,
      filterOutput: 100,
      delayTime: 300,
      delayFeedback: 35,
      delayMix: 0,
      delayDamping: 50,
      delayOutput: 100,
      reverbRoom: 'hall',
      reverbMix: 0,
      reverbPreDelay: 20,
      reverbDamping: 50,
      reverbOutput: 100,
      distortionDrive: 0,
      distortionTone: 100,
      distortionMix: 0,
      distortionOutput: 100,
      waveform: [0.1, 0.2],
    };
    useAudioMock.mockReturnValue({
      tracks: [{ state: fullState, filePath: '/music/guitar.wav', x: 10, y: 20 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    const saveSession = vi.fn((json: string, suggestedName: string) => {
      void json;
      void suggestedName;
      return Promise.resolve({ saved: true, filePath: '/tmp/s.json' });
    });
    window.electronAPI = createMockElectronAPI({ saveSession });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    const saveBtn = screen.getByText<HTMLButtonElement>('Save Session');
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(saveBtn);
      await Promise.resolve();
    });

    // Menu closes as soon as the item is clicked, without waiting for the save to resolve.
    expect(screen.queryByText('Save Session')).toBeNull();

    await waitFor(() => expect(saveSession).toHaveBeenCalled());
    const [json, suggestedName] = saveSession.mock.calls[0];
    expect(suggestedName).toMatch(/^session-\d{4}-\d{2}-\d{2}\.json$/);

    const parsed = JSON.parse(json) as {
      version: number;
      tracks: Array<Record<string, unknown>>;
    };
    expect(parsed.version).toBe(1);
    expect(parsed.tracks).toEqual([
      {
        filePath: '/music/guitar.wav',
        title: 'Guitar',
        x: 10,
        y: 20,
        volume: 0.5,
        pan: 0.2,
        loop: true,
        fadeIn: false,
        fadeOut: false,
        seekFade: false,
        fadeInDuration: 5,
        fadeOutDuration: 5,
        seekFadeDuration: 2,
        filterType: 'lowpass',
        filterCutoff: 1000,
        filterResonance: 1,
        filterMix: 0,
        filterOutput: 100,
        delayTime: 300,
        delayFeedback: 35,
        delayMix: 0,
        delayDamping: 50,
        delayOutput: 100,
        reverbRoom: 'hall',
        reverbMix: 0,
        reverbPreDelay: 20,
        reverbDamping: 50,
        reverbOutput: 100,
        distortionDrive: 0,
        distortionTone: 100,
        distortionMix: 0,
        distortionOutput: 100,
      },
    ]);
  });

  it('ignores a second Save Session click while a save is still in flight', async () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    let resolveSave: (v: { saved: boolean; filePath?: string }) => void = () => {};
    const savePending = new Promise<{ saved: boolean; filePath?: string }>((resolve) => {
      resolveSave = resolve;
    });
    const saveSession = vi.fn(() => savePending);
    window.electronAPI = createMockElectronAPI({ saveSession });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save Session'));
      await Promise.resolve();
    });

    // The menu auto-closes right after the click; reopen it to observe the
    // in-flight disabled state and to attempt a second click on the same item.
    fireEvent.click(screen.getByTitle('Session menu'));
    const saveBtnAgain = screen.getByText<HTMLButtonElement>('Save Session');
    expect(saveBtnAgain.disabled).toBe(true);

    await act(async () => {
      fireEvent.click(saveBtnAgain);
      await Promise.resolve();
    });

    await act(async () => {
      resolveSave({ saved: true, filePath: '/tmp/s.json' });
      await Promise.resolve();
    });

    expect(saveSession).toHaveBeenCalledTimes(1);
  });

  it('after a successful Save New Session, a subsequent Save Session writes directly to the remembered path without reopening the dialog', async () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    const saveSession = vi.fn(() =>
      Promise.resolve({ saved: true, filePath: '/chosen/session.json' }),
    );
    const writeSessionFile = vi.fn((filePath: string, json: string) => {
      void json;
      return Promise.resolve({ saved: true, filePath });
    });
    window.electronAPI = createMockElectronAPI({ saveSession, writeSessionFile });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save New Session'));
      await Promise.resolve();
    });
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(writeSessionFile).toHaveBeenCalledTimes(1));
    expect(writeSessionFile.mock.calls[0][0]).toBe('/chosen/session.json');
    expect(saveSession).toHaveBeenCalledTimes(1);
  });

  it('after a successful session load, a subsequent Save Session writes directly to the loaded path without opening the dialog', async () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    const openSession = vi.fn(() =>
      Promise.resolve({
        opened: true,
        data: JSON.stringify({ version: 1, tracks: [] }),
        filePath: '/loaded/session.json',
      }),
    );
    const saveSession = vi.fn(() => Promise.resolve({ saved: true, filePath: '/other.json' }));
    const writeSessionFile = vi.fn((filePath: string, json: string) => {
      void json;
      return Promise.resolve({ saved: true, filePath });
    });
    window.electronAPI = createMockElectronAPI({ openSession, saveSession, writeSessionFile });
    mockLoadSession.mockResolvedValueOnce({ loaded: 0, missing: [] });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Load Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockLoadSession).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(writeSessionFile).toHaveBeenCalledTimes(1));
    expect(writeSessionFile.mock.calls[0][0]).toBe('/loaded/session.json');
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('Save New Session always opens the save dialog even when a path is already remembered, and updates the remembered path', async () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });

    const saveSession = vi
      .fn()
      .mockResolvedValueOnce({ saved: true, filePath: '/first.json' })
      .mockResolvedValueOnce({ saved: true, filePath: '/second.json' });
    const writeSessionFile = vi.fn((filePath: string, json: string) => {
      void json;
      return Promise.resolve({ saved: true, filePath });
    });
    window.electronAPI = createMockElectronAPI({ saveSession, writeSessionFile });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save New Session'));
      await Promise.resolve();
    });
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save New Session'));
      await Promise.resolve();
    });
    await waitFor(() => expect(saveSession).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(writeSessionFile).toHaveBeenCalledTimes(1));
    expect(writeSessionFile.mock.calls[0][0]).toBe('/second.json');
  });

  it('loads a session through electronAPI and calls loadSession with the parsed tracks', async () => {
    const sessionTracks = [
      {
        filePath: '/music/guitar.wav',
        title: 'Guitar',
        x: 10,
        y: 20,
        volume: 0.5,
        pan: 0.2,
        loop: true,
        fadeIn: false,
        fadeOut: false,
        seekFade: false,
        fadeInDuration: 5,
        fadeOutDuration: 5,
        seekFadeDuration: 2,
        filterType: 'lowpass',
        filterCutoff: 1000,
        filterResonance: 1,
        filterMix: 0,
        filterOutput: 100,
        delayTime: 300,
        delayFeedback: 35,
        delayMix: 0,
        delayDamping: 50,
        delayOutput: 100,
        reverbRoom: 'hall',
        reverbMix: 0,
        reverbPreDelay: 20,
        reverbDamping: 50,
        reverbOutput: 100,
        distortionDrive: 0,
        distortionTone: 100,
        distortionMix: 0,
        distortionOutput: 100,
      },
    ];
    const openSession = vi.fn(() =>
      Promise.resolve({
        opened: true,
        data: JSON.stringify({ version: 1, tracks: sessionTracks }),
        filePath: '/tmp/s.json',
      }),
    );
    window.electronAPI = createMockElectronAPI({ openSession });
    mockLoadSession.mockResolvedValueOnce({ loaded: 1, missing: [] });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Load Session'));
      await Promise.resolve();
    });

    // Menu closes as soon as the item is clicked.
    expect(screen.queryByText('Load Session')).toBeNull();

    await waitFor(() => expect(openSession).toHaveBeenCalled());
    await waitFor(() => expect(mockLoadSession).toHaveBeenCalledWith(sessionTracks));
  });

  it('does nothing when the session dialog is canceled', async () => {
    const openSession = vi.fn(() => Promise.resolve({ opened: false as const }));
    window.electronAPI = createMockElectronAPI({ openSession });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Load Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(openSession).toHaveBeenCalled());
    expect(mockLoadSession).not.toHaveBeenCalled();
  });

  it('alerts the user with the list of skipped files when a session load reports missing files', async () => {
    const openSession = vi.fn(() =>
      Promise.resolve({
        opened: true,
        data: JSON.stringify({ version: 1, tracks: [] }),
        filePath: '/tmp/s.json',
      }),
    );
    window.electronAPI = createMockElectronAPI({ openSession });
    mockLoadSession.mockResolvedValueOnce({ loaded: 0, missing: ['/gone.wav', '/also-gone.wav'] });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Load Session'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockLoadSession).toHaveBeenCalled());
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [message] = alertSpy.mock.calls[0] as [string];
    expect(message).toContain('/gone.wav');
    expect(message).toContain('/also-gone.wav');
  });

  it('ignores a second Load Session click while a load is still in flight', async () => {
    type OpenSessionResult =
      | { opened: true; data: string; filePath: string }
      | { opened: false; error?: string };
    let resolveOpen: (v: OpenSessionResult) => void = () => {};
    const openPending = new Promise<OpenSessionResult>((resolve) => {
      resolveOpen = resolve;
    });
    const openSession = vi.fn(() => openPending);
    window.electronAPI = createMockElectronAPI({ openSession });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    await act(async () => {
      fireEvent.click(screen.getByText('Load Session'));
      await Promise.resolve();
    });

    // The menu auto-closes right after the click; reopen it to observe the
    // in-flight disabled state and to attempt a second click on the same item.
    fireEvent.click(screen.getByTitle('Session menu'));
    const loadBtnAgain = screen.getByText<HTMLButtonElement>('Load Session');
    expect(loadBtnAgain.disabled).toBe(true);

    await act(async () => {
      fireEvent.click(loadBtnAgain);
      await Promise.resolve();
    });

    await act(async () => {
      resolveOpen({ opened: false });
      await Promise.resolve();
    });

    expect(openSession).toHaveBeenCalledTimes(1);
  });

  it('clears the session immediately with no confirmation when there are no tracks', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    fireEvent.click(screen.getByText('New Session'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockNewSession).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before clearing a session with existing tracks, and clears it when confirmed', () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    fireEvent.click(screen.getByText('New Session'));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockNewSession).toHaveBeenCalledTimes(1);
  });

  it('does not clear the session when the user cancels the confirmation', () => {
    useAudioMock.mockReturnValue({
      tracks: [{ state: { id: '1', title: 'Track' }, filePath: '/t.wav', x: 0, y: 0 }],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
      loadSession: mockLoadSession,
      newSession: mockNewSession,
    });
    vi.spyOn(window, 'confirm').mockImplementation(() => false);

    render(<Canvas />);

    fireEvent.click(screen.getByTitle('Session menu'));
    fireEvent.click(screen.getByText('New Session'));

    expect(mockNewSession).not.toHaveBeenCalled();
  });
});
