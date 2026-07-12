import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const mockAudioEngine = {
  audioContext: { decodeAudioData: vi.fn(async (b: ArrayBuffer) => ({ duration: 3 } as unknown as AudioBuffer)) },
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  getBuffer: vi.fn((_id: string) => ({ duration: 12 } as unknown as AudioBuffer)),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  stopAll: vi.fn(),
  playAll: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  setLoop: vi.fn(),
  setFadeIn: vi.fn(),
  setFadeOut: vi.fn(),
  setSeekFade: vi.fn(),
  setFadeDurations: vi.fn(),
  setFilterSettings: vi.fn(),
  setDelaySettings: vi.fn(),
  setReverbSettings: vi.fn(),
  isPlaying: vi.fn().mockReturnValue(false),
  getCurrentTime: vi.fn().mockReturnValue(0),
  close: vi.fn(),
};

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { TrackPlayer } from '@/renderer/components/TrackPlayer/TrackPlayer';
import { TrackState } from '@/renderer/domain/TrackState';
import { AudioProvider, useAudio } from '@/renderer/context/AudioContext';

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
  };

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.keys(mockAudioEngine).forEach(k => (mockAudioEngine as any)[k] = (mockAudioEngine as any)[k] || vi.fn());

    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: vi.fn(() => baseState.id) },
        configurable: true,
      });
    } else {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => baseState.id as `${string}-${string}-${string}-${string}-${string}`);
    }
  });

  afterEach(() => cleanup());

  // Registers a track matching `state.id` into AudioContext's internal track
  // list (via addTracks) before rendering, so context actions that look the
  // track up by id — like duplicateTrack — have something to find.
  const SeededTrackPlayer = ({ state, x, y }: { state: TrackState; x: number; y: number }) => {
    const audio = useAudio();
    React.useEffect(() => {
      void audio.addTracks([{ path: '/sample.wav', name: state.title, buffer: new ArrayBuffer(4) }]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <TrackPlayer state={state} x={x} y={y} />;
  };

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

  it('opens filter settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const filterBtn = screen.getByTitle('Filter settings');
    fireEvent.click(filterBtn);

    const applyBtn = await screen.findByText('Apply');
    const select = document.querySelector('.filter-settings-select') as HTMLSelectElement;
    const ranges = document.querySelectorAll('.filter-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);

    fireEvent.change(select, { target: { value: 'highpass' } });
    fireEvent.change(ranges[0], { target: { value: '500' } });  // cutoff
    fireEvent.change(ranges[1], { target: { value: '4' } });    // resonance
    fireEvent.change(ranges[2], { target: { value: '90' } });   // output
    fireEvent.change(ranges[3], { target: { value: '70' } });   // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setFilterSettings).toHaveBeenCalledWith(
        'track-1', 'highpass', 500, 4, 70, 90,
      ),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards filter draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const filterBtn = screen.getByTitle('Filter settings');
    fireEvent.click(filterBtn);

    const ranges = document.querySelectorAll('.filter-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '5000' } });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Apply')).toBeNull();
    expect(mockAudioEngine.setFilterSettings).not.toHaveBeenCalled();
  });

  it('shows the filter button as active only when filterMix is above 0', () => {
    const { rerender } = render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, filterMix: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Filter settings').className).not.toContain('btn-filter--active');

    rerender(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, filterMix: 40 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Filter settings').className).toContain('btn-filter--active');
  });

  it('opens delay settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const delayBtn = screen.getByTitle('Delay settings');
    fireEvent.click(delayBtn);

    const applyBtn = await screen.findByText('Apply');
    const ranges = document.querySelectorAll('.delay-settings-panel input[type=range]');
    expect(ranges.length).toBe(5);

    fireEvent.change(ranges[0], { target: { value: '450' } }); // time
    fireEvent.change(ranges[1], { target: { value: '60' } });  // feedback
    fireEvent.change(ranges[2], { target: { value: '30' } });  // tone
    fireEvent.change(ranges[3], { target: { value: '90' } });  // output
    fireEvent.change(ranges[4], { target: { value: '40' } });  // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setDelaySettings).toHaveBeenCalledWith(
        'track-1', 450, 60, 40, 30, 90,
      ),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards delay draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const delayBtn = screen.getByTitle('Delay settings');
    fireEvent.click(delayBtn);

    const ranges = document.querySelectorAll('.delay-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '900' } });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Apply')).toBeNull();
    expect(mockAudioEngine.setDelaySettings).not.toHaveBeenCalled();
  });

  it('opens reverb settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const reverbBtn = screen.getByTitle('Reverb settings');
    fireEvent.click(reverbBtn);

    const applyBtn = await screen.findByText('Apply');
    const select = document.querySelector('.reverb-settings-select') as HTMLSelectElement;
    const ranges = document.querySelectorAll('.reverb-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);

    fireEvent.change(select, { target: { value: 'cathedral' } });
    fireEvent.change(ranges[0], { target: { value: '100' } }); // pre-delay
    fireEvent.change(ranges[1], { target: { value: '20' } });  // damping
    fireEvent.change(ranges[2], { target: { value: '80' } });  // output
    fireEvent.change(ranges[3], { target: { value: '60' } });  // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setReverbSettings).toHaveBeenCalledWith(
        'track-1', 'cathedral', 60, 100, 20, 80,
      ),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards reverb draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const reverbBtn = screen.getByTitle('Reverb settings');
    fireEvent.click(reverbBtn);

    const ranges = document.querySelectorAll('.reverb-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '75' } });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Apply')).toBeNull();
    expect(mockAudioEngine.setReverbSettings).not.toHaveBeenCalled();
  });

  it('shows the reverb button as active only when reverbMix is above 0', () => {
    const { rerender } = render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, reverbMix: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Reverb settings').className).not.toContain('btn-reverb--active');

    rerender(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState, reverbMix: 40 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Reverb settings').className).toContain('btn-reverb--active');
  });

  it('opens a context menu on right-click and duplicates the track', async () => {
    render(
      <AudioProvider>
        <SeededTrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    await waitFor(() => expect(mockAudioEngine.addTrack).toHaveBeenCalledWith('track-1', expect.anything()));
    mockAudioEngine.addTrack.mockClear();

    expect(screen.queryByText('Duplicate')).toBeNull();

    fireEvent.contextMenu(screen.getByTitle(baseState.title), { clientX: 100, clientY: 150 });

    const duplicateItem = await screen.findByText('Duplicate');
    fireEvent.click(duplicateItem);

    await waitFor(() => expect(mockAudioEngine.addTrack).toHaveBeenCalled());
    expect(mockAudioEngine.getBuffer).toHaveBeenCalledWith('track-1');
    // Menu closes after the action is taken
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('closes the context menu when clicking outside of it', async () => {
    render(
      <AudioProvider>
        <TrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    fireEvent.contextMenu(screen.getByTitle(baseState.title), { clientX: 100, clientY: 150 });
    await screen.findByText('Duplicate');

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByText('Duplicate')).toBeNull());
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
