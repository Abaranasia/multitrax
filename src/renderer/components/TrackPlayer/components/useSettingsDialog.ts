import { useCallback, useState } from 'react';

interface UseSettingsDialogResult<TDraft extends object> {
  isOpen: boolean;
  draft: TDraft;
  setField: <K extends keyof TDraft>(key: K, value: TDraft[K]) => void;
  open: () => void;
  close: () => void;
  apply: () => void;
}

/**
 * Generic core behind every effect settings dialog hook. Owns open/closed
 * state and a draft object; `open()` reseeds the draft from live state via
 * `seed()` (matching the pre-existing per-effect re-sync behavior), `apply()`
 * commits the current draft via `onApply()` and closes, `close()` discards
 * without committing.
 */
export const useSettingsDialog = <TDraft extends object>(
  seed: () => TDraft,
  onApply: (draft: TDraft) => void,
): UseSettingsDialogResult<TDraft> => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<TDraft>(seed);

  const setField = useCallback(
    <K extends keyof TDraft>(key: K, value: TDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const open = useCallback(() => {
    setDraft(seed());
    setIsOpen(true);
  }, [seed]);

  const close = useCallback(() => setIsOpen(false), []);

  const apply = useCallback(() => {
    onApply(draft);
    setIsOpen(false);
  }, [draft, onApply]);

  return { isOpen, draft, setField, open, close, apply };
};
