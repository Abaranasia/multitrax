import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { ChangeEvent } from 'react';

import { useMasterBalanceControl } from '@/renderer/components/MixerView/useMasterBalanceControl';

describe('useMasterBalanceControl', () => {
  afterEach(() => cleanup());

  it('exposes balance, className, style and a "Center" title at 0', () => {
    const { result } = renderHook(() => useMasterBalanceControl(0, vi.fn()));

    expect(result.current.pan).toBe(0);
    expect(result.current.className).toBe('pan-input');
    expect(result.current.style).toEqual({ '--pan-fill': '50%' });
    expect(result.current.title).toBe('Balance: Center');
  });

  it('reflects a left balance', () => {
    const { result } = renderHook(() => useMasterBalanceControl(-0.6, vi.fn()));

    expect(result.current.className).toBe('pan-input pan-input--left');
    expect(result.current.title).toBe('Balance: 60% Left');
  });

  it('reflects a right balance', () => {
    const { result } = renderHook(() => useMasterBalanceControl(0.6, vi.fn()));

    expect(result.current.className).toBe('pan-input pan-input--right');
    expect(result.current.title).toBe('Balance: 60% Right');
  });

  it('calls setMasterBalance with the parsed slider value on change', () => {
    const setMasterBalance = vi.fn();
    const { result } = renderHook(() => useMasterBalanceControl(0, setMasterBalance));

    act(() => {
      result.current.onChange({ target: { value: '-0.4' } } as ChangeEvent<HTMLInputElement>);
    });

    expect(setMasterBalance).toHaveBeenCalledWith(-0.4);
  });

  it('resets to 0 on double-click', () => {
    const setMasterBalance = vi.fn();
    const { result } = renderHook(() => useMasterBalanceControl(0.5, setMasterBalance));

    act(() => {
      result.current.onDoubleClick();
    });

    expect(setMasterBalance).toHaveBeenCalledWith(0);
  });
});
