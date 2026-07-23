import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/useAudio';
import { encodeWav } from '../../utils/encodeWav';
import { formatTime } from '../../utils/formatTime';

type RecorderStatus = 'idle' | 'recording' | 'saving';

export const useRecorder = () => {
  const { engine } = useAudio();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const stream = engine.getRecordingStream();

    const mime =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((m) =>
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

      const audioBuffer = await engine.audioContext.decodeAudioData(compressed);
      const wavBuffer = encodeWav(audioBuffer);

      const now = new Date();
      const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const suggestedName = `session-${stamp}.wav`;

      await window.electronAPI.saveRecording(wavBuffer, suggestedName);
      setStatus('idle');
    };

    recorder.start(250);
    recorderRef.current = recorder;

    setElapsed(0);
    setStatus('recording');
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [engine]);

  const stop = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, [clearTimer]);

  return {
    elapsed,
    isRecording: status === 'recording',
    isSaving: status === 'saving',
    start,
    stop,
    formatTime,
  };
};
