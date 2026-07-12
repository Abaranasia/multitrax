import { useCallback, useEffect, useState } from 'react';

interface ContextMenuPosition {
  x: number;
  y: number;
}

/** Tracks the open/closed state and screen position of a track's right-click context menu. */
export const useTrackContextMenu = () => {
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);

  const open = useCallback((x: number, y: number) => setPosition({ x, y }), []);
  const close = useCallback(() => setPosition(null), []);

  // Close on any click outside the menu, or on Escape.
  useEffect(() => {
    if (!position) return;

    const onDocumentMouseDown = () => close();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [position, close]);

  return { position, open, close };
};
