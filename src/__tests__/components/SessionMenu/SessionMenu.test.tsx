import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SessionMenu } from '@/renderer/components/SessionMenu/SessionMenu';

describe('SessionMenu', () => {
  afterEach(() => cleanup());

  it('renders only the toggle button when closed', () => {
    render(
      <SessionMenu
        isOpen={false}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    expect(screen.queryByText('Load Session')).toBeNull();
    expect(screen.queryByText('Save Session')).toBeNull();
    expect(screen.queryByText('Save New Session')).toBeNull();
  });

  it('calls onToggle when the toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <SessionMenu
        isOpen={false}
        onToggle={onToggle}
        onClose={vi.fn()}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    fireEvent.click(screen.getByTitle('Session menu'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders Load Session, Save Session, and Save New Session items when open', () => {
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    expect(screen.getByText('Load Session')).toBeTruthy();
    expect(screen.getByText('Save Session')).toBeTruthy();
    expect(screen.getByText('Save New Session')).toBeTruthy();
  });

  it('calls onLoadSession and then onClose when Load Session is clicked', () => {
    const onLoadSession = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        onLoadSession={onLoadSession}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    fireEvent.click(screen.getByText('Load Session'));

    expect(onLoadSession).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSaveSession and then onClose when Save Session is clicked', () => {
    const onSaveSession = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        onLoadSession={vi.fn()}
        onSaveSession={onSaveSession}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    fireEvent.click(screen.getByText('Save Session'));

    expect(onSaveSession).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSaveNewSession and then onClose when Save New Session is clicked', () => {
    const onSaveNewSession = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={onSaveNewSession}
        saveDisabled={false}
        loadDisabled={false}
      />,
    );

    fireEvent.click(screen.getByText('Save New Session'));

    expect(onSaveNewSession).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Save Session and Save New Session when saveDisabled is true', () => {
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled
        loadDisabled={false}
      />,
    );

    expect(screen.getByText<HTMLButtonElement>('Save Session').disabled).toBe(true);
    expect(screen.getByText<HTMLButtonElement>('Save New Session').disabled).toBe(true);
    expect(screen.getByText<HTMLButtonElement>('Load Session').disabled).toBe(false);
  });

  it('disables Load Session when loadDisabled is true', () => {
    render(
      <SessionMenu
        isOpen
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onLoadSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSaveNewSession={vi.fn()}
        saveDisabled={false}
        loadDisabled
      />,
    );

    expect(screen.getByText<HTMLButtonElement>('Load Session').disabled).toBe(true);
    expect(screen.getByText<HTMLButtonElement>('Save Session').disabled).toBe(false);
  });
});
