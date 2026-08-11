import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { PanDial } from '@/renderer/components/MixerView/PanDial';

describe('PanDial', () => {
  afterEach(() => cleanup());

  const baseProps = {
    pan: 0,
    title: 'Pan: Center',
    onChange: vi.fn(),
    onDoubleClick: vi.fn(),
  };

  const getInput = () =>
    document.querySelector('.mixer-pan-dial-input') as HTMLInputElement;
  const getDial = () => document.querySelector('.mixer-pan-dial') as HTMLElement;

  it('shows "Center" and no rotation when pan is 0', () => {
    render(<PanDial {...baseProps} />);
    expect(document.querySelector('.mixer-pan-label')?.textContent).toBe('Center');
    expect(getDial().style.transform).toBe('rotate(0deg)');
  });

  it('shows an L label and rotates left when pan is negative', () => {
    render(<PanDial {...baseProps} pan={-0.6} title="Pan: 60% Left" />);
    expect(document.querySelector('.mixer-pan-label')?.textContent).toBe('L60');
    expect(getDial().style.transform).toBe('rotate(-54deg)');
    expect(getInput().title).toBe('Pan: 60% Left');
  });

  it('shows an R label and rotates right when pan is positive', () => {
    render(<PanDial {...baseProps} pan={0.6} title="Pan: 60% Right" />);
    expect(document.querySelector('.mixer-pan-label')?.textContent).toBe('R60');
    expect(getDial().style.transform).toBe('rotate(54deg)');
  });

  it('fires onChange when the underlying input value changes', () => {
    let receivedValue: string | undefined;
    const onChange = vi.fn((e: { target: { value: string } }) => {
      receivedValue = e.target.value;
    });
    render(<PanDial {...baseProps} onChange={onChange} />);

    fireEvent.change(getInput(), { target: { value: '-0.6' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(receivedValue).toBe('-0.6');
  });

  it('fires onDoubleClick when the input is double-clicked', () => {
    const onDoubleClick = vi.fn();
    render(<PanDial {...baseProps} onDoubleClick={onDoubleClick} />);

    fireEvent.doubleClick(getInput());

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});
