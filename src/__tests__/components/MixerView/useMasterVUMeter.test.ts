import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { CSSProperties } from 'react';

import { useMasterVUMeter } from '@/renderer/components/MixerView/useMasterVUMeter';
import { AudioEngine } from '@/renderer/audio/AudioEngine';

const meterLevel = (style: CSSProperties) => (style as unknown as Record<string, string>)['--meter-level'];

describe('useMasterVUMeter', () => {
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

  const makeEngine = (left: number, right: number) =>
    ({
      getMasterLevel: vi.fn((channel: 'left' | 'right') => (channel === 'left' ? left : right)),
    }) as unknown as AudioEngine;

  it('starts polling immediately on mount, without any playing gate', () => {
    const engine = makeEngine(0, 0);
    renderHook(() => useMasterVUMeter(engine));

    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('returns leftStyle/rightStyle reflecting engine.getMasterLevel for each channel independently', () => {
    const engine = makeEngine(1, 1);
    const { result } = renderHook(() => useMasterVUMeter(engine));

    act(() => {
      rafCallback?.(0);
    });

    expect(meterLevel(result.current.leftStyle)).toBe('100%');
    expect(meterLevel(result.current.rightStyle)).toBe('100%');
  });

  it('applies peak-hold decay independently per channel when the level drops', () => {
    let left = 1;
    const right = 0;
    const engine = {
      getMasterLevel: vi.fn((channel: 'left' | 'right') => (channel === 'left' ? left : right)),
    } as unknown as AudioEngine;

    const { result } = renderHook(() => useMasterVUMeter(engine));

    act(() => {
      rafCallback?.(0);
    });
    const leftAfterFirstFrame = meterLevel(result.current.leftStyle);

    left = 0;
    act(() => {
      rafCallback?.(1);
    });

    // Decayed, not instantly silent — same peak-hold ballistics as useVUMeter.
    expect(meterLevel(result.current.leftStyle)).not.toBe(leftAfterFirstFrame);
    expect(meterLevel(result.current.leftStyle)).not.toBe('0%');
  });

  it('cancels the animation frame on unmount', () => {
    const engine = makeEngine(0, 0);
    const { unmount } = renderHook(() => useMasterVUMeter(engine));

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
