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

describe('ChannelStrip', () => {
  const baseState: TrackState = {
    id: 'track-1',
    title: 'Sample Track',
    duration: 12,
    currentTime: 0,
    volume: 1,
    pan: 0,
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
    distortionDrive: 0,
    distortionTone: 100,
    distortionMix: 0,
    distortionOutput: 100,
  };

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
        <ChannelStrip track={makeTrack({ ...baseState, waveform: [0.2, 0.6, 0.4] })} />
      </AudioProvider>,
    );

    expect(screen.getByText('Sample Track')).toBeTruthy();
    expect(document.querySelector('.waveform-canvas')).toBeTruthy();
  });

  it('shows a 0.0 dB readout at full volume and -∞ dB when muted', () => {
    const { rerender } = render(
      <AudioProvider>
        <ChannelStrip track={makeTrack({ ...baseState, volume: 1 })} />
      </AudioProvider>,
    );

    expect(screen.getByText('0.0 dB')).toBeTruthy();

    rerender(
      <AudioProvider>
        <ChannelStrip track={makeTrack({ ...baseState, volume: 0 })} />
      </AudioProvider>,
    );

    expect(screen.getByText('-∞ dB')).toBeTruthy();
  });

  it('calls play through the audio engine when the transport play button is clicked', async () => {
    render(
      <AudioProvider>
        <ChannelStrip track={makeTrack({ ...baseState })} />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByTitle('Play'));
    await waitFor(() => expect(mockAudioEngine.play).toHaveBeenCalledWith('track-1'));
  });

  it('changes volume and calls engine.setVolume for the same track', async () => {
    render(
      <AudioProvider>
        <ChannelStrip track={makeTrack({ ...baseState })} />
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
        <ChannelStrip track={makeTrack({ ...baseState })} />
      </AudioProvider>,
    );

    const panInput = document.querySelector(
      '.mixer-pan-dial-input',
    ) as HTMLInputElement;
    fireEvent.change(panInput, { target: { value: '-0.5' } });
    await waitFor(() => expect(mockAudioEngine.setPan).toHaveBeenCalledWith('track-1', -0.5));
  });

  it('opens the filter settings dialog from the effect toggles', async () => {
    render(
      <AudioProvider>
        <ChannelStrip track={makeTrack({ ...baseState })} />
      </AudioProvider>,
    );

    fireEvent.click(screen.getByTitle('Filter settings'));
    expect(await screen.findByText('Apply')).toBeTruthy();
  });
});
