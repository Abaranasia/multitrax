import { useId } from 'react';

interface SettingsFieldOption {
  value: string;
  label: string;
}

export type SettingsFieldProps =
  | {
      kind: 'slider';
      effect: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      onChange: (value: number) => void;
      format: (value: number) => string;
      mix?: boolean;
    }
  | {
      kind: 'select';
      effect: string;
      label: string;
      value: string;
      onChange: (value: string) => void;
      options: SettingsFieldOption[];
    };

export const SettingsField = (props: SettingsFieldProps) => {
  const { effect, label } = props;
  // Generated per instance (not derived from `effect`/`label`) so the id stays
  // unique even when the same effect dialog is open for two different tracks
  // at once — a document-wide id collision would break both fields' association.
  const fieldId = useId();

  if (props.kind === 'select') {
    const { value, onChange, options } = props;
    return (
      <div className={`${effect}-field`}>
        <label className={`${effect}-label`} htmlFor={fieldId}>
          {label}
        </label>
        <select
          id={fieldId}
          className={`${effect}-select`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const { min, max, step, value, onChange, format, mix } = props;
  const labelClassName = mix ? `${effect}-label ${effect}-label--mix` : `${effect}-label`;
  const valueClassName = mix ? `${effect}-value ${effect}-value--mix` : `${effect}-value`;

  return (
    <div className={`${effect}-field`}>
      <label className={labelClassName} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={valueClassName}>{format(value)}</span>
    </div>
  );
};
