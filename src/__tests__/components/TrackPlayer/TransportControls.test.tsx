import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { TransportControls } from '@/renderer/components/TrackPlayer/components/transportControls/TransportControls';

describe('TransportControls', () => {
  afterEach(() => cleanup());

  const baseProps = {
    playPauseIcon: '▶',
    playPauseTitle: 'Play',
    isPlaying: false,
    onPlayPauseClick: vi.fn(),
    onStopClick: vi.fn(),
    loopOn: false,
    loopTitle: 'Enable loop',
    onLoopClick: vi.fn(),
    fadeInOn: false,
    fadeInTitle: 'Enable 5s fade in on play',
    onFadeInClick: vi.fn(),
    fadeOutOn: false,
    fadeOutTitle: 'Enable 5s fade out on stop/pause',
    onFadeOutClick: vi.fn(),
    seekFadeOn: false,
    seekFadeTitle: 'Enable 2s fade out/in on seek',
    onSeekFadeClick: vi.fn(),
    onOpenFadeSettings: vi.fn(),
  };

  it('shows Play icon and title when not playing, and toggles to Pause when playing', () => {
    const { rerender } = render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Play').textContent).toBe('▶');

    rerender(
      <TransportControls
        {...baseProps}
        isPlaying={true}
        playPauseIcon="⏸"
        playPauseTitle="Pause"
      />,
    );
    expect(screen.getByTitle('Pause').textContent).toBe('⏸');
  });

  it('renders the stop button with its title', () => {
    render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Stop')).toBeTruthy();
  });

  it('shows the loop-on class and title only when loopOn is true', () => {
    const { rerender } = render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Enable loop').className).not.toContain('loop-on');

    rerender(<TransportControls {...baseProps} loopOn={true} loopTitle="Disable loop" />);
    expect(screen.getByTitle('Disable loop').className).toContain('loop-on');
  });

  it('shows the fade-in loop-on class and title only when fadeInOn is true', () => {
    const { rerender } = render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Enable 5s fade in on play').className).not.toContain('loop-on');

    rerender(
      <TransportControls {...baseProps} fadeInOn={true} fadeInTitle="Disable fade in" />,
    );
    expect(screen.getByTitle('Disable fade in').className).toContain('loop-on');
  });

  it('shows the fade-out loop-on class and title only when fadeOutOn is true', () => {
    const { rerender } = render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Enable 5s fade out on stop/pause').className).not.toContain(
      'loop-on',
    );

    rerender(
      <TransportControls {...baseProps} fadeOutOn={true} fadeOutTitle="Disable fade out" />,
    );
    expect(screen.getByTitle('Disable fade out').className).toContain('loop-on');
  });

  it('shows the seek-fade loop-on class and title only when seekFadeOn is true', () => {
    const { rerender } = render(<TransportControls {...baseProps} />);
    expect(screen.getByTitle('Enable 2s fade out/in on seek').className).not.toContain(
      'loop-on',
    );

    rerender(
      <TransportControls {...baseProps} seekFadeOn={true} seekFadeTitle="Disable seek fade" />,
    );
    expect(screen.getByTitle('Disable seek fade').className).toContain('loop-on');
  });

  it('calls each handler when its button is clicked', () => {
    const onPlayPauseClick = vi.fn();
    const onStopClick = vi.fn();
    const onLoopClick = vi.fn();
    const onFadeInClick = vi.fn();
    const onFadeOutClick = vi.fn();
    const onSeekFadeClick = vi.fn();
    const onOpenFadeSettings = vi.fn();

    render(
      <TransportControls
        {...baseProps}
        onPlayPauseClick={onPlayPauseClick}
        onStopClick={onStopClick}
        onLoopClick={onLoopClick}
        onFadeInClick={onFadeInClick}
        onFadeOutClick={onFadeOutClick}
        onSeekFadeClick={onSeekFadeClick}
        onOpenFadeSettings={onOpenFadeSettings}
      />,
    );

    fireEvent.click(screen.getByTitle('Play'));
    expect(onPlayPauseClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Stop'));
    expect(onStopClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Enable loop'));
    expect(onLoopClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Enable 5s fade in on play'));
    expect(onFadeInClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Enable 5s fade out on stop/pause'));
    expect(onFadeOutClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Enable 2s fade out/in on seek'));
    expect(onSeekFadeClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Configure fade durations'));
    expect(onOpenFadeSettings).toHaveBeenCalledTimes(1);
  });
});
