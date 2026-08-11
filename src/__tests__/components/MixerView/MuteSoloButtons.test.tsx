import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { MuteSoloButtons } from '@/renderer/components/MixerView/MuteSoloButtons';

describe('MuteSoloButtons', () => {
  afterEach(() => cleanup());

  const baseProps = {
    muted: false,
    soloed: false,
    onToggleMute: vi.fn(),
    onToggleSolo: vi.fn(),
  };

  it('renders M and S buttons, inactive with unmute/solo titles by default', () => {
    render(<MuteSoloButtons {...baseProps} />);

    const muteBtn = screen.getByTitle('Mute');
    const soloBtn = screen.getByTitle('Solo');

    expect(muteBtn.textContent).toBe('M');
    expect(soloBtn.textContent).toBe('S');
    expect(muteBtn.className).not.toContain('active');
    expect(soloBtn.className).not.toContain('active');
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');
    expect(soloBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onToggleMute when the mute button is clicked', () => {
    const onToggleMute = vi.fn();
    render(<MuteSoloButtons {...baseProps} onToggleMute={onToggleMute} />);

    fireEvent.click(screen.getByTitle('Mute'));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSolo when the solo button is clicked', () => {
    const onToggleSolo = vi.fn();
    render(<MuteSoloButtons {...baseProps} onToggleSolo={onToggleSolo} />);

    fireEvent.click(screen.getByTitle('Solo'));

    expect(onToggleSolo).toHaveBeenCalledTimes(1);
  });

  it('reflects muted=true with the active class, aria-pressed, and an Unmute title', () => {
    render(<MuteSoloButtons {...baseProps} muted={true} />);

    const muteBtn = screen.getByTitle('Unmute');
    expect(muteBtn.className).toContain('active');
    expect(muteBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('reflects soloed=true with the active class, aria-pressed, and an Unsolo title', () => {
    render(<MuteSoloButtons {...baseProps} soloed={true} />);

    const soloBtn = screen.getByTitle('Unsolo');
    expect(soloBtn.className).toContain('active');
    expect(soloBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
