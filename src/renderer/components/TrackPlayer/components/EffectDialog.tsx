import { ReactNode } from 'react';

export interface EffectDialogProps {
  effect: string;
  title: string;
  onApply: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export const EffectDialog = ({ effect, title, onApply, onCancel, children }: EffectDialogProps) => {
  return (
    <div
      className={`${effect}-overlay`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div className={`${effect}-panel`} onClick={(e) => e.stopPropagation()}>
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
