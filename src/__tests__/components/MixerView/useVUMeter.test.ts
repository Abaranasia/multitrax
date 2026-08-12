import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { CSSProperties } from 'react';

import { useVUMeter } from '@/renderer/components/MixerView/useVUMeter';
import { AudioEngine } from '@/renderer/audio/AudioEngine';

const meterLevel = (style: CSSProperties) =>
  (style as unknown as Record<string, string>)['--meter-level'];

describe('useVUMeter', () => {
  let rafCallback: FrameRequestCallback | null;

  beforeEach(() => {
    rafCallback = null;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const makeEngine = (level: number) =>
    ({
      getLevel: vi.fn(() => level),
    }) as unknown as AudioEngine;

  it('does not start polling while not playing', () => {
    const engine = makeEngine(1);
    renderHook(() => useVUMeter(engine, 'track-1', false));

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('reports 0% while not playing, regardless of the engine level', () => {
    const engine = makeEngine(1);
    const { result } = renderHook(() => useVUMeter(engine, 'track-1', false));

    expect(meterLevel(result.current.style)).toBe('0%');
  });

  it('starts polling on mount when playing, and returns style reflecting engine.getLevel(id)', () => {
    const getLevel = vi.fn(() => 1);
    const engine = { getLevel } as unknown as AudioEngine;
    const { result } = renderHook(() => useVUMeter(engine, 'track-1', true));

    expect(requestAnimationFrame).toHaveBeenCalled();

    act(() => {
      rafCallback?.(0);
    });

    expect(getLevel).toHaveBeenCalledWith('track-1');
    expect(meterLevel(result.current.style)).toBe('100%');
  });

  it('applies peak-hold decay when the level drops instead of snapping straight to the new (lower) reading', () => {
    let level = 1;
    const engine = { getLevel: vi.fn(() => level) } as unknown as AudioEngine;
    const { result } = renderHook(() => useVUMeter(engine, 'track-1', true));

    act(() => {
      rafCallback?.(0);
    });
    const afterFirstFrame = meterLevel(result.current.style);

    level = 0;
    act(() => {
      rafCallback?.(1);
    });

    expect(meterLevel(result.current.style)).not.toBe(afterFirstFrame);
    expect(meterLevel(result.current.style)).not.toBe('0%');
  });

  it('drops to 0% immediately when playing turns false, even with a held peak level', () => {
    const engine = makeEngine(1);
    const { result, rerender } = renderHook(
      ({ playing }) => useVUMeter(engine, 'track-1', playing),
      { initialProps: { playing: true } },
    );

    act(() => {
      rafCallback?.(0);
    });
    expect(meterLevel(result.current.style)).toBe('100%');

    rerender({ playing: false });

    expect(meterLevel(result.current.style)).toBe('0%');
  });

  it('cancels the animation frame and resets the held peak when playing turns false', () => {
    const engine = makeEngine(1);
    const { rerender } = renderHook(({ playing }) => useVUMeter(engine, 'track-1', playing), {
      initialProps: { playing: true },
    });

    act(() => {
      rafCallback?.(0);
    });

    rerender({ playing: false });

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('cancels the animation frame on unmount', () => {
    const engine = makeEngine(0);
    const { unmount } = renderHook(() => useVUMeter(engine, 'track-1', true));

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
