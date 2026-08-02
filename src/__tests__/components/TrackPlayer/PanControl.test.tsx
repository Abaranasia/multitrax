import React from 'react';
import type { CSSProperties } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { PanControl } from '@/renderer/components/TrackPlayer/components/panControl/PanControl';

describe('PanControl', () => {
  afterEach(() => cleanup());

  const baseProps = {
    pan: 0,
    className: 'pan-input',
    style: { '--pan-fill': '50%' } as CSSProperties,
    title: 'Pan: Center',
    onChange: vi.fn(),
    onDoubleClick: vi.fn(),
  };

  const getInput = () =>
    document.querySelector('.pan-control input[type=range]') as HTMLInputElement;

  it('applies no directional modifier class when centered', () => {
    render(<PanControl {...baseProps} />);
    expect(getInput().className).toBe('pan-input');
  });

  it('applies the left modifier class and title when pan is negative', () => {
    render(
      <PanControl
        {...baseProps}
        pan={-0.6}
        className="pan-input pan-input--left"
        title="Pan: 60% Left"
      />,
    );
    expect(getInput().className).toBe('pan-input pan-input--left');
    expect(getInput().title).toBe('Pan: 60% Left');
  });

  it('applies the right modifier class and title when pan is positive', () => {
    render(
      <PanControl
        {...baseProps}
        pan={0.6}
        className="pan-input pan-input--right"
        title="Pan: 60% Right"
      />,
    );
    expect(getInput().className).toBe('pan-input pan-input--right');
    expect(getInput().title).toBe('Pan: 60% Right');
  });

  it('renders the --pan-fill style value', () => {
    render(<PanControl {...baseProps} style={{ '--pan-fill': '20%' } as CSSProperties} />);
    expect(getInput().style.getPropertyValue('--pan-fill')).toBe('20%');
  });

  it('fires onChange when the input value changes', () => {
    let receivedValue: string | undefined;
    const onChange = vi.fn((e: { target: { value: string } }) => {
      receivedValue = e.target.value;
    });
    render(<PanControl {...baseProps} onChange={onChange} />);

    fireEvent.change(getInput(), { target: { value: '-0.6' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(receivedValue).toBe('-0.6');
  });

  it('fires onDoubleClick when the input is double-clicked', () => {
    const onDoubleClick = vi.fn();
    render(<PanControl {...baseProps} onDoubleClick={onDoubleClick} />);

    fireEvent.doubleClick(getInput());

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});
