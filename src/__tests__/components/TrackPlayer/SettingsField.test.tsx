import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { SettingsField } from '@/renderer/components/TrackPlayer/components/SettingsField';

describe('SettingsField', () => {
  afterEach(() => cleanup());

  it('renders a slider field with formatted value and calls onChange with a number', () => {
    const onChange = vi.fn();
    render(
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Cutoff"
        min={20}
        max={20000}
        step={10}
        value={1000}
        onChange={onChange}
        format={(v) => `${v}Hz`}
      />,
    );

    expect(document.querySelector('.filter-settings-field')).not.toBeNull();
    const label = document.querySelector('.filter-settings-label') as HTMLElement;
    expect(label.textContent).toBe('Cutoff');
    expect(label.className).toBe('filter-settings-label');

    const input = document.querySelector('input[type=range]') as HTMLInputElement;
    expect(input.value).toBe('1000');
    expect(input.min).toBe('20');
    expect(input.max).toBe('20000');
    expect(input.step).toBe('10');

    const value = document.querySelector('.filter-settings-value') as HTMLElement;
    expect(value.textContent).toBe('1000Hz');

    fireEvent.change(input, { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith(2500);
  });

  it('associates the slider label with its input via htmlFor/id, so screen readers announce a name', () => {
    render(
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Cutoff"
        min={20}
        max={20000}
        step={10}
        value={1000}
        onChange={vi.fn()}
        format={(v) => `${v}Hz`}
      />,
    );

    const label = document.querySelector('.filter-settings-label') as HTMLLabelElement;
    const input = document.querySelector('input[type=range]') as HTMLInputElement;
    expect(label.tagName).toBe('LABEL');
    expect(label.htmlFor).toBe(input.id);
    expect(input.id).not.toBe('');
  });

  it('gives two simultaneously-rendered instances of the same field distinct ids, so two open dialogs (e.g. for two different tracks) never collide', () => {
    const sliderProps = {
      kind: 'slider' as const,
      effect: 'filter-settings',
      label: 'Cutoff',
      min: 20,
      max: 20000,
      step: 10,
      value: 1000,
      onChange: vi.fn(),
      format: (v: number) => `${v}Hz`,
    };
    render(
      <>
        <SettingsField {...sliderProps} />
        <SettingsField {...sliderProps} />
      </>,
    );

    const inputs = document.querySelectorAll('input[type=range]');
    expect(inputs.length).toBe(2);
    const [firstId, secondId] = Array.from(inputs).map((el) => el.id);
    expect(firstId).not.toBe(secondId);
    expect(firstId).not.toBe('');
  });

  it('applies the mix modifier classes to label and value when mix is true', () => {
    render(
      <SettingsField
        kind="slider"
        effect="filter-settings"
        label="Mix"
        min={0}
        max={100}
        step={1}
        value={40}
        onChange={vi.fn()}
        format={(v) => `${v}%`}
        mix
      />,
    );

    const label = document.querySelector('.filter-settings-label') as HTMLElement;
    const value = document.querySelector('.filter-settings-value') as HTMLElement;
    expect(label.className).toBe('filter-settings-label filter-settings-label--mix');
    expect(value.className).toBe('filter-settings-value filter-settings-value--mix');
  });

  it('renders a select field with options and calls onChange with the selected value', () => {
    const onChange = vi.fn();
    render(
      <SettingsField
        kind="select"
        effect="reverb-settings"
        label="Room"
        value="hall"
        onChange={onChange}
        options={[
          { value: 'small-room', label: 'Small Room' },
          { value: 'hall', label: 'Hall' },
          { value: 'plate', label: 'Plate' },
          { value: 'cathedral', label: 'Cathedral' },
        ]}
      />,
    );

    const select = document.querySelector('.reverb-settings-select') as HTMLSelectElement;
    expect(select.value).toBe('hall');
    expect(select.querySelectorAll('option').length).toBe(4);

    fireEvent.change(select, { target: { value: 'cathedral' } });
    expect(onChange).toHaveBeenCalledWith('cathedral');
  });

  it('associates the select label with its dropdown via htmlFor/id', () => {
    render(
      <SettingsField
        kind="select"
        effect="reverb-settings"
        label="Room"
        value="hall"
        onChange={vi.fn()}
        options={[{ value: 'hall', label: 'Hall' }]}
      />,
    );

    const label = document.querySelector('.reverb-settings-label') as HTMLLabelElement;
    const select = document.querySelector('.reverb-settings-select') as HTMLSelectElement;
    expect(label.tagName).toBe('LABEL');
    expect(label.htmlFor).toBe(select.id);
    expect(select.id).not.toBe('');
  });
});
