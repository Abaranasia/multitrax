import type { ChangeEvent, CSSProperties } from 'react';

export const useMasterBalanceControl = (
  masterBalance: number,
  setMasterBalance: (value: number) => void,
) => {
  const pan = masterBalance;
  return {
    pan,
    className: pan < 0 ? 'pan-input pan-input--left' : pan > 0 ? 'pan-input pan-input--right' : 'pan-input',
    style: { '--pan-fill': `${Math.round((pan + 1) * 50)}%` } as CSSProperties,
    title: `Balance: ${pan === 0 ? 'Center' : pan < 0 ? `${Math.round(-pan * 100)}% Left` : `${Math.round(pan * 100)}% Right`}`,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setMasterBalance(parseFloat(e.target.value)),
    onDoubleClick: () => setMasterBalance(0),
  };
};
