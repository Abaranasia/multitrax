/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { FadeSettingsDialog } from '@/renderer/components/TrackPlayer/components/fadeSettings/FadeSettingsDialog';

const mockAudioEngine = {
  audioContext: {
    decodeAudioData: vi.fn(async (b: ArrayBuffer) => ({ duration: 3 }) as unknown as AudioBuffer),
  },
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  getBuffer: vi.fn((_id: string) => ({ duration: 12 }) as unknown as AudioBuffer),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  stopAll: vi.fn(),
  playAll: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  setPan: vi.fn(),
  setLoop: vi.fn(),
  setFadeIn: vi.fn(),
  setFadeOut: vi.fn(),
  setSeekFade: vi.fn(),
  setFadeDurations: vi.fn(),
  setFilterSettings: vi.fn(),
  setDelaySettings: vi.fn(),
  setReverbSettings: vi.fn(),
  setDistortionSettings: vi.fn(),
  isPlaying: vi.fn().mockReturnValue(false),
  getCurrentTime: vi.fn().mockReturnValue(0),
  close: vi.fn(),
};

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

// Imported after the mock above (vi.mock is hoisted by vitest) so TrackPlayer
// wires against the mocked engine for the integration suite below.
import { TrackPlayer } from '@/renderer/components/TrackPlayer/TrackPlayer';
import { TrackState } from '@/renderer/domain/TrackState';
import { AudioProvider } from '@/renderer/context/AudioContext';

describe('FadeSettingsDialog', () => {
  afterEach(() => cleanup());

  const baseProps = {
    draftFadeIn: 5,
    setDraftFadeIn: vi.fn(),
    draftFadeOut: 5,
    setDraftFadeOut: vi.fn(),
    draftSeekFade: 2,
    setDraftSeekFade: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the draft values', () => {
    render(<FadeSettingsDialog {...baseProps} />);

    const ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    expect(ranges.length).toBe(3);
    expect((ranges[0] as HTMLInputElement).value).toBe('5');
    expect((ranges[1] as HTMLInputElement).value).toBe('5');
    expect((ranges[2] as HTMLInputElement).value).toBe('2');
  });

  it('calls the setters when fields change', () => {
    const props = { ...baseProps, setDraftFadeIn: vi.fn(), setDraftFadeOut: vi.fn() };
    render(<FadeSettingsDialog {...props} />);

    const ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '2.5' } });
    expect(props.setDraftFadeIn).toHaveBeenCalledWith(2.5);

    fireEvent.change(ranges[1], { target: { value: '3.5' } });
    expect(props.setDraftFadeOut).toHaveBeenCalledWith(3.5);
  });

  it('calls onApply when Apply is clicked and onCancel when Cancel is clicked', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<FadeSettingsDialog {...baseProps} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop but not when clicking inside the panel', () => {
    const onCancel = vi.fn();
    render(<FadeSettingsDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.click(document.querySelector('.fade-settings-panel') as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.fade-settings-overlay') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Integration coverage moved here from TrackPlayer.test.tsx so this suite is
  // the sole owner of Fade's open/apply/cancel assertions (dedicated-suite
  // requirement from the extract-track-overlays spec).
  describe('integration via TrackPlayer', () => {
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

    beforeEach(() => {
      cleanup();
      vi.clearAllMocks();
    });
    afterEach(() => cleanup());

    it('opens fade settings, updates draft values and applies them to engine', async () => {
      render(
        <AudioProvider>
          <TrackPlayer state={{ ...baseState }} x={10} y={20} />
        </AudioProvider>,
      );

      const settingsBtn = screen.getByTitle('Configure fade durations');
      fireEvent.click(settingsBtn);

      const applyBtn = await screen.findByText('Apply');
      const ranges = document.querySelectorAll('.fade-settings-panel input[type=range]');
      expect(ranges.length).toBe(3);

      fireEvent.change(ranges[0], { target: { value: '2.5' } });
      fireEvent.change(ranges[1], { target: { value: '3.5' } });
      fireEvent.change(ranges[2], { target: { value: '1' } });

      fireEvent.click(applyBtn);

      await waitFor(() =>
        expect(mockAudioEngine.setFadeDurations).toHaveBeenCalledWith('track-1', 2.5, 3.5, 1),
      );

      // Overlay closes after apply
      expect(screen.queryByText('Apply')).toBeNull();
    });

    it('discards fade draft changes and does not call the engine when cancelled', async () => {
      render(
        <AudioProvider>
          <TrackPlayer state={{ ...baseState }} x={10} y={20} />
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
  });
});
