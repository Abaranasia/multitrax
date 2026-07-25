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

  if (props.kind === 'select') {
    const { value, onChange, options } = props;
    return (
      <div className={`${effect}-field`}>
        <span className={`${effect}-label`}>{label}</span>
        <select
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
      <span className={labelClassName}>{label}</span>
      <input
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
