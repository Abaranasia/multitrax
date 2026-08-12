import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { ViewMenu } from '@/renderer/components/ViewMenu/ViewMenu';

describe('ViewMenu', () => {
  afterEach(() => cleanup());

  it('renders only the toggle button when closed', () => {
    render(
      <ViewMenu
        isOpen={false}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    expect(screen.queryByText('⊞ Organize Tracks')).toBeNull();
    expect(screen.queryByText('🎚 Switch to Mixer View')).toBeNull();
  });

  it('calls onToggle when the toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ViewMenu
        isOpen={false}
        onToggle={onToggle}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('View menu'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows Organize Tracks and Switch to Mixer View when open in canvas mode', () => {
    render(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    expect(screen.getByText('⊞ Organize Tracks')).toBeTruthy();
    expect(screen.getByText('🎚 Switch to Mixer View')).toBeTruthy();
    expect(screen.queryByText('🖼 Switch to Track View')).toBeNull();
  });

  it('hides Organize Tracks and shows Switch to Track View when open in mixer mode', () => {
    render(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="mixer"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    expect(screen.queryByText('⊞ Organize Tracks')).toBeNull();
    expect(screen.getByText('🖼 Switch to Track View')).toBeTruthy();
    expect(screen.queryByText('🎚 Switch to Mixer View')).toBeNull();
  });

  it('calls onOrganizeTracks then onClose when Organize Tracks is clicked', () => {
    const onOrganizeTracks = vi.fn();
    const onClose = vi.fn();
    render(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        viewMode="canvas"
        onOrganizeTracks={onOrganizeTracks}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('⊞ Organize Tracks'));

    expect(onOrganizeTracks).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSwitchView then onClose when the switch item is clicked', () => {
    const onSwitchView = vi.fn();
    const onClose = vi.fn();
    render(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={onSwitchView}
      />,
    );

    fireEvent.click(screen.getByText('🎚 Switch to Mixer View'));

    expect(onSwitchView).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Organize Tracks when organizeDisabled is true', () => {
    render(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled
        onSwitchView={vi.fn()}
      />,
    );

    expect(screen.getByText<HTMLButtonElement>('⊞ Organize Tracks').disabled).toBe(true);
  });

  it('exposes aria-haspopup always, and aria-expanded reflecting isOpen', () => {
    const { rerender } = render(
      <ViewMenu
        isOpen={false}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    const toggle = screen.getByTitle('View menu');
    expect(toggle.getAttribute('aria-haspopup')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    rerender(
      <ViewMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        viewMode="canvas"
        onOrganizeTracks={vi.fn()}
        organizeDisabled={false}
        onSwitchView={vi.fn()}
      />,
    );

    expect(screen.getByTitle('View menu').getAttribute('aria-expanded')).toBe('true');
  });
});
