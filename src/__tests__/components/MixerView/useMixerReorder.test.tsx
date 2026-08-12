import React, { useRef } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { useMixerReorder } from '@/renderer/components/MixerView/useMixerReorder';
import { TrackEntry } from '@/renderer/context/audioContextInstance';

const track = (id: string, title: string): TrackEntry =>
  ({
    state: { id, title },
    filePath: `/tmp/${id}.wav`,
    x: 0,
    y: 0,
  }) as unknown as TrackEntry;

interface HarnessProps {
  tracks: TrackEntry[];
  reorderTracks: (id: string, toIndex: number) => void;
}

const Harness = ({ tracks, reorderTracks }: HarnessProps) => {
  const rackRef = useRef<HTMLDivElement>(null);
  const { draggingId, onHandleMouseDown, onGripKeyDown } = useMixerReorder(
    tracks,
    reorderTracks,
    rackRef,
  );

  return (
    <>
      <div ref={rackRef} data-testid="rack">
        {tracks.map((t) => (
          <div key={t.state.id} data-testid={`strip-${t.state.id}`}>
            <button
              data-testid={`grip-${t.state.id}`}
              onMouseDown={(e) => onHandleMouseDown(t.state.id, e)}
              onKeyDown={(e) => onGripKeyDown(t.state.id, e)}
            />
          </div>
        ))}
      </div>
      <div data-testid="dragging-id">{draggingId ?? ''}</div>
    </>
  );
};

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

describe('useMixerReorder', () => {
  afterEach(() => {
    cleanup();
    document.body.style.userSelect = '';
  });

  const threeTracks = [track('1', 'Vocals'), track('2', 'Bass'), track('3', 'Drums')];
  const bounds = [
    { left: 0, right: 100 },
    { left: 100, right: 200 },
    { left: 200, right: 300 },
  ];

  it('sets draggingId on mousedown and clears it on mouseup', () => {
    render(<Harness tracks={threeTracks} reorderTracks={vi.fn()} />);

    fireEvent.mouseDown(screen.getByTestId('grip-2'));
    expect(screen.getByTestId('dragging-id').textContent).toBe('2');

    fireEvent.mouseUp(window);
    expect(screen.getByTestId('dragging-id').textContent).toBe('');
  });

  it('calls reorderTracks with the index of the slot under the pointer', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);
    mockRects(
      [screen.getByTestId('strip-1'), screen.getByTestId('strip-2'), screen.getByTestId('strip-3')],
      bounds,
    );

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    fireEvent.mouseMove(window, { clientX: 150 });

    expect(reorderTracks).toHaveBeenCalledWith('1', 1);
    fireEvent.mouseUp(window);
  });

  it('clamps to index 0 when the pointer moves left of the first strip', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);
    mockRects(
      [screen.getByTestId('strip-1'), screen.getByTestId('strip-2'), screen.getByTestId('strip-3')],
      bounds,
    );

    fireEvent.mouseDown(screen.getByTestId('grip-3'));
    fireEvent.mouseMove(window, { clientX: -50 });

    expect(reorderTracks).toHaveBeenCalledWith('3', 0);
    fireEvent.mouseUp(window);
  });

  it('clamps to the last index when the pointer moves right of the last strip', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);
    mockRects(
      [screen.getByTestId('strip-1'), screen.getByTestId('strip-2'), screen.getByTestId('strip-3')],
      bounds,
    );

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    fireEvent.mouseMove(window, { clientX: 999 });

    expect(reorderTracks).toHaveBeenCalledWith('1', 2);
    fireEvent.mouseUp(window);
  });

  it('does not call reorderTracks when the pointer stays within the dragged strip own slot', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);
    mockRects(
      [screen.getByTestId('strip-1'), screen.getByTestId('strip-2'), screen.getByTestId('strip-3')],
      bounds,
    );

    fireEvent.mouseDown(screen.getByTestId('grip-2'));
    fireEvent.mouseMove(window, { clientX: 150 });

    expect(reorderTracks).not.toHaveBeenCalled();
    fireEvent.mouseUp(window);
  });

  it('sets body userSelect to none while dragging and restores the previous value afterwards', () => {
    document.body.style.userSelect = 'text';
    render(<Harness tracks={threeTracks} reorderTracks={vi.fn()} />);

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    expect(document.body.style.userSelect).toBe('none');

    fireEvent.mouseUp(window);
    expect(document.body.style.userSelect).toBe('text');
  });

  it('stops reacting to mousemove/mouseup after a drag has already ended', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);
    mockRects(
      [screen.getByTestId('strip-1'), screen.getByTestId('strip-2'), screen.getByTestId('strip-3')],
      bounds,
    );

    fireEvent.mouseDown(screen.getByTestId('grip-1'));
    fireEvent.mouseUp(window);

    reorderTracks.mockClear();
    fireEvent.mouseMove(window, { clientX: 250 });

    expect(reorderTracks).not.toHaveBeenCalled();
  });

  it('moves the focused strip one slot left/right on ArrowLeft/ArrowRight', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);

    fireEvent.keyDown(screen.getByTestId('grip-2'), { key: 'ArrowLeft' });
    expect(reorderTracks).toHaveBeenCalledWith('2', 0);

    reorderTracks.mockClear();
    fireEvent.keyDown(screen.getByTestId('grip-2'), { key: 'ArrowRight' });
    expect(reorderTracks).toHaveBeenCalledWith('2', 2);
  });

  it('does not reorder past either end of the rack', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);

    fireEvent.keyDown(screen.getByTestId('grip-1'), { key: 'ArrowLeft' });
    expect(reorderTracks).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByTestId('grip-3'), { key: 'ArrowRight' });
    expect(reorderTracks).not.toHaveBeenCalled();
  });

  it('ignores keys other than ArrowLeft/ArrowRight', () => {
    const reorderTracks = vi.fn();
    render(<Harness tracks={threeTracks} reorderTracks={reorderTracks} />);

    fireEvent.keyDown(screen.getByTestId('grip-2'), { key: 'Enter' });
    expect(reorderTracks).not.toHaveBeenCalled();
  });
});
