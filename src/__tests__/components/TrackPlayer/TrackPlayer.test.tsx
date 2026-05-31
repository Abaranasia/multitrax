import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const mockAudioEngine = {
  audioContext: { decodeAudioData: vi.fn(async (b: ArrayBuffer) => ({ duration: 3 } as unknown as AudioBuffer)) },
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  setLoop: vi.fn(),
  setFadeIn: vi.fn(),
  setFadeOut: vi.fn(),
  setSeekFade: vi.fn(),
  setFadeDurations: vi.fn(),
  isPlaying: vi.fn().mockReturnValue(false),
  getCurrentTime: vi.fn().mockReturnValue(0),
  close: vi.fn(),
};

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { TrackPlayer } from '@/renderer/components/TrackPlayer/TrackPlayer';
import { TrackState } from '@/renderer/domain/TrackState';
import { AudioProvider } from '@/renderer/context/AudioContext';

describe('TrackPlayer', () => {
  const baseState: TrackState = {
    id: 'track-1',
    title: 'Sample Track',
    duration: 12,
    currentTime: 0,
    volume: 1,
    loop: false,
    playing: false,
    fadeIn: false,
    fadeOut: false,
    seekFade: false,
    fadeInDuration: 5,
    fadeOutDuration: 5,
    seekFadeDuration: 2,
  };

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.keys(mockAudioEngine).forEach(k => (mockAudioEngine as any)[k] = (mockAudioEngine as any)[k] || vi.fn());
  });

  afterEach(() => cleanup());

  it('calls play and pause through the audio engine when playback button is clicked', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const playBtn = screen.getByTitle('Play');
    fireEvent.click(playBtn);
    await waitFor(() => expect(mockAudioEngine.play).toHaveBeenCalledWith('track-1'));

    // Simulate that engine reports playing
    mockAudioEngine.isPlaying.mockReturnValue(true);

    // Re-render with playing=true to reflect state change in UI
    cleanup();
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, playing: true }} x={10} y={20} />
      </AudioProvider>,
    );

    const pauseBtn = screen.getByTitle('Pause');
    fireEvent.click(pauseBtn);
    await waitFor(() => expect(mockAudioEngine.pause).toHaveBeenCalledWith('track-1'));
  });

  it('calls stop and resets time via engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, currentTime: 5 }} x={10} y={20} />
      </AudioProvider>,
    );

    const stopBtn = screen.getByTitle('Stop');
    fireEvent.click(stopBtn);
    await waitFor(() => expect(mockAudioEngine.stop).toHaveBeenCalledWith('track-1'));
  });

  it('toggles loop, fade in/out and seek-fade and calls engine setters', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    // Loop toggle
    const loopLabel = screen.getByTitle('Enable loop');
    const loopInput = loopLabel.querySelector('input') as HTMLInputElement;
    fireEvent.click(loopInput);
    await waitFor(() => expect(mockAudioEngine.setLoop).toHaveBeenCalledWith('track-1', true));

    // Fade in toggle
    const fadeInInput = document.querySelector('.toggle--fade-in input') as HTMLInputElement;
    fireEvent.click(fadeInInput);
    await waitFor(() => expect(mockAudioEngine.setFadeIn).toHaveBeenCalledWith('track-1', true));

    // Fade out toggle
    const fadeOutInput = document.querySelector('.toggle--fade-out input') as HTMLInputElement;
    fireEvent.click(fadeOutInput);
    await waitFor(() => expect(mockAudioEngine.setFadeOut).toHaveBeenCalledWith('track-1', true));

    // Seek fade toggle
    const seekFadeInput = document.querySelector('.toggle--seek-fade input') as HTMLInputElement;
    fireEvent.click(seekFadeInput);
    await waitFor(() => expect(mockAudioEngine.setSeekFade).toHaveBeenCalledWith('track-1', true));
  });

  it('opens settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const settingsBtn = screen.getByTitle('Configure fade durations');
    fireEvent.click(settingsBtn);

    // find range inputs inside overlay
    const applyBtn = await screen.findByText('Apply');
    const ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    expect(ranges.length).toBe(3);

    // change fade in to 2.5
    fireEvent.change(ranges[0], { target: { value: '2.5' } });
    // change fade out to 3.5
    fireEvent.change(ranges[1], { target: { value: '3.5' } });
    // change seek fade to 1
    fireEvent.change(ranges[2], { target: { value: '1' } });

    fireEvent.click(applyBtn);

    await waitFor(() => expect(mockAudioEngine.setFadeDurations).toHaveBeenCalledWith('track-1', 2.5, 3.5, 1));
  });

  it('changes volume and calls engine.setVolume', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const volumeInput = document.querySelector('.volume-control input[type=range]') as HTMLInputElement;
    fireEvent.change(volumeInput, { target: { value: '0.5' } });
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0.5));
  });
});
