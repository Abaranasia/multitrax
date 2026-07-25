import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { DistortionSettingsDialog } from '@/renderer/components/TrackPlayer/DistortionSettingsDialog';

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
});
