import React, { useRef, useState, useCallback, useEffect } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { FilterType, ReverbRoom, TrackState } from '../domain/TrackState';
import { Ctx, TrackEntry } from './audioContextInstance';

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize the engine once per provider mount, without touching refs during render.
  const [engine] = useState<AudioEngine>(() => new AudioEngine());

  // Close the AudioContext when the provider unmounts to release OS audio streams.
  useEffect(() => {
    return () => {
      engine.close();
    };
  }, [engine]);

  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const nextPos = useRef({ x: 20, y: 20 });

  const addTracks = useCallback(
    async (files: { path: string; name: string; buffer: ArrayBuffer }[]) => {
      const newEntries: TrackEntry[] = [];

      for (const file of files) {
        const id = crypto.randomUUID();
        const audioBuffer = await engine.audioContext.decodeAudioData(file.buffer.slice(0));

        engine.addTrack(id, audioBuffer);

        const waveform = Array.from({ length: 48 }, (_, index) => {
          const sliceStart = (index / 48) * (audioBuffer.length ?? 0);
          const sliceEnd = ((index + 1) / 48) * (audioBuffer.length ?? 0);
          const channelData =
            typeof audioBuffer.getChannelData === 'function' ? audioBuffer.getChannelData(0) : null;
          let peak = 0;
          for (let i = sliceStart; i < sliceEnd; i += 1) {
            const value = channelData ? Math.abs(channelData[Math.floor(i)] ?? 0) : 0;
            if (value > peak) peak = value;
          }
          return Math.min(1, peak * 1.4);
        });

        const state: TrackState = {
          id,
          title: file.name,
          duration: audioBuffer.duration,
          currentTime: 0,
          volume: 1,
          pan: 0,
          loop: true,
          playing: false,
          fadeIn: false,
          fadeOut: false,
          seekFade: false,
          fadeInDuration: 5,
          fadeOutDuration: 5,
          seekFadeDuration: 2,
          filterType: 'lowpass',
          filterCutoff: 1000,
          filterResonance: 1,
          filterMix: 0,
          filterOutput: 100,
          delayTime: 300,
          delayFeedback: 35,
          delayMix: 0,
          delayDamping: 50,
          delayOutput: 100,
          reverbRoom: 'hall',
          reverbMix: 0,
          reverbPreDelay: 20,
          reverbDamping: 50,
          reverbOutput: 100,
          distortionDrive: 0,
          distortionTone: 100,
          distortionMix: 0,
          distortionOutput: 100,
          waveform,
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

      setTracks((prev) => [...prev, ...newEntries]);
    },
    [engine],
  );

  const duplicateTrack = useCallback(
    (id: string) => {
      const source = tracks.find((t) => t.state.id === id);
      const buffer = engine.getBuffer(id);
      if (!source || !buffer) return;

      const newId = crypto.randomUUID();
      engine.addTrack(newId, buffer);
      engine.setFilterSettings(
        newId,
        source.state.filterType,
        source.state.filterCutoff,
        source.state.filterResonance,
        source.state.filterMix,
        source.state.filterOutput,
      );
      engine.setDelaySettings(
        newId,
        source.state.delayTime,
        source.state.delayFeedback,
        source.state.delayMix,
        source.state.delayDamping,
        source.state.delayOutput,
      );
      engine.setReverbSettings(
        newId,
        source.state.reverbRoom,
        source.state.reverbMix,
        source.state.reverbPreDelay,
        source.state.reverbDamping,
        source.state.reverbOutput,
      );
      engine.setDistortionSettings(
        newId,
        source.state.distortionDrive,
        source.state.distortionTone,
        source.state.distortionMix,
        source.state.distortionOutput,
      );
      engine.setVolume(newId, source.state.volume);
      engine.setPan(newId, source.state.pan);
      engine.setLoop(newId, source.state.loop);

      const newEntry: TrackEntry = {
        state: {
          ...source.state,
          id: newId,
          title: `${source.state.title} copy`,
          currentTime: 0,
          playing: false,
        },
        filePath: source.filePath,
        x: source.x + 20,
        y: source.y + 20,
      };

      setTracks((prev) => [...prev, newEntry]);
    },
    [engine, tracks],
  );

  const removeTrack = useCallback(
    (id: string) => {
      engine.removeTrack(id);
      setTracks((prev) => prev.filter((t) => t.state.id !== id));
    },
    [engine],
  );

  const play = useCallback(
    (id: string) => {
      engine.play(id);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, playing: true } } : t)),
      );
    },
    [engine],
  );

  const pause = useCallback(
    (id: string) => {
      engine.pause(id);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, playing: false } } : t)),
      );
    },
    [engine],
  );

  const stop = useCallback(
    (id: string) => {
      engine.stop(id);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id ? { ...t, state: { ...t.state, playing: false, currentTime: 0 } } : t,
        ),
      );
    },
    [engine],
  );

  const stopAll = useCallback(() => {
    engine.stopAll();
    setTracks((prev) =>
      prev.map((t) => ({ ...t, state: { ...t.state, playing: false, currentTime: 0 } })),
    );
  }, [engine]);

  const playAll = useCallback(() => {
    engine.playAll();
    setTracks((prev) => prev.map((t) => ({ ...t, state: { ...t.state, playing: true } })));
  }, [engine]);

  const seek = useCallback(
    (id: string, seconds: number) => {
      engine.seek(id, seconds);
      setTracks((prev) =>
        prev.map((t) => {
          if (t.state.id !== id) return t;
          // During seek-fade the audio is still playing from the old position;
          // let tickCurrentTimes update currentTime naturally.
          if (t.state.seekFade && t.state.playing) {
            return { ...t, state: { ...t.state, playing: engine.isPlaying(id) } };
          }
          return {
            ...t,
            state: { ...t.state, currentTime: seconds, playing: engine.isPlaying(id) },
          };
        }),
      );
    },
    [engine],
  );

  const setVolume = useCallback(
    (id: string, value: number) => {
      engine.setVolume(id, value);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, volume: value } } : t)),
      );
    },
    [engine],
  );

  const setPan = useCallback(
    (id: string, value: number) => {
      engine.setPan(id, value);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, pan: value } } : t)),
      );
    },
    [engine],
  );

  const setLoop = useCallback(
    (id: string, loop: boolean) => {
      engine.setLoop(id, loop);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, loop } } : t)),
      );
    },
    [engine],
  );

  const setFadeIn = useCallback(
    (id: string, enabled: boolean) => {
      engine.setFadeIn(id, enabled);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, fadeIn: enabled } } : t)),
      );
    },
    [engine],
  );

  const setFadeOut = useCallback(
    (id: string, enabled: boolean) => {
      engine.setFadeOut(id, enabled);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id ? { ...t, state: { ...t.state, fadeOut: enabled } } : t,
        ),
      );
    },
    [engine],
  );

  const setSeekFade = useCallback(
    (id: string, enabled: boolean) => {
      engine.setSeekFade(id, enabled);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id ? { ...t, state: { ...t.state, seekFade: enabled } } : t,
        ),
      );
    },
    [engine],
  );

  const setFadeDurations = useCallback(
    (id: string, fadeInDuration: number, fadeOutDuration: number, seekFadeDuration: number) => {
      engine.setFadeDurations(id, fadeInDuration, fadeOutDuration, seekFadeDuration);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? { ...t, state: { ...t.state, fadeInDuration, fadeOutDuration, seekFadeDuration } }
            : t,
        ),
      );
    },
    [engine],
  );

  const setFilterSettings = useCallback(
    (
      id: string,
      type: FilterType,
      cutoff: number,
      resonance: number,
      mix: number,
      output: number,
    ) => {
      engine.setFilterSettings(id, type, cutoff, resonance, mix, output);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  filterType: type,
                  filterCutoff: cutoff,
                  filterResonance: resonance,
                  filterMix: mix,
                  filterOutput: output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const setDelaySettings = useCallback(
    (
      id: string,
      delayTime: number,
      feedback: number,
      mix: number,
      damping: number,
      output: number,
    ) => {
      engine.setDelaySettings(id, delayTime, feedback, mix, damping, output);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  delayTime,
                  delayFeedback: feedback,
                  delayMix: mix,
                  delayDamping: damping,
                  delayOutput: output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const setReverbSettings = useCallback(
    (
      id: string,
      room: ReverbRoom,
      mix: number,
      preDelay: number,
      damping: number,
      output: number,
    ) => {
      engine.setReverbSettings(id, room, mix, preDelay, damping, output);
      setTracks((prev) =>
        prev.map((t) =>
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

  const setDistortionSettings = useCallback(
    (id: string, drive: number, tone: number, mix: number, output: number) => {
      engine.setDistortionSettings(id, drive, tone, mix, output);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  distortionDrive: drive,
                  distortionTone: tone,
                  distortionMix: mix,
                  distortionOutput: output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setTracks((prev) => prev.map((t) => (t.state.id === id ? { ...t, x, y } : t)));
  }, []);

  // Called by animation frame to sync currentTime
  const tickCurrentTimes = useCallback(() => {
    setTracks((prev) =>
      prev.map((t) => ({
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
        duplicateTrack,
        removeTrack,
        play,
        pause,
        stop,
        stopAll,
        playAll,
        seek,
        setVolume,
        setPan,
        setLoop,
        setFadeIn,
        setFadeOut,
        setSeekFade,
        setFadeDurations,
        setFilterSettings,
        setDelaySettings,
        setReverbSettings,
        setDistortionSettings,
        updatePosition,
        tickCurrentTimes,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
