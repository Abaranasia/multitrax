import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/renderer/components/MixerView/ChannelStrip', () => ({
  ChannelStrip: ({
    track,
    isDragging,
    onDragHandleMouseDown,
  }: {
    track: { state: { id: string; title: string } };
    isDragging: boolean;
    onDragHandleMouseDown: (id: string, e: React.MouseEvent) => void;
  }) => (
    <div data-testid="channel-strip" data-dragging={isDragging}>
      <button
        data-testid={`grip-${track.state.id}`}
        onMouseDown={(e) => onDragHandleMouseDown(track.state.id, e)}
      />
      {track.state.title}
    </div>
  ),
}));

vi.mock('@/renderer/components/MixerView/MasterStrip', () => ({
  MasterStrip: () => <div data-testid="master-strip">Master</div>,
}));

import { MixerView } from '@/renderer/components/MixerView/MixerView';
import { TrackEntry } from '@/renderer/context/audioContextInstance';

describe('MixerView', () => {
  afterEach(() => cleanup());

  const track = (id: string, title: string): TrackEntry =>
    ({
      state: { id, title },
      filePath: `/tmp/${id}.wav`,
      x: 0,
      y: 0,
    }) as unknown as TrackEntry;

  const mockRects = (strips: HTMLElement[], bounds: Array<{ left: number; right: number }>) => {
    strips.forEach((strip, i) => {
      strip.getBoundingClientRect = () => ({
        left: bounds[i].left,
        right: bounds[i].right,
        top: 0,
        bottom: 0,
        width: bounds[i].right - bounds[i].left,
        height: 0,
        x: bounds[i].left,
        y: 0,
        toJSON: () => '',
      });
    });
  };

  it('renders an empty rack when there are no tracks', () => {
    render(<MixerView tracks={[]} reorderTracks={vi.fn()} />);

    expect(screen.queryAllByTestId('channel-strip')).toHaveLength(0);
  });

  it('renders one ChannelStrip per track, preserving array order', () => {
    render(
      <MixerView
        tracks={[track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')]}
        reorderTracks={vi.fn()}
      />,
    );

    const strips = screen.getAllByTestId('channel-strip');
    expect(strips.map((s) => s.textContent)).toEqual(['Vocals', 'Bass', 'Drums']);
  });

  it('calls reorderTracks with the target index once the dragged strip crosses a sibling slot', () => {
    const reorderTracks = vi.fn();
    render(
      <MixerView
        tracks={[track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')]}
        reorderTracks={reorderTracks}
      />,
    );

    const strips = screen.getAllByTestId('channel-strip');
    mockRects(strips, [
      { left: 0, right: 100 },
      { left: 100, right: 200 },
      { left: 200, right: 300 },
    ]);

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    fireEvent.mouseMove(window, { clientX: 250 });

    expect(reorderTracks).toHaveBeenCalledWith('1', 2);

    fireEvent.mouseUp(window);
  });

  it('renders the Master strip alongside the track strips', () => {
    render(
      <MixerView
        tracks={[track('1', 'Vocals'), track('2', 'Bass')]}
        reorderTracks={vi.fn()}
      />,
    );

    expect(screen.getByTestId('master-strip')).toBeTruthy();
    expect(screen.getAllByTestId('channel-strip')).toHaveLength(2);
  });

  it('keeps the Master strip outside the draggable rack, so it never participates in drag-reorder targeting', () => {
    // Regression guard: useMixerReorder computes drag targets from every DOM
    // child of the ref'd .mixer-rack container with no filtering. If
    // MasterStrip were rendered inside that container, dragging the last
    // track strip toward the master strip's slot would target index 2 (the
    // master's position) instead of clamping to the last real track index.
    const reorderTracks = vi.fn();
    render(
      <MixerView
        tracks={[track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')]}
        reorderTracks={reorderTracks}
      />,
    );

    const rack = document.querySelector('.mixer-rack') as HTMLElement;
    expect(rack.children).toHaveLength(3);
    expect(rack.querySelector('[data-testid="master-strip"]')).toBeNull();

    const strips = screen.getAllByTestId('channel-strip');
    const mockRects = (els: HTMLElement[], bounds: Array<{ left: number; right: number }>) => {
      els.forEach((el, i) => {
        el.getBoundingClientRect = () => ({
          left: bounds[i].left,
          right: bounds[i].right,
          top: 0,
          bottom: 0,
          width: bounds[i].right - bounds[i].left,
          height: 0,
          x: bounds[i].left,
          y: 0,
          toJSON: () => '',
        });
      });
    };
    mockRects(strips, [
      { left: 0, right: 100 },
      { left: 100, right: 200 },
      { left: 200, right: 300 },
    ]);

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    fireEvent.mouseMove(window, { clientX: 250 });

    // Target index clamps to the last real track slot (2), not an index that
    // would only exist if the master strip were counted as a rack child.
    expect(reorderTracks).toHaveBeenCalledWith('1', 2);

    fireEvent.mouseUp(window);
  });

  it('marks the actively dragged strip via isDragging and clears it on mouseup', () => {
    render(
      <MixerView
        tracks={[track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')]}
        reorderTracks={vi.fn()}
      />,
    );

    const strips = screen.getAllByTestId('channel-strip');
    mockRects(strips, [
      { left: 0, right: 100 },
      { left: 100, right: 200 },
      { left: 200, right: 300 },
    ]);

    fireEvent.mouseDown(screen.getByTestId('grip-2'));
    expect(screen.getAllByTestId('channel-strip')[1].dataset.dragging).toBe('true');

    fireEvent.mouseUp(window);
    expect(
      screen.getAllByTestId('channel-strip').some((s) => s.dataset.dragging === 'true'),
    ).toBe(false);
  });
});
