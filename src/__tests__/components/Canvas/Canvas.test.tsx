import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, cleanup, waitFor, createEvent } from '@testing-library/react';

const mockAddTracks = vi.fn();
const mockTickCurrentTimes = vi.fn();
const mockStopAll = vi.fn();
const mockPlayAll = vi.fn();
const useAudioMock = vi.fn();

vi.mock('@/renderer/context/AudioContext', () => ({
  useAudio: () => useAudioMock(),
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
    useAudioMock.mockReturnValue({
      tracks: [],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });
  });

  afterEach(() => {
    cleanup();
    delete (window as any).electronAPI;
  });

  it('renders empty canvas state and recorder bar when there are no tracks', () => {
    render(<Canvas />);

    expect(screen.queryByText('Drop audio files here')).toBeTruthy();
    expect(screen.queryByText('or click the button below')).toBeTruthy();
    expect(screen.queryByTestId('recorder-bar')).toBeTruthy();
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
    const dataTransfer = { files: [], dropEffect: '' } as any;
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
    const dataTransfer = { files: [audioFile, textFile], dropEffect: '' } as any;
    const canvas = screen.getByText('Drop audio files here').closest('.canvas');
    if (!canvas) throw new Error('Canvas element not found');

    const event = createEvent.drop(canvas, { dataTransfer });
    await act(async () => {
      fireEvent(canvas, event);
    });

    await waitFor(() => expect(mockAddTracks).toHaveBeenCalledTimes(1));
    expect(mockAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({
        path: 'song.mp3',
        name: 'song.mp3',
        buffer: expect.any(ArrayBuffer),
      }),
    ]);
  });

  it('opens files through electronAPI and calls addTracks with decoded file data', async () => {
    const openAudioFiles = vi.fn(async () => ['/music/beat.wav']);
    const readAudioFile = vi.fn(async () => new ArrayBuffer(4));
    (window as any).electronAPI = { openAudioFiles, readAudioFile };

    render(<Canvas />);

    const openButton = screen.getByTitle('Open audio files');
    await act(async () => {
      fireEvent.click(openButton);
    });

    await waitFor(() => expect(openAudioFiles).toHaveBeenCalled());
    await waitFor(() => expect(readAudioFile).toHaveBeenCalledWith('/music/beat.wav'));
    expect(mockAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({
        path: '/music/beat.wav',
        name: 'beat.wav',
        buffer: expect.any(ArrayBuffer),
      }),
    ]);
  });

  it('renders a TrackPlayer for each track returned by useAudio', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [
        { state: { id: '1', title: 'Test track' }, x: 10, y: 20 },
      ],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });

    render(<Canvas />);

    expect(screen.getByTestId('track-player').textContent).toBe('Test track');
  });

  it('disables the Stop All button when no tracks are playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [
        { state: { id: '1', title: 'Test track', playing: false }, x: 10, y: 20 },
      ],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });

    render(<Canvas />);

    expect((screen.getByTitle('Stop all tracks') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the Stop All button and calls stopAll when a track is playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [
        { state: { id: '1', title: 'Test track', playing: true }, x: 10, y: 20 },
      ],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });

    render(<Canvas />);

    const stopAllBtn = screen.getByTitle('Stop all tracks') as HTMLButtonElement;
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
    });

    render(<Canvas />);

    expect((screen.getByTitle('Play all tracks') as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    useAudioMock.mockReturnValueOnce({
      tracks: [
        { state: { id: '1', title: 'Test track', playing: true }, x: 10, y: 20 },
      ],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });

    render(<Canvas />);

    expect((screen.getByTitle('Play all tracks') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the Play All button and calls playAll when a track is not playing', () => {
    useAudioMock.mockReturnValueOnce({
      tracks: [
        { state: { id: '1', title: 'Test track', playing: false }, x: 10, y: 20 },
      ],
      addTracks: mockAddTracks,
      tickCurrentTimes: mockTickCurrentTimes,
      stopAll: mockStopAll,
      playAll: mockPlayAll,
    });

    render(<Canvas />);

    const playAllBtn = screen.getByTitle('Play all tracks') as HTMLButtonElement;
    expect(playAllBtn.disabled).toBe(false);
    fireEvent.click(playAllBtn);
    expect(mockPlayAll).toHaveBeenCalledTimes(1);
  });
});
