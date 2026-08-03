import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { TrackContextMenu } from '@/renderer/components/TrackPlayer/components/contextMenu/TrackContextMenu';

describe('TrackContextMenu', () => {
  afterEach(() => cleanup());

  it('renders a Duplicate item positioned at the given coordinates', () => {
    render(<TrackContextMenu x={120} y={80} onDuplicate={vi.fn()} onReveal={vi.fn()} />);

    const menu = screen.getByText('Duplicate').closest('.track-context-menu') as HTMLElement;
    expect(menu.style.left).toBe('120px');
    expect(menu.style.top).toBe('80px');
  });

  it('calls onDuplicate when the Duplicate item is clicked', () => {
    const onDuplicate = vi.fn();
    render(<TrackContextMenu x={0} y={0} onDuplicate={onDuplicate} onReveal={vi.fn()} />);

    fireEvent.click(screen.getByText('Duplicate'));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onReveal when the Show in Folder item is clicked', () => {
    const onReveal = vi.fn();
    render(<TrackContextMenu x={0} y={0} onDuplicate={vi.fn()} onReveal={onReveal} />);

    fireEvent.click(screen.getByText('Show in Folder'));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('disables Show in Folder and explains why when the source file is unavailable', () => {
    const onReveal = vi.fn();
    render(
      <TrackContextMenu x={0} y={0} onDuplicate={vi.fn()} onReveal={onReveal} revealDisabled />,
    );

    const item = screen.getByText<HTMLButtonElement>('Show in Folder');
    expect(item.disabled).toBe(true);
    expect(item.title).toBe('Source file location is unavailable for this track');

    fireEvent.click(item);
    expect(onReveal).not.toHaveBeenCalled();
  });
});
