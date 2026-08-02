import { vi } from 'vitest';
import type { ElectronAPI } from '@/renderer/types/electron';

/**
 * Builds a complete `window.electronAPI` stub for suites that exercise the
 * preload bridge from the renderer side.
 *
 * Returning the full surface (rather than the two or three methods a given
 * suite happens to call) keeps `window.electronAPI = …` assignments
 * type-checking as new bridge methods are added. Pass `overrides` for the
 * methods the test actually asserts on.
 */
export function createMockElectronAPI(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  return {
    openAudioFiles: vi.fn(() => Promise.resolve([])),
    readAudioFile: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    saveRecording: vi.fn(() => Promise.resolve({ saved: true })),
    revealFile: vi.fn(() => Promise.resolve({ revealed: true })),
    getPathForFile: vi.fn((file: File) => file.name),
    ...overrides,
  };
}
