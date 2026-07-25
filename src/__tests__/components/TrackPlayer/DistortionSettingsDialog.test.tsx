/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { DistortionSettingsDialog } from '@/renderer/components/TrackPlayer/DistortionSettingsDialog';

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

describe('DistortionSettingsDialog', () => {
  afterEach(() => cleanup());

  const baseProps = {
    draftDrive: 40,
    setDraftDrive: vi.fn(),
    draftTone: 60,
    setDraftTone: vi.fn(),
    draftMix: 0,
    setDraftMix: vi.fn(),
    draftOutput: 100,
    setDraftOutput: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the draft values', () => {
    render(<DistortionSettingsDialog {...baseProps} />);

    const ranges = document.querySelectorAll('.distortion-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);
    expect((ranges[0] as HTMLInputElement).value).toBe('40');
    expect((ranges[1] as HTMLInputElement).value).toBe('60');
    expect((ranges[2] as HTMLInputElement).value).toBe('100');
    expect((ranges[3] as HTMLInputElement).value).toBe('0');
  });

  it('calls the setters when fields change', () => {
    const props = { ...baseProps, setDraftDrive: vi.fn(), setDraftTone: vi.fn() };
    render(<DistortionSettingsDialog {...props} />);

    const ranges = document.querySelectorAll('.distortion-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '75' } });
    expect(props.setDraftDrive).toHaveBeenCalledWith(75);

    fireEvent.change(ranges[1], { target: { value: '30' } });
    expect(props.setDraftTone).toHaveBeenCalledWith(30);
  });

  it('calls onApply when Apply is clicked and onCancel when Cancel is clicked', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<DistortionSettingsDialog {...baseProps} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop but not when clicking inside the panel', () => {
    const onCancel = vi.fn();
    render(<DistortionSettingsDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.click(document.querySelector('.distortion-settings-panel') as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.distortion-settings-overlay') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Integration coverage moved here from TrackPlayer.test.tsx so this suite is
  // the sole owner of Distortion's open/apply/cancel/active-button assertions
  // (dedicated-suite requirement from the extract-track-overlays spec).
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

    it('opens Waveshape settings, updates draft values and applies them to engine', async () => {
      render(
        <AudioProvider>
          <TrackPlayer state={{ ...baseState }} x={10} y={20} />
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
        expect(mockAudioEngine.setDistortionSettings).toHaveBeenCalledWith(
          'track-1',
          75,
          30,
          60,
          90,
        ),
      );

      // Overlay closes after apply
      expect(screen.queryByText('Apply')).toBeNull();
    });

    it('discards distortion draft changes and does not call the engine when cancelled', async () => {
      render(
        <AudioProvider>
          <TrackPlayer state={{ ...baseState }} x={10} y={20} />
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
          <TrackPlayer state={{ ...baseState, distortionMix: 0 }} x={10} y={20} />
        </AudioProvider>,
      );

      expect(screen.getByTitle('Waveshape settings').className).not.toContain(
        'btn-distortion--active',
      );

      rerender(
        <AudioProvider>
          <TrackPlayer state={{ ...baseState, distortionMix: 40 }} x={10} y={20} />
        </AudioProvider>,
      );

      expect(screen.getByTitle('Waveshape settings').className).toContain(
        'btn-distortion--active',
      );
    });
  });
});
