import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { ChangeEvent } from 'react';

import { useMasterVolumeControl } from '@/renderer/components/MixerView/useMasterVolumeControl';

describe('useMasterVolumeControl', () => {
  afterEach(() => cleanup());

  it('exposes volume, percentage, style and title derived from masterVolume', () => {
    const { result } = renderHook(() => useMasterVolumeControl(0.5, vi.fn()));

    expect(result.current.volume).toBe(0.5);
    expect(result.current.percentage).toBe(50);
    expect(result.current.style).toEqual({ '--volume-fill': '50%' });
    expect(result.current.title).toBe('Volume: 50%');
  });

  it('calls setMasterVolume with the parsed slider value on change', () => {
    const setMasterVolume = vi.fn();
    const { result } = renderHook(() => useMasterVolumeControl(1, setMasterVolume));

    act(() => {
      result.current.onChange({ target: { value: '0.3' } } as ChangeEvent<HTMLInputElement>);
    });

    expect(setMasterVolume).toHaveBeenCalledWith(0.3);
  });

  it('is never muted and its mute toggle is inert (mute UI is hidden by CSS, not wired)', () => {
    const setMasterVolume = vi.fn();
    const { result } = renderHook(() => useMasterVolumeControl(0, setMasterVolume));

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.onToggleMute();
    });

    expect(setMasterVolume).not.toHaveBeenCalled();
  });
});
