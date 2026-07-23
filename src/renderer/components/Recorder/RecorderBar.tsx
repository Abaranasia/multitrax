import React from 'react';
import { useRecorder } from './useRecorder';
import './RecorderBar.css';

export const RecorderBar = () => {
  const { elapsed, isRecording, isSaving, start, stop, formatTime } = useRecorder();

  return (
    <div
      className={`recorder-bar recorder-bar--top-right${isRecording ? ' recorder-bar--active' : ''}`}
    >
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

      <span className="recorder-time">{isRecording ? formatTime(elapsed) : '--:--'}</span>
    </div>
  );
};
