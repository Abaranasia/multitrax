import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup, fireEvent } from '@testing-library/react';

import { useViewMenu } from '@/renderer/components/ViewMenu/useViewMenu';

describe('useViewMenu', () => {
  afterEach(() => cleanup());

  it('starts closed', () => {
    const { result } = renderHook(() => useViewMenu());
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle flips the open state', () => {
    const { result } = renderHook(() => useViewMenu());

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('close sets isOpen to false', () => {
    const { result } = renderHook(() => useViewMenu());

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('closes on an outside mousedown while open', () => {
    const { result } = renderHook(() => useViewMenu());

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('closes on Escape while open', () => {
    const { result } = renderHook(() => useViewMenu());

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('does not attach listeners while closed', () => {
    const { result } = renderHook(() => useViewMenu());

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(result.current.isOpen).toBe(false);
  });
});
