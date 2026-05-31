import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { encodeWav } from '../../utils/encodeWav';
import { formatTime } from '../../utils/formatTime';
import './RecorderBar.css';

type RecorderStatus = 'idle' | 'recording' | 'saving';

export const RecorderBar: React.FC = () => {
  const { engine } = useAudio();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback(() => {
    const stream = engine.getRecordingStream();

    // Pick the best supported MIME type
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m =>
      MediaRecorder.isTypeSupported(m),
    ) ?? '';

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setStatus('saving');
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const compressed = await blob.arrayBuffer();

      // Decode the compressed stream and re-encode as 16-bit PCM WAV
      const audioBuffer = await engine.audioContext.decodeAudioData(compressed);
      const wavBuffer = encodeWav(audioBuffer);

      const now = new Date();
      const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const suggestedName = `session-${stamp}.wav`;

      await window.electronAPI.saveRecording(wavBuffer, suggestedName);
      setStatus('idle');
    };

    recorder.start(250); // collect chunks every 250 ms
    recorderRef.current = recorder;

    setElapsed(0);
    setStatus('recording');
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, [engine]);

  const stop = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  // Clean up on unmount
  useEffect(() => () => {
    clearTimer();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const isRecording = status === 'recording';
  const isSaving = status === 'saving';

  return (
    <div className={`recorder-bar${isRecording ? ' recorder-bar--active' : ''}`}>
      <button
        className={`recorder-btn${isRecording ? ' recorder-btn--stop' : ''}`}
        onClick={isRecording ? stop : start}
        disabled={isSaving}
        title={isRecording ? 'Stop recording and save' : 'Start recording session'}
      >
        {isRecording ? (
          <>
            <span className="recorder-dot" />
            Stop
          </>
        ) : isSaving ? (
          'Saving…'
        ) : (
          <>
            <span className="recorder-dot recorder-dot--idle" />
            Record
          </>
        )}
      </button>

      <span className="recorder-time">
        {isRecording ? formatTime(elapsed) : '--:--'}
      </span>
    </div>
  );
};
