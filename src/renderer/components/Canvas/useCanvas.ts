import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/useAudio';

const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm']);

function isKnownAudio(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTS.has(ext);
}

export const useCanvas = () => {
  const { tracks, addTracks, tickCurrentTimes, stopAll, playAll } = useAudio();

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

  return {
    tracks,
    onDragOver,
    onDrop,
    onOpenFiles,
    isOpeningFiles,
    stopAll,
    playAll,
  };
};
