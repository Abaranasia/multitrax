/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';

const mockAudioEngine = createMockAudioEngine();

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { ChannelStrip } from '@/renderer/components/MixerView/ChannelStrip';
import { TrackState } from '@/renderer/domain/TrackState';
import { TrackEntry } from '@/renderer/context/audioContextInstance';
import { AudioProvider } from '@/renderer/context/AudioContext';
import { useAudio } from '@/renderer/context/useAudio';
import { baseTrackState as baseState } from '@/__tests__/test-utils/trackStateFixture';

describe('ChannelStrip', () => {
  const makeTrack = (state: TrackState): TrackEntry => ({
    state,
    filePath: '/sample.wav',
    x: 10,
    y: 20,
  });

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.keys(mockAudioEngine).forEach(
      (k) => ((mockAudioEngine as any)[k] = (mockAudioEngine as any)[k] || vi.fn()),
    );
  });

  afterEach(() => cleanup());

  it('renders the track title and a waveform preview', () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState, waveform: [0.2, 0.6, 0.4] })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(screen.getByText('Sample Track')).toBeTruthy();
    expect(document.querySelector('.waveform-canvas')).toBeTruthy();
  });

  it('seeks via arrow keys on the waveform shell', async () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState, currentTime: 5 })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    const shell = document.querySelector('.waveform-shell') as HTMLDivElement;
    fireEvent.keyDown(shell, { key: 'ArrowRight' });

    await waitFor(() => expect(mockAudioEngine.seek).toHaveBeenCalledWith('track-1', 10));
  });

  it('renders a VU meter next to the fader', () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(document.querySelector('.mixer-meter')).toBeTruthy();
  });

  it('shows a 0.0 dB readout at full volume and -∞ dB when muted', () => {
    const { rerender } = render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState, volume: 1 })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(screen.getByText('0.0 dB')).toBeTruthy();

    rerender(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState, volume: 0 })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(screen.getByText('-∞ dB')).toBeTruthy();
  });

  it('calls play through the audio engine when the transport play button is clicked', async () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByTitle('Play'));
    await waitFor(() => expect(mockAudioEngine.play).toHaveBeenCalledWith('track-1'));
  });

  it('changes volume and calls engine.setVolume for the same track', async () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    const volumeInput = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    fireEvent.change(volumeInput, { target: { value: '0.5' } });
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0.5));
  });

  it('changes pan and calls engine.setPan for the same track', async () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    const panInput = document.querySelector(
      '.mixer-pan-dial-input',
    ) as HTMLInputElement;
    fireEvent.change(panInput, { target: { value: '-0.5' } });
    await waitFor(() => expect(mockAudioEngine.setPan).toHaveBeenCalledWith('track-1', -0.5));
  });

  // Mute/solo (unlike volume/pan above) look the track up in AudioProvider's
  // own `tracks` state to compute the effective (post mute/solo) gain, so
  // these two cases seed that state via `addTracks` first — mirroring
  // `SeededTrackPlayer` in TrackPlayer.test.tsx — instead of only passing a
  // `track` prop that AudioProvider never learns about.
  const SeededChannelStrip = ({ track }: { track: TrackEntry }) => {
    const audio = useAudio();
    React.useEffect(() => {
      void audio.addTracks([
        { path: track.filePath, name: track.state.title, buffer: new ArrayBuffer(4) },
      ]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <ChannelStrip
        track={track}
        isDragging={false}
        onDragHandleMouseDown={vi.fn()}
        onDragHandleKeyDown={vi.fn()}
      />
    );
  };

  it('clicking Mute calls engine.setVolume(id, 0) for the same track', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
      () => 'track-1' as `${string}-${string}-${string}-${string}-${string}`,
    );

    render(
      <AudioProvider>
        <SeededChannelStrip track={makeTrack({ ...baseState })} />
      </AudioProvider>,
    );

    await screen.findByText('Sample Track');
    const muteButton = document.querySelector('.btn-mute') as HTMLButtonElement;
    fireEvent.click(muteButton);
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 0));
  });

  it('clicking Solo routes through the audio context (this track stays audible)', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
      () => 'track-1' as `${string}-${string}-${string}-${string}-${string}`,
    );

    render(
      <AudioProvider>
        <SeededChannelStrip track={makeTrack({ ...baseState, volume: 1 })} />
      </AudioProvider>,
    );

    await screen.findByText('Sample Track');
    fireEvent.click(screen.getByTitle('Solo'));
    // Soloing the only track on screen leaves it audible at its own volume.
    await waitFor(() => expect(mockAudioEngine.setVolume).toHaveBeenCalledWith('track-1', 1));
  });

  it('opens the filter settings dialog from the effect toggles', async () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByTitle('Filter settings'));
    expect(await screen.findByText('Apply')).toBeTruthy();
  });

  it('calls onDragHandleMouseDown with the track id when the grip is pressed', () => {
    const onDragHandleMouseDown = vi.fn();
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={onDragHandleMouseDown}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    fireEvent.mouseDown(screen.getByTitle('Drag to reorder (or focus and use ←/→)'));

    expect(onDragHandleMouseDown).toHaveBeenCalledTimes(1);
    expect(onDragHandleMouseDown.mock.calls[0][0]).toBe('track-1');
  });

  it('exposes the grip as a focusable button and calls onDragHandleKeyDown with the track id on keydown', () => {
    const onDragHandleKeyDown = vi.fn();
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={onDragHandleKeyDown}
        />
      </AudioProvider>,
    );

    const grip = screen.getByTitle('Drag to reorder (or focus and use ←/→)');
    expect(grip.getAttribute('role')).toBe('button');
    expect(grip.tabIndex).toBe(0);

    fireEvent.keyDown(grip, { key: 'ArrowRight' });

    expect(onDragHandleKeyDown).toHaveBeenCalledTimes(1);
    expect(onDragHandleKeyDown.mock.calls[0][0]).toBe('track-1');
  });

  it('adds the is-dragging class to the strip root when isDragging is true', () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={true}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(document.querySelector('.mixer-strip.is-dragging')).toBeTruthy();
  });

  it('does not add the is-dragging class when isDragging is false', () => {
    render(
      <AudioProvider>
        <ChannelStrip
          track={makeTrack({ ...baseState })}
          isDragging={false}
          onDragHandleMouseDown={vi.fn()}
          onDragHandleKeyDown={vi.fn()}
        />
      </AudioProvider>,
    );

    expect(document.querySelector('.mixer-strip.is-dragging')).toBeNull();
    expect(document.querySelector('.mixer-strip')).toBeTruthy();
  });
});
