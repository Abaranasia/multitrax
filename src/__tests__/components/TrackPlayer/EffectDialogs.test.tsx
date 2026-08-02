import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { EffectDialogs } from '@/renderer/components/TrackPlayer/components/EffectDialogs';

describe('EffectDialogs', () => {
  afterEach(() => cleanup());

  const closedFilterDialog = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    apply: vi.fn(),
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
  };

  const closedDistortionDialog = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    apply: vi.fn(),
    draftDrive: 0,
    setDraftDrive: vi.fn(),
    draftTone: 100,
    setDraftTone: vi.fn(),
    draftMix: 0,
    setDraftMix: vi.fn(),
    draftOutput: 100,
    setDraftOutput: vi.fn(),
  };

  const closedFadeDialog = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    apply: vi.fn(),
    draftFadeIn: 5,
    setDraftFadeIn: vi.fn(),
    draftFadeOut: 5,
    setDraftFadeOut: vi.fn(),
    draftSeekFade: 2,
    setDraftSeekFade: vi.fn(),
  };

  const closedDelayDialog = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    apply: vi.fn(),
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
  };

  const closedReverbDialog = {
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    apply: vi.fn(),
    draftReverbRoom: 'hall' as const,
    setDraftReverbRoom: vi.fn(),
    draftReverbMix: 0,
    setDraftReverbMix: vi.fn(),
    draftReverbPreDelay: 20,
    setDraftReverbPreDelay: vi.fn(),
    draftReverbDamping: 50,
    setDraftReverbDamping: vi.fn(),
    draftReverbOutput: 100,
    setDraftReverbOutput: vi.fn(),
  };

  const allClosedProps = {
    filterDialog: closedFilterDialog,
    distortionDialog: closedDistortionDialog,
    fadeDialog: closedFadeDialog,
    delayDialog: closedDelayDialog,
    reverbDialog: closedReverbDialog,
  };

  it('renders nothing when all five dialogs are closed', () => {
    render(<EffectDialogs {...allClosedProps} />);

    expect(document.querySelector('.filter-settings-overlay')).toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).toBeNull();
  });

  it('renders only the filter dialog when filterDialog.isOpen is true', () => {
    render(<EffectDialogs {...allClosedProps} filterDialog={{ ...closedFilterDialog, isOpen: true }} />);

    expect(document.querySelector('.filter-settings-overlay')).not.toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).toBeNull();
  });

  it('renders only the distortion dialog when distortionDialog.isOpen is true', () => {
    render(
      <EffectDialogs
        {...allClosedProps}
        distortionDialog={{ ...closedDistortionDialog, isOpen: true }}
      />,
    );

    expect(document.querySelector('.filter-settings-overlay')).toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).not.toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).toBeNull();
  });

  it('renders only the fade dialog when fadeDialog.isOpen is true', () => {
    render(<EffectDialogs {...allClosedProps} fadeDialog={{ ...closedFadeDialog, isOpen: true }} />);

    expect(document.querySelector('.filter-settings-overlay')).toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).not.toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).toBeNull();
  });

  it('renders only the delay dialog when delayDialog.isOpen is true', () => {
    render(
      <EffectDialogs {...allClosedProps} delayDialog={{ ...closedDelayDialog, isOpen: true }} />,
    );

    expect(document.querySelector('.filter-settings-overlay')).toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).not.toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).toBeNull();
  });

  it('renders only the reverb dialog when reverbDialog.isOpen is true', () => {
    render(
      <EffectDialogs {...allClosedProps} reverbDialog={{ ...closedReverbDialog, isOpen: true }} />,
    );

    expect(document.querySelector('.filter-settings-overlay')).toBeNull();
    expect(document.querySelector('.distortion-settings-overlay')).toBeNull();
    expect(document.querySelector('.fade-settings-overlay')).toBeNull();
    expect(document.querySelector('.delay-settings-overlay')).toBeNull();
    expect(document.querySelector('.reverb-settings-overlay')).not.toBeNull();
  });

  it('wires onApply/onCancel through to the correct dialog instance', () => {
    const filterDialog = { ...closedFilterDialog, isOpen: true };
    render(<EffectDialogs {...allClosedProps} filterDialog={filterDialog} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(filterDialog.apply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(filterDialog.close).toHaveBeenCalledTimes(1);
  });
});
