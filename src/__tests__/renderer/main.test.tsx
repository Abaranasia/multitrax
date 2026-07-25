/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from 'vitest';

document.body.innerHTML = '<div id="root"></div>';
// Mock createRoot before importing the module; it sets a global flag when render runs
vi.mock('react-dom/client', () => {
  return {
    createRoot: (_el: HTMLElement) => ({
      render: () => {
        (global as any).__TEST_RENDER_CALLED = true;
      },
    }),
  };
});

// Provide a DOM root element for the module to find
document.body.innerHTML = '<div id="root"></div>';

// Import the module under test (it will call createRoot during import)
import '@/renderer/main';

describe('renderer main', () => {
  it('calls createRoot and renders the app', () => {
    expect((global as any).__TEST_RENDER_CALLED).toBeTruthy();
  });
});
