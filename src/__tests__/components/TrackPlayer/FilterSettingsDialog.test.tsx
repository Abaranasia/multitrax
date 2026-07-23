import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FilterSettingsDialog } from '@/renderer/components/TrackPlayer/FilterSettingsDialog';

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
});
