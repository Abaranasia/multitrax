import React, { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { WaveformCanvas } from '@/renderer/components/TrackPlayer/components/waveform/WaveformCanvas';

describe('WaveformCanvas', () => {
  afterEach(() => cleanup());

  const baseProps = {
    canvasRef: createRef<HTMLCanvasElement>(),
    progress: 40,
    title: 'Sample Track',
    onProgressClick: vi.fn(),
  };

  it('renders an aria-label containing the passed title', () => {
    render(<WaveformCanvas {...baseProps} />);

    const canvas = document.querySelector('.waveform-canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.getAttribute('aria-label')).toContain(baseProps.title);
  });

  it('reflects the passed progress in the progress bar width', () => {
    render(<WaveformCanvas {...baseProps} progress={40} />);

    const progressBar = document.querySelector('.waveform-progress') as HTMLDivElement;
    expect(progressBar).toBeTruthy();
    expect(progressBar.style.width).toBe('40%');
  });

  it('calls onProgressClick when the shell is clicked', () => {
    const onProgressClick = vi.fn();
    const { container } = render(
      <WaveformCanvas {...baseProps} onProgressClick={onProgressClick} />,
    );

    const shell = container.querySelector('.waveform-shell') as HTMLDivElement;
    shell.click();

    expect(onProgressClick).toHaveBeenCalledTimes(1);
  });
});
