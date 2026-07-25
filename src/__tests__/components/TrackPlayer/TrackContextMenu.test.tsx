import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { TrackContextMenu } from '@/renderer/components/TrackPlayer/components/contextMenu/TrackContextMenu';

describe('TrackContextMenu', () => {
  afterEach(() => cleanup());

  it('renders a Duplicate item positioned at the given coordinates', () => {
    render(<TrackContextMenu x={120} y={80} onDuplicate={vi.fn()} />);

    const menu = screen.getByText('Duplicate').closest('.track-context-menu') as HTMLElement;
    expect(menu.style.left).toBe('120px');
    expect(menu.style.top).toBe('80px');
  });

  it('calls onDuplicate when the Duplicate item is clicked', () => {
    const onDuplicate = vi.fn();
    render(<TrackContextMenu x={0} y={0} onDuplicate={onDuplicate} />);

    fireEvent.click(screen.getByText('Duplicate'));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });
});
