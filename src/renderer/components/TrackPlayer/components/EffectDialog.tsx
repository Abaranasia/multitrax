import { ReactNode, useEffect } from 'react';

export interface EffectDialogProps {
  effect: string;
  title: string;
  onApply: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export const EffectDialog = ({ effect, title, onApply, onCancel, children }: EffectDialogProps) => {
  // Closes on Escape, matching every other overlay in the app (context menu,
  // session menu, view menu). Safe to attach unconditionally: this component
  // only exists in the tree while its dialog is open (each *SettingsDialog is
  // rendered behind an `isOpen &&` guard), so mount/unmount doubles as open/close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className={`${effect}-overlay`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div
        className={`${effect}-panel`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`${effect}-title`}>{title}</div>

        {children}

        <div className={`${effect}-actions`}>
          <button className={`${effect}-apply`} onClick={onApply}>
            Apply
          </button>
          <button className={`${effect}-cancel`} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
