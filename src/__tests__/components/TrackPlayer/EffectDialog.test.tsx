import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { EffectDialog } from '@/renderer/components/TrackPlayer/components/EffectDialog';

describe('EffectDialog', () => {
  afterEach(() => cleanup());

  it('renders the overlay/panel/title chrome using the effect prefix and title', () => {
    render(
      <EffectDialog effect="filter-settings" title="◢ Filter" onApply={vi.fn()} onCancel={vi.fn()}>
        <div>field</div>
      </EffectDialog>,
    );

    expect(document.querySelector('.filter-settings-overlay')).not.toBeNull();
    expect(document.querySelector('.filter-settings-panel')).not.toBeNull();
    expect(screen.getByText('◢ Filter').className).toBe('filter-settings-title');
    expect(screen.getByText('field')).not.toBeNull();
  });

  it('renders Apply/Cancel actions and calls the matching callback', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <EffectDialog effect="delay-settings" title="Delay" onApply={onApply} onCancel={onCancel}>
        <div />
      </EffectDialog>,
    );

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    expect(document.querySelector('.delay-settings-apply')).not.toBeNull();
    expect(document.querySelector('.delay-settings-cancel')).not.toBeNull();
  });

  it('calls onCancel when clicking the overlay backdrop but not when clicking inside the panel', () => {
    const onCancel = vi.fn();
    render(
      <EffectDialog effect="reverb-settings" title="Reverb" onApply={vi.fn()} onCancel={onCancel}>
        <div />
      </EffectDialog>,
    );

    fireEvent.click(document.querySelector('.reverb-settings-panel') as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.reverb-settings-overlay') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('exposes the panel as a labeled modal dialog for assistive tech', () => {
    render(
      <EffectDialog effect="filter-settings" title="◢ Filter" onApply={vi.fn()} onCancel={vi.fn()}>
        <div />
      </EffectDialog>,
    );

    const panel = document.querySelector('.filter-settings-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-label')).toBe('◢ Filter');
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <EffectDialog effect="delay-settings" title="Delay" onApply={vi.fn()} onCancel={onCancel}>
        <div />
      </EffectDialog>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel for keys other than Escape', () => {
    const onCancel = vi.fn();
    render(
      <EffectDialog effect="delay-settings" title="Delay" onApply={vi.fn()} onCancel={onCancel}>
        <div />
      </EffectDialog>,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('stops listening for Escape once unmounted', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <EffectDialog effect="delay-settings" title="Delay" onApply={vi.fn()} onCancel={onCancel}>
        <div />
      </EffectDialog>,
    );

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders children between the title and the actions', () => {
    render(
      <EffectDialog
        effect="distortion-settings"
        title="Distortion"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      >
        <div className="probe-field">probe</div>
      </EffectDialog>,
    );

    const panel = document.querySelector('.distortion-settings-panel') as HTMLElement;
    const children = Array.from(panel.children);
    const titleIndex = children.findIndex((el) =>
      el.classList.contains('distortion-settings-title'),
    );
    const fieldIndex = children.findIndex((el) => el.classList.contains('probe-field'));
    const actionsIndex = children.findIndex((el) =>
      el.classList.contains('distortion-settings-actions'),
    );

    expect(titleIndex).toBeLessThan(fieldIndex);
    expect(fieldIndex).toBeLessThan(actionsIndex);
  });
});
