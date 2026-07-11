import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { ReverbRoom, TrackState } from '../domain/TrackState';

interface TrackEntry {
  state: TrackState;
  filePath: string;
  // position of the draggable card on the canvas
  x: number;
  y: number;
}

interface AudioContextValue {
  engine: AudioEngine;
  tracks: TrackEntry[];
  addTracks: (files: { path: string; name: string; buffer: ArrayBuffer }[]) => Promise<void>;
  removeTrack: (id: string) => void;
  play: (id: string) => void;
  pause: (id: string) => void;
  stop: (id: string) => void;
  stopAll: () => void;
  playAll: () => void;
  seek: (id: string, seconds: number) => void;
  setVolume: (id: string, value: number) => void;
  setLoop: (id: string, loop: boolean) => void;
  setFadeIn: (id: string, enabled: boolean) => void;
  setFadeOut: (id: string, enabled: boolean) => void;
  setSeekFade: (id: string, enabled: boolean) => void;
  setFadeDurations: (id: string, fadeIn: number, fadeOut: number, seekFade: number) => void;
  setReverbSettings: (
    id: string,
    room: ReverbRoom,
    mix: number,
    preDelay: number,
    damping: number,
    output: number,
  ) => void;
  updatePosition: (id: string, x: number, y: number) => void;
  tickCurrentTimes: () => void;
}

