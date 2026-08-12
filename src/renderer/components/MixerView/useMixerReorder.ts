import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { TrackEntry } from '../../context/audioContextInstance';

export const useMixerReorder = (
  tracks: TrackEntry[],
  reorderTracks: (id: string, toIndex: number) => void,
  rackRef: RefObject<HTMLDivElement | null>,
) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // The mousemove/mouseup listeners below are attached once per drag and
  // live for its whole duration, so they'd otherwise close over the
  // `tracks`/`draggingId` values from the moment the drag started. But
  // `reorderTracks` gives `tracks` a new array reference on every live swap,
  // so the handler must always read the latest order/id through a ref
  // instead of the stale closure, or it would keep computing target indices
  // against an outdated array. The ref is synced in an effect (not directly
  // during render) so it never reads/writes ref.current while rendering.
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  const draggingIdRef = useRef<string | null>(null);

  const onHandleMouseDown = useCallback(
    (id: string, e: ReactMouseEvent) => {
      e.preventDefault();

      setDraggingId(id);
      draggingIdRef.current = id;

      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const onMove = (ev: globalThis.MouseEvent) => {
        const rack = rackRef.current;
        const currentDraggingId = draggingIdRef.current;
        if (!rack || !currentDraggingId) return;

        const children = Array.from(rack.children) as HTMLElement[];
        if (children.length === 0) return;

        const rects = children.map((child) => child.getBoundingClientRect());

        let targetIndex = rects.findIndex(
          (rect) => ev.clientX >= rect.left && ev.clientX <= rect.right,
        );
        if (targetIndex === -1) {
          targetIndex = ev.clientX < rects[0].left ? 0 : rects.length - 1;
        }

        const fromIndex = tracksRef.current.findIndex((t) => t.state.id === currentDraggingId);
        if (fromIndex !== -1 && fromIndex !== targetIndex) {
          reorderTracks(currentDraggingId, targetIndex);
        }
      };

      const onUp = () => {
        setDraggingId(null);
        draggingIdRef.current = null;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [reorderTracks, rackRef],
  );

  // Keyboard equivalent of the mouse drag above: the grip is a plain focusable
  // element (not a native <button>, since Left/Right steer reordering rather
  // than "activate"), so arrow keys move the focused strip one slot at a time.
  const onGripKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const fromIndex = tracks.findIndex((t) => t.state.id === id);
      if (fromIndex === -1) return;

      const toIndex = e.key === 'ArrowLeft' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= tracks.length) return;

      e.preventDefault();
      reorderTracks(id, toIndex);
    },
    [tracks, reorderTracks],
  );

  return { draggingId, onHandleMouseDown, onGripKeyDown };
};
