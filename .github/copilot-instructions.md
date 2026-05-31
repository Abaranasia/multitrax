# Multitrack — Copilot / Agent Instructions

Multitrack is a desktop multi-track audio mixing app.
Stack: **Electron 42 · React 19 · TypeScript 6 · Web Audio API · Vite 8 · pnpm**.

See `ARCHITECTURE.md` for the full reference. This file is the fast-start summary.

---

## Process model

```
Main process  (src/main/main.ts)   — Node.js, dialogs, fs, IPC handlers
Preload       (src/main/preload.ts) — contextBridge → window.electronAPI
Renderer      (src/renderer/)      — React UI + Web Audio API + MediaRecorder
```

`contextIsolation: true`, `nodeIntegration: false`. The renderer talks to Node
only through `window.electronAPI` (typed in `src/renderer/types/electron.d.ts`):
`openAudioFiles()`, `readAudioFile(path)`, `saveRecording(buffer, name)`.

---

## State: two parallel structures

| Location | Type | Purpose |
|---|---|---|
| `AudioContext.tsx` | `TrackEntry[]` in `useState` | React-visible UI state |
| `AudioEngine.ts` | `Map<string, TrackNodes>` | Live audio objects (GainNode, source, buffer…) |

`TrackEntry.state` is a `TrackState` (pure data, no audio objects).  
`TrackNodes` mirrors `TrackState` but also holds `GainNode`, `AudioBufferSourceNode`, `AudioBuffer`, timing numbers, and the `fadeOutTimer`.

**Sync:** action callbacks in `AudioContext.tsx` call the engine then update React state immediately. `Canvas.tsx` runs `setInterval(tickCurrentTimes, 100)` to pull `currentTime` / `isPlaying` from the engine.

---

## AudioEngine — critical invariants

- **One `AudioBufferSourceNode` per play** — Web Audio spec; nodes cannot be restarted.
- **One `GainNode` per track** — persists across plays; carries all gain automations.
- `FADE_DURATION = 5 s` (play/stop/loop fades), `SEEK_FADE_DURATION = 2 s` (seek cross-fade).
- When `track.loop && (track.fadeIn || track.fadeOut)`: `_playLoopWithFade()` is called instead of normal play. It forces `source.loop = false` and reschedules gain automations in `source.onended` on every cycle.
- `_cancelFadeOut(track)` clears `fadeOutTimer`, stops the source, restores gain. Call this before any seek or new play.
- `getCurrentTime(id)` = `startOffset + (ctx.currentTime - startedAt)`, wrapped with `% duration` if looping.

---

## Component tree

```
AudioProvider (AudioContext.tsx)
└── Canvas (Canvas.tsx)          — drop target, tickCurrentTimes interval
    ├── TrackPlayer × N          — draggable card, progress bar, per-track controls
    └── RecorderBar              — MediaRecorder → WAV pipeline
```

---

## Adding a new per-track feature (checklist)

1. Add field to `TrackState` (`src/renderer/domain/TrackState.ts`)
2. Add field + logic to `TrackNodes` in `AudioEngine.ts`; add a `setXxx` method
3. Add `setXxx` callback to the context interface and provider in `AudioContext.tsx`; initialise in `addTracks`
4. Add toggle / control to `TrackPlayer.tsx`; wire to context
5. Add CSS for any new toggle variant in `TrackPlayer.css`

---

## Adding a new IPC call (checklist)

1. Add `ipcMain.handle('namespace:action', handler)` in `src/main/main.ts`
2. Expose it in `src/main/preload.ts` via `contextBridge`
3. Declare it in `src/renderer/types/electron.d.ts`
4. Call `window.electronAPI.xxx()` from the renderer

---

## Recording pipeline (summary)

`engine.getRecordingStream()` → `MediaRecorder` (webm/opus) → chunks →
`decodeAudioData` → `AudioBuffer` → `encodeWav` (16-bit PCM) → `saveRecording`.  
Encoder: `src/renderer/utils/encodeWav.ts`.

---

## Build commands

```bash
pnpm dev          # build main+preload → patch gsettings → Vite HMR + Electron
pnpm build        # full production build (Vite + tsc)
pnpm pack         # electron-builder → release/ (AppImage/dmg/nsis)
pnpm build:main   # recompile only main+preload (tsc)
pnpm build:renderer  # Vite build only
```

Renderer root: `src/renderer/`, output: `dist/renderer/`.  
Main/preload output: `dist/main/`.

---

## Things to watch out for

- Never call `source.start()` twice on the same `AudioBufferSourceNode` — always create a new one.
- Never skip `_cancelFadeOut(track)` before manipulating `startOffset` or creating a new source — it may be mid-fade with an active timer.
- `track.gainNode.gain.cancelScheduledValues(now)` must precede any new gain automation to avoid stale scheduled events corrupting the ramp.
- When modifying `seek()`: check both the instant-seek path AND the seek-fade timeout callback. Both need to route to `_playLoopWithFade` when `track.loop && (track.fadeIn || track.fadeOut)`.
- The `Canvas` polling interval (100 ms) means `currentTime` lags up to 100 ms. Do not rely on exact timing from React state — query `engine.getCurrentTime` directly when precision matters.
- `scripts/patch-gsettings.mjs` is Linux-only boilerplate; do not remove it — Electron crashes on GNOME 46+ without it.
