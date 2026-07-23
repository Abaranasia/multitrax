/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

// Minimal mock AudioEngine used by AudioProvider
const mockAudioEngine = {
  getRecordingStream: vi.fn(() => ({})),
  audioContext: {
    decodeAudioData: vi.fn(async (b: ArrayBuffer) => ({ duration: 1 }) as unknown as AudioBuffer),
  },
  close: vi.fn(),
};

vi.mock('@/renderer/audio/AudioEngine', () => ({
  AudioEngine: vi.fn(() => mockAudioEngine),
}));

// Mock encodeWav to return an ArrayBuffer
vi.mock('@/renderer/utils/encodeWav', () => ({
  encodeWav: (buf: AudioBuffer) => new ArrayBuffer(8),
}));

import { RecorderBar } from '@/renderer/components/Recorder/RecorderBar';
import { AudioProvider } from '@/renderer/context/AudioContext';

describe('RecorderBar', () => {
  let lastRecorder: any = null;
  const RealMediaRecorder = (global as any).MediaRecorder;

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();

    // Fake MediaRecorder implementation capturing the instance
    class FakeMediaRecorder {
      mimeType: string;
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      state = 'inactive';
      constructor(
        public stream: any,
        options?: any,
      ) {
        this.mimeType = options?.mimeType || '';
        lastRecorder = this;
      }
      start(_ms?: number) {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }

    // add static helper used by the hook
    (FakeMediaRecorder as any).isTypeSupported = () => true;

    (global as any).MediaRecorder = FakeMediaRecorder;

    // Mock Blob constructor used in onstop
    (global as any).Blob = function (_chunks: any, opts: any) {
      return {
        type: opts?.type || '',
        async arrayBuffer() {
          return new ArrayBuffer(4);
        },
      } as any;
    };

    // Provide electronAPI saveRecording stub (both window and globalThis)
    const saveRecordingMock = vi.fn(async (_buf: ArrayBuffer, _name: string) => true);
    (window as any).electronAPI = { saveRecording: saveRecordingMock };
    (global as any).electronAPI = { saveRecording: saveRecordingMock };
  });

  afterEach(() => {
    cleanup();
    (global as any).MediaRecorder = RealMediaRecorder;
    delete (global as any).Blob;
    delete (window as any).electronAPI;
    delete (global as any).electronAPI;
  });

  it('renders Record button and idle time', () => {
    const { container } = render(
      <AudioProvider>
        <RecorderBar />
      </AudioProvider>,
    );

    expect(screen.getByText('Record')).toBeTruthy();
    expect(screen.getByText('--:--')).toBeTruthy();
    expect(container.querySelector('.recorder-bar')?.className).toContain(
      'recorder-bar--top-right',
    );
  });

  it('starts recording, updates elapsed time and triggers save on stop', async () => {
    render(
      <AudioProvider>
        <RecorderBar />
      </AudioProvider>,
    );

    const btn = screen.getByTitle('Start recording session');

    // start recording (use fake timers to advance elapsed counter)
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(btn);
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();

    // confirm UI updates to show recording elapsed (formatTime -> 0:01)
    expect(screen.getByText('0:01')).toBeTruthy();

    // simulate dataavailable event
    if (!lastRecorder) throw new Error('Recorder not created');
    if (lastRecorder.ondataavailable) {
      lastRecorder.ondataavailable({
        data: {
          size: 1,
          async arrayBuffer() {
            return new ArrayBuffer(4);
          },
        },
      });
    }

    // stop recording (should trigger onstop -> save flow)
    const stopBtn = screen.getByTitle('Stop recording and save');
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    await waitFor(() => expect((window as any).electronAPI.saveRecording).toHaveBeenCalled());
  });
});