const Ctx = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lazy null-checked init prevents double AudioContext creation in StrictMode.
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  // Close the AudioContext when the provider unmounts to release OS audio streams.
  useEffect(() => {
    return () => {
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, []);

  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const nextPos = useRef({ x: 20, y: 20 });

  const addTracks = useCallback(
    async (files: { path: string; name: string; buffer: ArrayBuffer }[]) => {
      const newEntries: TrackEntry[] = [];

      for (const file of files) {
        const id = crypto.randomUUID();
        const audioBuffer = await engine.audioContext.decodeAudioData(file.buffer.slice(0));

        engine.addTrack(id, audioBuffer);

        const state: TrackState = {
          id,
          title: file.name,
          duration: audioBuffer.duration,
          currentTime: 0,
          volume: 1,
          loop: false,
          playing: false,
          fadeIn: false,
          fadeOut: false,
          seekFade: false,
          fadeInDuration: 5,
          fadeOutDuration: 5,
          seekFadeDuration: 2,
          reverbRoom: 'hall',
          reverbMix: 0,
          reverbPreDelay: 20,
          reverbDamping: 50,
          reverbOutput: 100,
        };

        newEntries.push({
          state,
          filePath: file.path,
          x: nextPos.current.x,
          y: nextPos.current.y,
        });

        nextPos.current = {
          x: nextPos.current.x + 20,
          y: nextPos.current.y + 20,
        };
      }

      setTracks(prev => [...prev, ...newEntries]);
    },
    [engine],
  );

  const removeTrack = useCallback(
    (id: string) => {
      engine.removeTrack(id);
      setTracks(prev => prev.filter(t => t.state.id !== id));
    },
    [engine],
  );

  const play = useCallback(
    (id: string) => {
      engine.play(id);
      setTracks(prev =>
        prev.map(t => (t.state.id === id ? { ...t, state: { ...t.state, playing: true } } : t)),
      );
    },
    [engine],
  );

  const pause = useCallback(
    (id: string) => {
      engine.pause(id);
      setTracks(prev =>
        prev.map(t => (t.state.id === id ? { ...t, state: { ...t.state, playing: false } } : t)),
      );
    },
    [engine],
  );

  const stop = useCallback(
    (id: string) => {
      engine.stop(id);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id
            ? { ...t, state: { ...t.state, playing: false, currentTime: 0 } }
            : t,
        ),
      );
    },
    [engine],
  );

  const stopAll = useCallback(() => {
    engine.stopAll();
    setTracks(prev =>
      prev.map(t => ({ ...t, state: { ...t.state, playing: false, currentTime: 0 } })),
    );
  }, [engine]);

  const playAll = useCallback(() => {
    engine.playAll();
    setTracks(prev =>
      prev.map(t => ({ ...t, state: { ...t.state, playing: true } })),
    );
  }, [engine]);

  const seek = useCallback(
    (id: string, seconds: number) => {
      engine.seek(id, seconds);
      setTracks(prev =>
        prev.map(t => {
          if (t.state.id !== id) return t;
          // During seek-fade the audio is still playing from the old position;
          // let tickCurrentTimes update currentTime naturally.
          if (t.state.seekFade && t.state.playing) {
            return { ...t, state: { ...t.state, playing: engine.isPlaying(id) } };
          }
          return { ...t, state: { ...t.state, currentTime: seconds, playing: engine.isPlaying(id) } };
        }),
      );
    },
    [engine],
  );

  const setVolume = useCallback(
    (id: string, value: number) => {
      engine.setVolume(id, value);
      setTracks(prev =>
        prev.map(t => (t.state.id === id ? { ...t, state: { ...t.state, volume: value } } : t)),
      );
    },
    [engine],
  );

  const setLoop = useCallback(
    (id: string, loop: boolean) => {
      engine.setLoop(id, loop);
      setTracks(prev =>
        prev.map(t => (t.state.id === id ? { ...t, state: { ...t.state, loop } } : t)),
      );
    },
    [engine],
  );

  const setFadeIn = useCallback(
    (id: string, enabled: boolean) => {
      engine.setFadeIn(id, enabled);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id ? { ...t, state: { ...t.state, fadeIn: enabled } } : t,
        ),
      );
    },
    [engine],
  );

  const setFadeOut = useCallback(
    (id: string, enabled: boolean) => {
      engine.setFadeOut(id, enabled);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id ? { ...t, state: { ...t.state, fadeOut: enabled } } : t,
        ),
      );
    },
    [engine],
  );

  const setSeekFade = useCallback(
    (id: string, enabled: boolean) => {
      engine.setSeekFade(id, enabled);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id ? { ...t, state: { ...t.state, seekFade: enabled } } : t,
        ),
      );
    },
    [engine],
  );

  const setFadeDurations = useCallback(
    (id: string, fadeInDuration: number, fadeOutDuration: number, seekFadeDuration: number) => {
      engine.setFadeDurations(id, fadeInDuration, fadeOutDuration, seekFadeDuration);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id
            ? { ...t, state: { ...t.state, fadeInDuration, fadeOutDuration, seekFadeDuration } }
            : t,
        ),
      );
    },
    [engine],
  );

  const setReverbSettings = useCallback(
    (id: string, room: ReverbRoom, mix: number, preDelay: number, damping: number, output: number) => {
      engine.setReverbSettings(id, room, mix, preDelay, damping, output);
      setTracks(prev =>
        prev.map(t =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  reverbRoom: room,
                  reverbMix: mix,
                  reverbPreDelay: preDelay,
                  reverbDamping: damping,
                  reverbOutput: output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setTracks(prev => prev.map(t => (t.state.id === id ? { ...t, x, y } : t)));
  }, []);

  // Called by animation frame to sync currentTime
  const tickCurrentTimes = useCallback(() => {
    setTracks(prev =>
      prev.map(t => ({
        ...t,
        state: {
          ...t.state,
          currentTime: engine.getCurrentTime(t.state.id),
          playing: engine.isPlaying(t.state.id),
        },
      })),
    );
  }, [engine]);

  return (
    <Ctx.Provider
      value={{
        engine,
        tracks,
        addTracks,
        removeTrack,
        play,
        pause,
        stop,
        stopAll,
        playAll,
        seek,
        setVolume,
        setLoop,
        setFadeIn,
        setFadeOut,
        setSeekFade,
        setFadeDurations,
        setReverbSettings,
        updatePosition,
        tickCurrentTimes,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAudio = (): AudioContextValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
};
