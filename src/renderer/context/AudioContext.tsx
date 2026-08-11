import React, { useRef, useState, useCallback } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { TrackState } from '../domain/TrackState';
import {
  FilterSettings,
  DistortionSettings,
  DelaySettings,
  ReverbSettings,
} from '../audio/effectSettings';
import { Ctx, TrackEntry } from './audioContextInstance';
import { computeWaveformPeaks } from '../audio/waveform';
import { SessionTrackSnapshot } from '../domain/SessionFile';
import { SIDE_INSET, TOP_INSET } from '../utils/canvasLayout';

// Mute silences a track outright; otherwise, once any track anywhere is
// soloed, every non-soloed track is silenced too (solo is additive — more
// than one track can be soloed at once). This is the single place that
// decides what gain actually reaches `engine.setVolume`, independent of the
// nominal `state.volume` the fader UI reflects.
const effectiveVolume = (state: TrackState, anySoloed: boolean): number =>
  state.muted || (anySoloed && !state.soloed) ? 0 : state.volume;

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize the engine once per provider mount, without touching refs during render.
  // AudioProvider wraps the whole app and lives for the process lifetime, so there is
  // no real remount case to clean up after — closing on unmount only fired spuriously
  // under StrictMode's dev-only double-invoke, permanently killing the AudioContext.
  const [engine] = useState<AudioEngine>(() => new AudioEngine());

  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [masterBalance, setMasterBalanceState] = useState(0);
  const nextPos = useRef({ x: SIDE_INSET, y: TOP_INSET });

  const setMasterVolume = useCallback(
    (value: number) => {
      engine.setMasterVolume(value);
      setMasterVolumeState(value);
    },
    [engine],
  );

  const setMasterBalance = useCallback(
    (value: number) => {
      engine.setMasterBalance(value);
      setMasterBalanceState(value);
    },
    [engine],
  );

  const addTracks = useCallback(
    async (files: { path: string; name: string; buffer: ArrayBuffer }[]) => {
      const newEntries: TrackEntry[] = [];
      const anySoloed = tracks.some((t) => t.state.soloed);

      for (const file of files) {
        try {
          const id = crypto.randomUUID();
          const audioBuffer = await engine.audioContext.decodeAudioData(file.buffer.slice(0));

          engine.addTrack(id, audioBuffer);

          const waveform = computeWaveformPeaks(audioBuffer);

          const state: TrackState = {
            id,
            title: file.name,
            duration: audioBuffer.duration,
            currentTime: 0,
            volume: 1,
            pan: 0,
            muted: false,
            soloed: false,
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

          // A newly-added track defaults to unmuted/unsoloed, but if some
          // other track is already soloed, it must join the rest of the mix
          // in silence rather than play at the engine's default gain of 1.
          engine.setVolume(id, effectiveVolume(state, anySoloed));

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
        } catch (err) {
          console.error(file.name, err);
          continue;
        }
      }

      setTracks((prev) => [...prev, ...newEntries]);
    },
    [engine, tracks],
  );

  const duplicateTrack = useCallback(
    (id: string) => {
      const source = tracks.find((t) => t.state.id === id);
      const buffer = engine.getBuffer(id);
      if (!source || !buffer) return;

      const newId = crypto.randomUUID();
      engine.addTrack(newId, buffer);
      engine.setFilterSettings(newId, {
        type: source.state.filterType,
        cutoff: source.state.filterCutoff,
        resonance: source.state.filterResonance,
        mix: source.state.filterMix,
        output: source.state.filterOutput,
      });
      engine.setDelaySettings(newId, {
        delayTime: source.state.delayTime,
        feedback: source.state.delayFeedback,
        mix: source.state.delayMix,
        damping: source.state.delayDamping,
        output: source.state.delayOutput,
      });
      engine.setReverbSettings(newId, {
        room: source.state.reverbRoom,
        mix: source.state.reverbMix,
        preDelay: source.state.reverbPreDelay,
        damping: source.state.reverbDamping,
        output: source.state.reverbOutput,
      });
      engine.setDistortionSettings(newId, {
        drive: source.state.distortionDrive,
        tone: source.state.distortionTone,
        mix: source.state.distortionMix,
        output: source.state.distortionOutput,
      });
      const newState: TrackState = {
        ...source.state,
        id: newId,
        title: `${source.state.title} copy`,
        currentTime: 0,
        playing: false,
      };

      // Route through effectiveVolume, not the raw nominal volume — a
      // duplicate inherits muted/soloed from its source, and the engine gain
      // must reflect that (and the current solo-elsewhere state) immediately,
      // not just the UI.
      const anySoloed = tracks.some((t) => t.state.soloed);
      engine.setVolume(newId, effectiveVolume(newState, anySoloed));
      engine.setPan(newId, source.state.pan);
      engine.setLoop(newId, source.state.loop);

      const newEntry: TrackEntry = {
        state: newState,
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
      const track = tracks.find((t) => t.state.id === id);
      // TrackPlayer's card view can render a track's VolumeControl straight
      // from a `state` prop that isn't (yet) registered in `tracks` — fall
      // back to the raw value in that case, same as before mute/solo existed.
      const anySoloed = tracks.some((t) => t.state.soloed);
      const effective = track
        ? effectiveVolume({ ...track.state, volume: value }, anySoloed)
        : value;
      engine.setVolume(id, effective);
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, volume: value } } : t)),
      );
    },
    [engine, tracks],
  );

  const setMuted = useCallback(
    (id: string, muted: boolean) => {
      const track = tracks.find((t) => t.state.id === id);
      if (track) {
        const anySoloed = tracks.some((t) => t.state.soloed);
        engine.setVolume(id, effectiveVolume({ ...track.state, muted }, anySoloed));
      }
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, muted } } : t)),
      );
    },
    [engine, tracks],
  );

  const setSoloed = useCallback(
    (id: string, soloed: boolean) => {
      const nextStates = tracks.map((t) =>
        t.state.id === id ? { ...t.state, soloed } : t.state,
      );
      const anySoloed = nextStates.some((s) => s.soloed);
      for (const state of nextStates) {
        engine.setVolume(state.id, effectiveVolume(state, anySoloed));
      }
      setTracks((prev) =>
        prev.map((t) => (t.state.id === id ? { ...t, state: { ...t.state, soloed } } : t)),
      );
    },
    [engine, tracks],
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
    (id: string, s: FilterSettings) => {
      engine.setFilterSettings(id, s);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  filterType: s.type,
                  filterCutoff: s.cutoff,
                  filterResonance: s.resonance,
                  filterMix: s.mix,
                  filterOutput: s.output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const setDelaySettings = useCallback(
    (id: string, s: DelaySettings) => {
      engine.setDelaySettings(id, s);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  delayTime: s.delayTime,
                  delayFeedback: s.feedback,
                  delayMix: s.mix,
                  delayDamping: s.damping,
                  delayOutput: s.output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const setReverbSettings = useCallback(
    (id: string, s: ReverbSettings) => {
      engine.setReverbSettings(id, s);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  reverbRoom: s.room,
                  reverbMix: s.mix,
                  reverbPreDelay: s.preDelay,
                  reverbDamping: s.damping,
                  reverbOutput: s.output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const setDistortionSettings = useCallback(
    (id: string, s: DistortionSettings) => {
      engine.setDistortionSettings(id, s);
      setTracks((prev) =>
        prev.map((t) =>
          t.state.id === id
            ? {
                ...t,
                state: {
                  ...t.state,
                  distortionDrive: s.drive,
                  distortionTone: s.tone,
                  distortionMix: s.mix,
                  distortionOutput: s.output,
                },
              }
            : t,
        ),
      );
    },
    [engine],
  );

  const loadSession = useCallback(
    async (snapshots: SessionTrackSnapshot[]): Promise<{ loaded: number; missing: string[] }> => {
      // Design decision: Load Session REPLACES the canvas rather than merging
      // with it. Remove every currently-loaded engine track up front; `tracks`
      // itself is overwritten wholesale below via a single `setTracks` call.
      for (const entry of tracks) {
        engine.removeTrack(entry.state.id);
      }

      const newEntries: TrackEntry[] = [];
      const missing: string[] = [];

      for (const snapshot of snapshots) {
        const result = await window.electronAPI.readSessionAudioFile(snapshot.filePath);
        if (!result.ok || !result.buffer) {
          missing.push(snapshot.filePath);
          continue;
        }

        const id = crypto.randomUUID();
        const audioBuffer = await engine.audioContext.decodeAudioData(result.buffer.slice(0));

        engine.addTrack(id, audioBuffer);
        engine.setFilterSettings(id, {
          type: snapshot.filterType,
          cutoff: snapshot.filterCutoff,
          resonance: snapshot.filterResonance,
          mix: snapshot.filterMix,
          output: snapshot.filterOutput,
        });
        engine.setDelaySettings(id, {
          delayTime: snapshot.delayTime,
          feedback: snapshot.delayFeedback,
          mix: snapshot.delayMix,
          damping: snapshot.delayDamping,
          output: snapshot.delayOutput,
        });
        engine.setReverbSettings(id, {
          room: snapshot.reverbRoom,
          mix: snapshot.reverbMix,
          preDelay: snapshot.reverbPreDelay,
          damping: snapshot.reverbDamping,
          output: snapshot.reverbOutput,
        });
        engine.setDistortionSettings(id, {
          drive: snapshot.distortionDrive,
          tone: snapshot.distortionTone,
          mix: snapshot.distortionMix,
          output: snapshot.distortionOutput,
        });
        engine.setVolume(id, snapshot.volume);
        engine.setPan(id, snapshot.pan);
        engine.setLoop(id, snapshot.loop);

        const state: TrackState = {
          id,
          title: snapshot.title,
          duration: audioBuffer.duration,
          currentTime: 0,
          volume: snapshot.volume,
          pan: snapshot.pan,
          muted: false,
          soloed: false,
          loop: snapshot.loop,
          playing: false,
          fadeIn: snapshot.fadeIn,
          fadeOut: snapshot.fadeOut,
          seekFade: snapshot.seekFade,
          fadeInDuration: snapshot.fadeInDuration,
          fadeOutDuration: snapshot.fadeOutDuration,
          seekFadeDuration: snapshot.seekFadeDuration,
          filterType: snapshot.filterType,
          filterCutoff: snapshot.filterCutoff,
          filterResonance: snapshot.filterResonance,
          filterMix: snapshot.filterMix,
          filterOutput: snapshot.filterOutput,
          delayTime: snapshot.delayTime,
          delayFeedback: snapshot.delayFeedback,
          delayMix: snapshot.delayMix,
          delayDamping: snapshot.delayDamping,
          delayOutput: snapshot.delayOutput,
          reverbRoom: snapshot.reverbRoom,
          reverbMix: snapshot.reverbMix,
          reverbPreDelay: snapshot.reverbPreDelay,
          reverbDamping: snapshot.reverbDamping,
          reverbOutput: snapshot.reverbOutput,
          distortionDrive: snapshot.distortionDrive,
          distortionTone: snapshot.distortionTone,
          distortionMix: snapshot.distortionMix,
          distortionOutput: snapshot.distortionOutput,
          waveform: computeWaveformPeaks(audioBuffer),
        };

        newEntries.push({
          state,
          filePath: snapshot.filePath,
          x: snapshot.x,
          y: snapshot.y,
        });
      }

      setTracks(newEntries);

      return { loaded: newEntries.length, missing };
    },
    [engine, tracks],
  );

  const newSession = useCallback(() => {
    for (const entry of tracks) {
      engine.removeTrack(entry.state.id);
    }
    setTracks([]);
  }, [engine, tracks]);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setTracks((prev) => prev.map((t) => (t.state.id === id ? { ...t, x, y } : t)));
  }, []);

  const reorderTracks = useCallback((id: string, toIndex: number) => {
    setTracks((prev) => {
      const fromIndex = prev.findIndex((t) => t.state.id === id);
      if (fromIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
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
        masterVolume,
        masterBalance,
        setMasterVolume,
        setMasterBalance,
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
        setMuted,
        setSoloed,
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
        reorderTracks,
        tickCurrentTimes,
        loadSession,
        newSession,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};
