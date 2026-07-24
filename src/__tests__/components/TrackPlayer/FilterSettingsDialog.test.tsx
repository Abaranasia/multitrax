/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { FilterSettingsDialog } from '@/renderer/components/TrackPlayer/FilterSettingsDialog';

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

describe('FilterSettingsDialog', () => {
  afterEach(() => cleanup());

  const baseProps = {
    draftType: 'lowpass' as const,
    setDraftType: vi.fn(),
    draftCutoff: 1000,
    setDraftCutoff: vi.fn(),
    draftResonance: 1,
    setDraftResonance: vi.fn(),
    draftMix: 0,
    setDraftMix: vi.fn(),
    draftOutput: 100,
    setDraftOutput: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the draft values', () => {
    render(<FilterSettingsDialog {...baseProps} />);

    expect((document.querySelector('.filter-settings-select') as HTMLSelectElement).value).toBe(
      'lowpass',
    );
    const ranges = document.querySelectorAll('.filter-settings-panel input[type=range]');
    expect(ranges.length).toBe(4);
    expect((ranges[0] as HTMLInputElement).value).toBe('1000');
    expect((ranges[1] as HTMLInputElement).value).toBe('1');
    expect((ranges[2] as HTMLInputElement).value).toBe('100');
    expect((ranges[3] as HTMLInputElement).value).toBe('0');
  });

  it('calls the setters when fields change', () => {
    const props = { ...baseProps, setDraftType: vi.fn(), setDraftCutoff: vi.fn() };
    render(<FilterSettingsDialog {...props} />);

    fireEvent.change(document.querySelector('.filter-settings-select') as HTMLSelectElement, {
      target: { value: 'bandpass' },
    });
    expect(props.setDraftType).toHaveBeenCalledWith('bandpass');

    const ranges = document.querySelectorAll('.filter-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '2500' } });
    expect(props.setDraftCutoff).toHaveBeenCalledWith(2500);
  });

  it('calls onApply when Apply is clicked and onCancel when Cancel is clicked', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<FilterSettingsDialog {...baseProps} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop but not when clicking inside the panel', () => {
    const onCancel = vi.fn();
    render(<FilterSettingsDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.click(document.querySelector('.filter-settings-panel') as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.filter-settings-overlay') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Integration coverage moved here from TrackPlayer.test.tsx so this suite is
  // the sole owner of Filter's open/apply/cancel/active-button assertions
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
      fireEvent.change(ranges[0], { target: { value: '500' } }); // cutoff
      fireEvent.change(ranges[1], { target: { value: '4' } }); // resonance
      fireEvent.change(ranges[2], { target: { value: '90' } }); // output
      fireEvent.change(ranges[3], { target: { value: '70' } }); // mix (bottom field)

      fireEvent.click(applyBtn);

      await waitFor(() =>
        expect(mockAudioEngine.setFilterSettings).toHaveBeenCalledWith(
          'track-1',
          'highpass',
          500,
          4,
          70,
          90,
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
  });
});
