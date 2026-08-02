import React from 'react';
import type { CSSProperties } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { VolumeControl } from '@/renderer/components/TrackPlayer/components/volumeControl/VolumeControl';

describe('VolumeControl', () => {
  afterEach(() => cleanup());

  const baseProps = {
    volume: 0.75,
    percentage: 75,
    style: { '--volume-fill': '75%' } as CSSProperties,
    title: 'Volume: 75%',
    onChange: vi.fn(),
  };

  it('renders the input with the right value, title and style custom property', () => {
    render(<VolumeControl {...baseProps} />);

    const input = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('0.75');
    expect(input.title).toBe('Volume: 75%');
    expect(input.style.getPropertyValue('--volume-fill')).toBe('75%');
  });

  it('calls onChange when the input value changes', () => {
    let receivedValue: string | undefined;
    const onChange = vi.fn((e: { target: { value: string } }) => {
      receivedValue = e.target.value;
    });
    render(<VolumeControl {...baseProps} onChange={onChange} />);

    const input = document.querySelector(
      '.volume-control input[type=range]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.5' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(receivedValue).toBe('0.5');
  });
});
