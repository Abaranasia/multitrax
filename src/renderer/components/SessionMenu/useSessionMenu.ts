import { useCallback, useEffect, useState } from 'react';

/** Tracks the open/closed state of the top-left session dropdown menu. */
export const useSessionMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Close on any click outside the menu, or on Escape.
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, close]);

  return { isOpen, toggle, close };
};
