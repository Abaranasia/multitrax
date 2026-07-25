/* eslint-disable @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { DelaySettingsDialog } from '@/renderer/components/TrackPlayer/components/effects/delay/DelaySettingsDialog';
import { createMockAudioEngine } from '@/__tests__/test-utils/mockAudioEngine';

const mockAudioEngine = createMockAudioEngine();

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

// Imported after the mock above (vi.mock is hoisted by vitest) so TrackPlayer
// wires against the mocked engine for the integration suite below.
import { TrackPlayer } from '@/renderer/components/TrackPlayer/TrackPlayer';
import { TrackState } from '@/renderer/domain/TrackState';
import { AudioProvider } from '@/renderer/context/AudioContext';

describe('DelaySettingsDialog', () => {
  afterEach(() => cleanup());

  const baseProps = {
    draftDelayTime: 300,
    setDraftDelayTime: vi.fn(),
    draftDelayFeedback: 35,
    setDraftDelayFeedback: vi.fn(),
    draftDelayDamping: 50,
    setDraftDelayDamping: vi.fn(),
    draftDelayOutput: 100,
    setDraftDelayOutput: vi.fn(),
    draftDelayMix: 0,
    setDraftDelayMix: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the draft values', () => {
    render(<DelaySettingsDialog {...baseProps} />);

    const ranges = document.querySelectorAll('.delay-settings-panel input[type=range]');
    expect(ranges.length).toBe(5);
    expect((ranges[0] as HTMLInputElement).value).toBe('300');
    expect((ranges[1] as HTMLInputElement).value).toBe('35');
    expect((ranges[2] as HTMLInputElement).value).toBe('50');
    expect((ranges[3] as HTMLInputElement).value).toBe('100');
    expect((ranges[4] as HTMLInputElement).value).toBe('0');
  });

  it('calls the setters when fields change', () => {
    const props = { ...baseProps, setDraftDelayTime: vi.fn(), setDraftDelayFeedback: vi.fn() };
    render(<DelaySettingsDialog {...props} />);

    const ranges = document.querySelectorAll('.delay-settings-panel input[type=range]');
    fireEvent.change(ranges[0], { target: { value: '450' } });
    expect(props.setDraftDelayTime).toHaveBeenCalledWith(450);

    fireEvent.change(ranges[1], { target: { value: '60' } });
    expect(props.setDraftDelayFeedback).toHaveBeenCalledWith(60);
  });

  it('calls onApply when Apply is clicked and onCancel when Cancel is clicked', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<DelaySettingsDialog {...baseProps} onApply={onApply} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop but not when clicking inside the panel', () => {
    const onCancel = vi.fn();
    render(<DelaySettingsDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.click(document.querySelector('.delay-settings-panel') as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.delay-settings-overlay') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Integration coverage moved here from TrackPlayer.test.tsx so this suite is
  // the sole owner of Delay's open/apply/cancel assertions (dedicated-suite
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
  });
});
