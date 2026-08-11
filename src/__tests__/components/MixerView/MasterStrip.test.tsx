import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';

const mockAudioEngine = createMockAudioEngine();

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

import { MasterStrip } from '@/renderer/components/MixerView/MasterStrip';
import { AudioProvider } from '@/renderer/context/AudioContext';

describe('MasterStrip', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it('renders the "Master" title', () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    expect(screen.getByText('Master')).toBeTruthy();
  });

  it('moving the fader calls setMasterVolume', async () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    const volumeInput = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    fireEvent.change(volumeInput, { target: { value: '0.5' } });

    await waitFor(() => expect(mockAudioEngine.setMasterVolume).toHaveBeenCalledWith(0.5));
  });

  it('turning the dial calls setMasterBalance', async () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    const panInput = document.querySelector('.mixer-pan-dial-input') as HTMLInputElement;
    fireEvent.change(panInput, { target: { value: '-0.4' } });

    await waitFor(() => expect(mockAudioEngine.setMasterBalance).toHaveBeenCalledWith(-0.4));
  });

  it('renders two VU meters (left/right)', () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    expect(document.querySelectorAll('.mixer-meter').length).toBe(2);
  });

  it('renders a static OUT placeholder instead of a waveform', () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    expect(document.querySelector('.mixer-strip-out')).toBeTruthy();
    expect(document.querySelector('.waveform-canvas')).toBeNull();
  });

  it('does not render a drag grip, effect toggles, or mute/solo buttons', () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    expect(document.querySelector('.mixer-strip-grip')).toBeNull();
    expect(document.querySelector('.track-effects')).toBeNull();
    expect(document.querySelector('.mixer-mute-solo')).toBeNull();
  });

  it('shows a 0.0 dB readout at the default master volume', () => {
    render(
      <AudioProvider>
        <MasterStrip />
      </AudioProvider>,
    );

    expect(screen.getByText('0.0 dB')).toBeTruthy();
  });
});
