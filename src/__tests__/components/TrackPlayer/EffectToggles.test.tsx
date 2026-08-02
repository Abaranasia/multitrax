import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { EffectToggles } from '@/renderer/components/TrackPlayer/components/effectToggles/EffectToggles';

describe('EffectToggles', () => {
  afterEach(() => cleanup());

  const baseProps = {
    filterActive: false,
    distortionActive: false,
    delayActive: false,
    reverbActive: false,
    onFilterOpen: vi.fn(),
    onDistortionOpen: vi.fn(),
    onDelayOpen: vi.fn(),
    onReverbOpen: vi.fn(),
  };

  it('renders the four buttons with the correct titles', () => {
    render(<EffectToggles {...baseProps} />);

    expect(screen.getByTitle('Filter settings')).toBeTruthy();
    expect(screen.getByTitle('Waveshape settings')).toBeTruthy();
    expect(screen.getByTitle('Delay settings')).toBeTruthy();
    expect(screen.getByTitle('Reverb settings')).toBeTruthy();
  });

  it('applies the --active class only when the corresponding prop is true', () => {
    render(
      <EffectToggles
        {...baseProps}
        filterActive={true}
        distortionActive={false}
        delayActive={true}
        reverbActive={false}
      />,
    );

    expect(screen.getByTitle('Filter settings').className).toContain('btn-filter--active');
    expect(screen.getByTitle('Waveshape settings').className).not.toContain(
      'btn-distortion--active',
    );
    expect(screen.getByTitle('Delay settings').className).toContain('btn-delay--active');
    expect(screen.getByTitle('Reverb settings').className).not.toContain('btn-reverb--active');
  });

  it('calls the corresponding handler when each button is clicked', () => {
    const onFilterOpen = vi.fn();
    const onDistortionOpen = vi.fn();
    const onDelayOpen = vi.fn();
    const onReverbOpen = vi.fn();
    render(
      <EffectToggles
        {...baseProps}
        onFilterOpen={onFilterOpen}
        onDistortionOpen={onDistortionOpen}
        onDelayOpen={onDelayOpen}
        onReverbOpen={onReverbOpen}
      />,
    );

    fireEvent.click(screen.getByTitle('Filter settings'));
    expect(onFilterOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Waveshape settings'));
    expect(onDistortionOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Delay settings'));
    expect(onDelayOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Reverb settings'));
    expect(onReverbOpen).toHaveBeenCalledTimes(1);
  });
});
