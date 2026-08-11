/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';
import { createMockElectronAPI } from '@/__tests__/test-utils/mockElectronAPI';

const mockAudioEngine = createMockAudioEngine();

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { TrackPlayer } from '@/renderer/components/TrackPlayer/TrackPlayer';
import { TrackState } from '@/renderer/domain/TrackState';
import { AudioProvider } from '@/renderer/context/AudioContext';
import { useAudio } from '@/renderer/context/useAudio';
import { baseTrackState as baseState } from '@/__tests__/test-utils/trackStateFixture';

describe('TrackPlayer', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.keys(mockAudioEngine).forEach(
      (k) => ((mockAudioEngine as any)[k] = (mockAudioEngine as any)[k] || vi.fn()),
    );

    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: vi.fn(() => baseState.id) },
        configurable: true,
      });
    } else {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
        () => baseState.id as `${string}-${string}-${string}-${string}-${string}`,
      );
    }
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'electronAPI');
  });

  // Registers a track matching `state.id` into AudioContext's internal track
  // list (via addTracks) before rendering, so context actions that look the
  // track up by id — like duplicateTrack — have something to find.
  const SeededTrackPlayer = ({ state, x, y }: { state: TrackState; x: number; y: number }) => {
    const audio = useAudio();
    React.useEffect(() => {
      void audio.addTracks([
        { path: '/sample.wav', name: state.title, buffer: new ArrayBuffer(4) },
      ]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <TrackPlayer filePath="/sample.wav" state={state} x={x} y={y} />;
  };

  it('renders a waveform preview for the track', () => {
    render(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, waveform: [0.2, 0.6, 0.4] }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    expect(document.querySelector('.waveform-canvas')).toBeTruthy();
    const canvas = document.querySelector('.waveform-canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });

  it('shows only the file name in the visible title while keeping the full path in the tooltip', () => {
    const fullPath = 'C:/Users/demo/Music/track-name.wav';

    render(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, title: fullPath }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    const title = document.querySelector('.track-title') as HTMLSpanElement;
    expect(title).toBeTruthy();
    expect(title.textContent).toBe('track-name.wav');
    expect(title.getAttribute('title')).toBe(fullPath);
  });

  it('calls play and pause through the audio engine when playback button is clicked', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, playing: true }} x={10} y={20} />
      </AudioProvider>,
    );

    const pauseBtn = screen.getByTitle('Pause');
    fireEvent.click(pauseBtn);
    await waitFor(() => expect(mockAudioEngine.pause).toHaveBeenCalledWith('track-1'));
  });

  it('calls stop and resets time via engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, currentTime: 5 }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    const stopBtn = screen.getByTitle('Stop');
    fireEvent.click(stopBtn);
    await waitFor(() => expect(mockAudioEngine.stop).toHaveBeenCalledWith('track-1'));
  });

  it('toggles loop, fade in/out and seek-fade and calls engine setters', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    // Loop toggle
    const loopButton = screen.getByTitle('Enable loop');
    fireEvent.click(loopButton);
    await waitFor(() => expect(mockAudioEngine.setLoop).toHaveBeenCalledWith('track-1', true));

    // Fade in toggle
    const fadeInButton = document.querySelector('.toggle--fade-in') as HTMLButtonElement;
    fireEvent.click(fadeInButton);
    await waitFor(() => expect(mockAudioEngine.setFadeIn).toHaveBeenCalledWith('track-1', true));

    // Fade out toggle
    const fadeOutButton = document.querySelector('.toggle--fade-out') as HTMLButtonElement;
    fireEvent.click(fadeOutButton);
    await waitFor(() => expect(mockAudioEngine.setFadeOut).toHaveBeenCalledWith('track-1', true));

    // Seek fade toggle
    const seekFadeButton = document.querySelector('.toggle--seek-fade') as HTMLButtonElement;
    fireEvent.click(seekFadeButton);
    await waitFor(() => expect(mockAudioEngine.setSeekFade).toHaveBeenCalledWith('track-1', true));
  });

  it('opens settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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

    await waitFor(() =>
      expect(mockAudioEngine.setFadeDurations).toHaveBeenCalledWith('track-1', 2.5, 3.5, 1),
    );
  });

  it('discards fade draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const settingsBtn = screen.getByTitle('Configure fade durations');
    fireEvent.click(settingsBtn);

    const ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '9' } });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Apply')).toBeNull();
    expect(mockAudioEngine.setFadeDurations).not.toHaveBeenCalled();
  });

  it('reseeds fade draft values from the latest track state when reopened, discarding both the prior cancelled edit and the original mount value', async () => {
    const { rerender } = render(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, fadeInDuration: 5 }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    // Open, edit without applying, then close without applying (Cancel).
    fireEvent.click(screen.getByTitle('Configure fade durations'));
    await screen.findByText('Apply');
    let ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '9' } });
    fireEvent.click(screen.getByText('Cancel'));

    // Track state changes elsewhere (e.g. duplicate/undo) while the dialog is closed.
    rerender(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, fadeInDuration: 7 }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    // Reopening must reseed from the latest committed state (7), not the
    // discarded draft edit (9) nor the original mount value (5).
    fireEvent.click(screen.getByTitle('Configure fade durations'));
    await screen.findByText('Apply');
    ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    expect((ranges[0] as HTMLInputElement).value).toBe('7');
  });

  it('opens filter settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const filterBtn = screen.getByTitle('Filter settings');
    fireEvent.click(filterBtn);

    const applyBtn = await screen.findByText('Apply');
    const select = document.querySelector('.filter-settings-select') as HTMLSelectElement;
    const ranges = document.querySelectorAll('.filter-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);

    fireEvent.change(select, { target: { value: 'highpass' } });
    fireEvent.change(ranges[0], { target: { value: '500' } }); // cutoff
    fireEvent.change(ranges[1], { target: { value: '4' } }); // resonance
    fireEvent.change(ranges[2], { target: { value: '90' } }); // output
    fireEvent.change(ranges[3], { target: { value: '70' } }); // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setFilterSettings).toHaveBeenCalledWith('track-1', {
        type: 'highpass',
        cutoff: 500,
        resonance: 4,
        mix: 70,
        output: 90,
      }),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards filter draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, filterMix: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Filter settings').className).not.toContain('btn-filter--active');

    rerender(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, filterMix: 40 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Filter settings').className).toContain('btn-filter--active');
  });

  it('opens delay settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const delayBtn = screen.getByTitle('Delay settings');
    fireEvent.click(delayBtn);

    const applyBtn = await screen.findByText('Apply');
    const ranges = document.querySelectorAll('.delay-settings-panel input[type=range]');
    expect(ranges.length).toBe(5);

    fireEvent.change(ranges[0], { target: { value: '450' } }); // time
    fireEvent.change(ranges[1], { target: { value: '60' } }); // feedback
    fireEvent.change(ranges[2], { target: { value: '30' } }); // tone
    fireEvent.change(ranges[3], { target: { value: '90' } }); // output
    fireEvent.change(ranges[4], { target: { value: '40' } }); // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setDelaySettings).toHaveBeenCalledWith('track-1', {
        delayTime: 450,
        feedback: 60,
        mix: 40,
        damping: 30,
        output: 90,
      }),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards delay draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
    fireEvent.change(ranges[1], { target: { value: '20' } }); // damping
    fireEvent.change(ranges[2], { target: { value: '80' } }); // output
    fireEvent.change(ranges[3], { target: { value: '60' } }); // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setReverbSettings).toHaveBeenCalledWith('track-1', {
        room: 'cathedral',
        mix: 60,
        preDelay: 100,
        damping: 20,
        output: 80,
      }),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards reverb draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, reverbMix: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Reverb settings').className).not.toContain('btn-reverb--active');

    rerender(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, reverbMix: 40 }} x={10} y={20} />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Reverb settings').className).toContain('btn-reverb--active');
  });

  it('opens distortion settings, updates draft values and applies them to engine', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const distortionBtn = screen.getByTitle('Waveshape settings');
    fireEvent.click(distortionBtn);

    const applyBtn = await screen.findByText('Apply');
    const ranges = document.querySelectorAll('.distortion-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);

    fireEvent.change(ranges[0], { target: { value: '75' } }); // drive
    fireEvent.change(ranges[1], { target: { value: '30' } }); // tone
    fireEvent.change(ranges[2], { target: { value: '90' } }); // output
    fireEvent.change(ranges[3], { target: { value: '60' } }); // mix (bottom field)

    fireEvent.click(applyBtn);

    await waitFor(() =>
      expect(mockAudioEngine.setDistortionSettings).toHaveBeenCalledWith('track-1', {
        drive: 75,
        tone: 30,
        mix: 60,
        output: 90,
      }),
    );

    // Overlay closes after apply
    expect(screen.queryByText('Apply')).toBeNull();
  });

  it('discards distortion draft changes and does not call the engine when cancelled', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const distortionBtn = screen.getByTitle('Waveshape settings');
    fireEvent.click(distortionBtn);

    const ranges = document.querySelectorAll('.distortion-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '95' } });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Apply')).toBeNull();
    expect(mockAudioEngine.setDistortionSettings).not.toHaveBeenCalled();
  });

  it('shows the distortion button as active only when distortionMix is above 0', () => {
    const { rerender } = render(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, distortionMix: 0 }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Waveshape settings').className).not.toContain(
      'btn-distortion--active',
    );

    rerender(
      <AudioProvider>
        <TrackPlayer
          filePath="/sample.wav"
          state={{ ...baseState, distortionMix: 40 }}
          x={10}
          y={20}
        />
      </AudioProvider>,
    );

    expect(screen.getByTitle('Waveshape settings').className).toContain('btn-distortion--active');
  });

  it('opens a context menu on right-click and duplicates the track', async () => {
    render(
      <AudioProvider>
        <SeededTrackPlayer state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    await waitFor(() =>
      expect(mockAudioEngine.addTrack).toHaveBeenCalledWith('track-1', expect.anything()),
    );
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

  it('reveals the track source file in the OS file manager from the context menu', async () => {
    const revealFile = vi.fn(() => Promise.resolve({ revealed: true }));
    window.electronAPI = createMockElectronAPI({ revealFile });

    render(
      <AudioProvider>
        <TrackPlayer filePath="/music/library/song.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    fireEvent.contextMenu(screen.getByTitle(baseState.title), { clientX: 100, clientY: 150 });

    const revealItem = await screen.findByText<HTMLButtonElement>('Show in Folder');
    expect(revealItem.disabled).toBe(false);
    fireEvent.click(revealItem);

    await waitFor(() => expect(revealFile).toHaveBeenCalledWith('/music/library/song.wav'));
    // Menu closes after the action is taken
    expect(screen.queryByText('Show in Folder')).toBeNull();
  });

  it('disables Show in Folder for a track whose path is not a real file location', async () => {
    window.electronAPI = createMockElectronAPI();

    render(
      <AudioProvider>
        <TrackPlayer filePath="song.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    fireEvent.contextMenu(screen.getByTitle(baseState.title), { clientX: 100, clientY: 150 });

    const revealItem = await screen.findByText<HTMLButtonElement>('Show in Folder');
    expect(revealItem.disabled).toBe(true);
    expect(window.electronAPI.revealFile).not.toHaveBeenCalled();
  });

  it('closes the context menu when clicking outside of it', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
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
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const volumeInput = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    fireEvent.change(volumeInput, { target: { value: '0.5' } });
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0.5));
  });

  it('mutes the track by setting volume to 0 and unmutes back to the last volume when the icon is clicked again', async () => {
    const { rerender } = render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, volume: 0.6 }} x={10} y={20} />
      </AudioProvider>,
    );

    const muteButton = screen.getByTitle('Mute');
    fireEvent.click(muteButton);
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0));

    rerender(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, volume: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    const unmuteButton = screen.getByTitle('Unmute');
    fireEvent.click(unmuteButton);
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0.6));
  });

  it('renders the pan slider above the volume control, centered by default, and calls engine.setPan', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState }} x={10} y={20} />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.pan-control input[type=range]') as HTMLInputElement;
    expect(panInput.value).toBe('0');
    expect(panInput.min).toBe('-1');
    expect(panInput.max).toBe('1');

    // Pan control should come before the volume control in document order.
    const controls = Array.from(document.querySelectorAll('.pan-control, .volume-control'));
    expect(controls[0].className).toContain('pan-control');
    expect(controls[1].className).toContain('volume-control');

    fireEvent.change(panInput, { target: { value: '-0.6' } });
    await waitFor(() => expect(mockAudioEngine.setPan).toHaveBeenCalledWith('track-1', -0.6));
  });

  it('renders a directional gradient background for the pan slider when it is offset to the left', () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, pan: -0.6 }} x={10} y={20} />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.pan-control input[type=range]') as HTMLInputElement;
    expect(panInput.className).toContain('pan-input--left');
    expect(panInput.className).not.toContain('pan-input--right');
    expect(panInput.style.getPropertyValue('--pan-fill')).toBe('20%');
  });

  it('renders a directional gradient background for the pan slider when it is offset to the right', () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, pan: 0.6 }} x={10} y={20} />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.pan-control input[type=range]') as HTMLInputElement;
    expect(panInput.className).toContain('pan-input--right');
    expect(panInput.className).not.toContain('pan-input--left');
    expect(panInput.style.getPropertyValue('--pan-fill')).toBe('80%');
  });

  it('applies no directional modifier class when pan is centered', () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, pan: 0 }} x={10} y={20} />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.pan-control input[type=range]') as HTMLInputElement;
    expect(panInput.className).not.toContain('pan-input--left');
    expect(panInput.className).not.toContain('pan-input--right');
    expect(panInput.style.getPropertyValue('--pan-fill')).toBe('50%');
  });

  it('sets --volume-fill as a CSS custom property reflecting the current volume', () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, volume: 0.75 }} x={10} y={20} />
      </AudioProvider>,
    );

    const volumeInput = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    expect(volumeInput.style.getPropertyValue('--volume-fill')).toBe('75%');
  });

  it('recenters pan to 0 when the pan slider is double-clicked', async () => {
    render(
      <AudioProvider>
        <TrackPlayer filePath="/sample.wav" state={{ ...baseState, pan: -0.6 }} x={10} y={20} />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.pan-control input[type=range]') as HTMLInputElement;
    fireEvent.doubleClick(panInput);
    await waitFor(() => expect(mockAudioEngine.setPan).toHaveBeenCalledWith('track-1', 0));
  });
});
