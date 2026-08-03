import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/useAudio';
import { TrackEntry } from '../../context/audioContextInstance';
import { SessionFile, SessionTrackSnapshot } from '../../domain/SessionFile';
import { computeGridPositions } from '../../utils/canvasLayout';

const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm']);

function isKnownAudio(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTS.has(ext);
}

function buildSessionSnapshots(tracks: TrackEntry[]): SessionTrackSnapshot[] {
  return tracks.map(({ state, filePath, x, y }) => ({
    filePath,
    title: state.title,
    x,
    y,
    volume: state.volume,
    pan: state.pan,
    loop: state.loop,
    fadeIn: state.fadeIn,
    fadeOut: state.fadeOut,
    seekFade: state.seekFade,
    fadeInDuration: state.fadeInDuration,
    fadeOutDuration: state.fadeOutDuration,
    seekFadeDuration: state.seekFadeDuration,
    filterType: state.filterType,
    filterCutoff: state.filterCutoff,
    filterResonance: state.filterResonance,
    filterMix: state.filterMix,
    filterOutput: state.filterOutput,
    delayTime: state.delayTime,
    delayFeedback: state.delayFeedback,
    delayMix: state.delayMix,
    delayDamping: state.delayDamping,
    delayOutput: state.delayOutput,
    reverbRoom: state.reverbRoom,
    reverbMix: state.reverbMix,
    reverbPreDelay: state.reverbPreDelay,
    reverbDamping: state.reverbDamping,
    reverbOutput: state.reverbOutput,
    distortionDrive: state.distortionDrive,
    distortionTone: state.distortionTone,
    distortionMix: state.distortionMix,
    distortionOutput: state.distortionOutput,
  }));
}

function defaultSessionFileName(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `session-${now.getFullYear()}-${month}-${day}_${hours}-${minutes}.json`;
}

export const useCanvas = () => {
  const {
    tracks,
    addTracks,
    tickCurrentTimes,
    stopAll,
    playAll,
    loadSession,
    newSession,
    updatePosition,
  } = useAudio();

  useEffect(() => {
    const id = setInterval(tickCurrentTimes, 100);
    return () => clearInterval(id);
  }, [tickCurrentTimes]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      const files: { path: string; name: string; buffer: ArrayBuffer }[] = [];

      for (const file of Array.from(e.dataTransfer.files)) {
        if (!file.type.startsWith('audio/') && !isKnownAudio(file.name)) continue;

        // Electron removed `File.path` in v32, so the real on-disk path can only
        // come from the preload bridge. Fall back to the bare name outside
        // Electron (tests, browser) — degraded, but never throws.
        const filePath = window.electronAPI?.getPathForFile(file) ?? file.name;
        const arrayBuffer = await file.arrayBuffer();
        files.push({ path: filePath, name: file.name, buffer: arrayBuffer });
      }

      if (files.length > 0) await addTracks(files);
    },
    [addTracks],
  );

  const isOpeningFilesRef = useRef(false);
  const [isOpeningFiles, setIsOpeningFiles] = useState(false);

  const onOpenFiles = useCallback(async () => {
    if (!window.electronAPI || isOpeningFilesRef.current) return;

    isOpeningFilesRef.current = true;
    setIsOpeningFiles(true);
    try {
      const paths = await window.electronAPI.openAudioFiles();
      if (!paths.length) return;

      const files: { path: string; name: string; buffer: ArrayBuffer }[] = [];
      for (const p of paths) {
        const buf = await window.electronAPI.readAudioFile(p);
        const name = p.split('/').pop() ?? p.split('\\').pop() ?? p;
        files.push({ path: p, name, buffer: buf });
      }

      await addTracks(files);
    } finally {
      isOpeningFilesRef.current = false;
      setIsOpeningFiles(false);
    }
  }, [addTracks]);

  const isSavingSessionRef = useRef(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [currentSessionPath, setCurrentSessionPath] = useState<string | null>(null);

  // Quick save: writes straight back to `currentSessionPath` (a prior save-as
  // or a completed load) with no dialog. Falls back to the save-dialog flow
  // the first time this run, when no path is known yet.
  const onSaveSession = useCallback(async () => {
    if (!window.electronAPI || isSavingSessionRef.current) return;

    isSavingSessionRef.current = true;
    setIsSavingSession(true);
    try {
      const session: SessionFile = { version: 1, tracks: buildSessionSnapshots(tracks) };
      const json = JSON.stringify(session);

      if (currentSessionPath) {
        await window.electronAPI.writeSessionFile(currentSessionPath, json);
        return;
      }

      const result = await window.electronAPI.saveSession(json, defaultSessionFileName());
      if (result.saved && result.filePath) setCurrentSessionPath(result.filePath);
    } finally {
      isSavingSessionRef.current = false;
      setIsSavingSession(false);
    }
  }, [tracks, currentSessionPath]);

  // Save-as: always opens the save dialog, even when a path is already
  // known, and remembers whatever path the user picks.
  const onSaveNewSession = useCallback(async () => {
    if (!window.electronAPI || isSavingSessionRef.current) return;

    isSavingSessionRef.current = true;
    setIsSavingSession(true);
    try {
      const session: SessionFile = { version: 1, tracks: buildSessionSnapshots(tracks) };
      const json = JSON.stringify(session);

      const result = await window.electronAPI.saveSession(json, defaultSessionFileName());
      if (result.saved && result.filePath) setCurrentSessionPath(result.filePath);
    } finally {
      isSavingSessionRef.current = false;
      setIsSavingSession(false);
    }
  }, [tracks]);

  const isLoadingSessionRef = useRef(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const onLoadSession = useCallback(async () => {
    if (!window.electronAPI || isLoadingSessionRef.current) return;

    isLoadingSessionRef.current = true;
    setIsLoadingSession(true);
    try {
      const result = await window.electronAPI.openSession();
      if (!result.opened) return;

      let parsed: SessionFile;
      try {
        parsed = JSON.parse(result.data) as SessionFile;
      } catch (error) {
        console.error('Failed to parse session file', error);
        return;
      }

      if (parsed.version !== 1) {
        console.error('Unsupported session file version', parsed.version);
        return;
      }

      setCurrentSessionPath(result.filePath);

      const { missing } = await loadSession(parsed.tracks);
      if (missing.length > 0) {
        window.alert(`Some session files could not be found and were skipped:\n${missing.join('\n')}`);
      }
    } finally {
      isLoadingSessionRef.current = false;
      setIsLoadingSession(false);
    }
  }, [loadSession]);

  const onNewSession = useCallback(() => {
    if (tracks.length > 0 && !window.confirm('Start a new session? Unsaved changes will be lost.')) {
      return;
    }
    newSession();
    setCurrentSessionPath(null);
  }, [tracks.length, newSession]);

  const onOrganizeTracks = useCallback(() => {
    const positions = computeGridPositions(tracks.length, window.innerWidth);
    tracks.forEach((track, i) => {
      const pos = positions[i];
      updatePosition(track.state.id, pos.x, pos.y);
    });
  }, [tracks, updatePosition]);

  return {
    tracks,
    onDragOver,
    onDrop,
    onOpenFiles,
    isOpeningFiles,
    stopAll,
    playAll,
    onSaveSession,
    onSaveNewSession,
    isSavingSession,
    onLoadSession,
    isLoadingSession,
    onNewSession,
    onOrganizeTracks,
  };
};
