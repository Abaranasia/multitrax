# Multitrack — Development Log

Chronological record of all changes made to the project.
Append a new entry at the bottom whenever a feature, fix, or refactor is completed.

Format: `## [date] — short title` followed by bullet points describing what changed and why.

---

## [2026-05-30] — Initial project state (baseline)

The project already existed with the following features before the logged session began:

- Electron 42 + React 19 + TypeScript 6 + Web Audio API + Vite 8 + pnpm stack.
- `AudioEngine.ts`: per-track `GainNode` + `AudioBufferSourceNode`; play, pause,
  stop, seek (instant), volume, loop, fade-in on play, fade-out on pause/stop.
  `FADE_DURATION = 5 s` constant applied to all tracks globally.
- `AudioContext.tsx`: React context wrapping the engine; `TrackEntry[]` state;
  `tickCurrentTimes` polled every 100 ms from `Canvas`.
- `Canvas.tsx`: free-form drag-and-drop canvas; OS drag-and-drop + file dialog.
- `TrackPlayer.tsx`: draggable card with play/pause/stop, progress bar (click to
  seek), volume slider, loop / fade-in / fade-out toggles labelled LOOP / FADE IN /
  FADE OUT.
- `RecorderBar.tsx`: `MediaRecorder` capturing master gain stream; saves as WebM.
- `main.ts`: IPC handlers for open-file dialog, file read, save-recording dialog.

---

## [2026-05-30] — WAV recording export

**Files:** `src/renderer/utils/encodeWav.ts` (new),
`src/renderer/components/RecorderBar.tsx`, `src/main/main.ts`

- Added `encodeWav(audioBuffer: AudioBuffer): ArrayBuffer` utility that writes a
  standard RIFF/WAVE header followed by interleaved 16-bit little-endian PCM
  samples for all channels.
- In `RecorderBar.onstop`: the compressed WebM blob is now decoded with
  `AudioContext.decodeAudioData`, then re-encoded as WAV via `encodeWav`, and
  saved with a `.wav` filename. The `MediaRecorder` still records internally in
  WebM/Opus (browser requirement) but the file the user receives is lossless PCM.
- Updated the save dialog filter in `main.ts` from "WebM Audio" to "WAV Audio".

---

## [2026-05-30] — Seek fade (cross-fade on progress bar click)

**Files:** `src/renderer/domain/TrackState.ts`,
`src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/TrackPlayer.tsx`

- Added `seekFade: boolean` to `TrackState` and `TrackNodes`.
- Added `SEEK_FADE_DURATION = 2 s` constant in `AudioEngine.ts`.
- New seek-with-cross-fade path in `AudioEngine.seek()`: when `track.seekFade` is
  true and the track is playing, a 2 s gain ramp to zero is scheduled; a
  `setTimeout` then stops the source, moves `startOffset`, and starts a new source
  with a 2 s fade-in.  Routes to `_playLoopWithFade` when loop + fades are active.
- Added `setSeekFade` method and callback through the full stack.
- All toggle labels shortened to single letters (**L / I / O / S**) to keep the
  controls row on one line; full descriptions moved to `title` tooltips.
- New **S** (seek fade) toggle added to the controls row.

---

## [2026-05-30] — Loop with per-cycle fade-in / fade-out

**Files:** `src/renderer/audio/AudioEngine.ts`

- The native `source.loop = true` cannot fire JavaScript callbacks at loop
  boundaries, making it impossible to re-apply gain automations on each cycle.
- Added `_playLoopWithFade(track)` private method that forces `source.loop = false`
  and manages cycling manually via `source.onended`.
- Each loop iteration schedules a sample-accurate gain envelope:
  - **Fade-in + Fade-out**: ramp 0→volume over fade-in duration, hold, then
    ramp volume→0 starting `fadeOutDuration` seconds before the buffer end.
  - **Fade-in only**: ramp up at start, hold at volume.
  - **Fade-out only**: hold at volume, ramp down before end.
  - For buffers shorter than 2× the fade duration the two ramps meet at the
    midpoint (V-shape) so no silence gap occurs.
- `play()` routes to `_playLoopWithFade` when `track.loop && (track.fadeIn ||
  track.fadeOut)`.  The seek-fade timeout callback does the same.
- The gain reaches exactly zero at the loop boundary, masking any audible artefact
  from the source-node switch.

---

## [2026-05-30] — Colour-coded toggle buttons

**Files:** `src/renderer/components/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer.css`

- Added modifier classes to each toggle `<label>`: `toggle--loop`,
  `toggle--fade-in`, `toggle--fade-out`, `toggle--seek-fade`.
- Added per-variant CSS overrides so each toggle lights up in its own accent colour
  when active:
  - **Loop** — purple `#a855f7` (unchanged from original)
  - **Fade In** — cyan `#06b6d4`
  - **Fade Out** — orange `#f97316`
  - **Seek Fade** — green `#22c55e`
- Inactive state is identical for all four (dark track, grey thumb).

---

## [2026-05-30] — Architecture documentation

**Files:** `ARCHITECTURE.md` (new, project root),
`.github/copilot-instructions.md` (new)

- Created `ARCHITECTURE.md` as the full technical reference: process model, IPC
  surface, component tree, dual-state design, audio graph topology, all playback
  modes, recording pipeline, build system, file map, and design decisions.
- Created `.github/copilot-instructions.md` as a compact AI agent context
  automatically loaded by VS Code Copilot into every conversation.  Contains
  critical invariants, the two extension checklists (new per-track feature, new
  IPC call), and a "Things to watch out for" section covering common pitfalls.

---

## [2026-05-30] — Per-track fade duration settings

**Files:** `src/renderer/domain/TrackState.ts`,
`src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer.css`

- Added `fadeInDuration`, `fadeOutDuration`, `seekFadeDuration` (all `number`,
  0–10 s) to `TrackState` and `TrackNodes`.  Defaults: 5 s / 5 s / 2 s.
- Removed all uses of the global `FADE_DURATION` and `SEEK_FADE_DURATION`
  constants throughout `AudioEngine.ts`; replaced with per-track values in every
  gain ramp, `setTimeout`, and `_playLoopWithFade` call.
- Added `setFadeDurations(id, fadeIn, fadeOut, seekFade)` method to `AudioEngine`
  with 0–10 clamping; wired through `AudioContext` as a `useCallback`.
- Added ⚙ gear button at the end of the controls row in `TrackPlayer`.
- Clicking ⚙ opens an in-card settings overlay (dark backdrop, `position:
  absolute; inset: 0`) containing three range sliders (min 0, max 10, step 0.5)
  pre-loaded with the track's current values.  **Apply** commits; **Cancel** or
  clicking the backdrop discards the draft.
- Toggle tooltips on I / O / S now dynamically show the configured duration
  (e.g. "Enable 3s fade in on play").

---

## [2026-05-30] — Audio effects reference + TODO

**Files:** `doc/TODO-effects.md` (new)

- Discussed the full set of audio effects achievable with the Web Audio API.
- Created `doc/TODO-effects.md` with a checkable list of all planned effects
  split into two sections: native Web Audio nodes and AudioWorklet-based effects.
- No code changes; serves as a roadmap for future development.

---

## [2026-05-30] — Human-readable docs in doc/ folder

**Files:** `doc/ARCHITECTURE.md` (new), `doc/DEVLOG.md` (this file, new)

- Created `doc/ARCHITECTURE.md`: a narrative, jargon-light explanation of how the
  app works for human readers — covers the three Electron layers, the audio graph
  metaphor, each playback mode in plain English, how state is bridged between React
  and the audio engine, how recording works, and how files are loaded.
- Created `doc/DEVLOG.md` (this file): chronological development log seeded with
  all changes made during this session; to be updated with each future change.

---

## [2026-07-11] — Dashboard "Stop All" button

**Files:** `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/renderer/components/Canvas/Canvas.css`

- Added `AudioEngine.stopAll()`: iterates every track id and calls the existing
  per-track `stop(id)`, reusing its fade-out/reset behaviour rather than
  duplicating it.
- Added `stopAll` action to `AudioContext`: calls `engine.stopAll()` then syncs
  `playing: false, currentTime: 0` across every track in `TrackEntry[]` state
  in a single `setTracks` pass.
- Threaded `stopAll` through `useCanvas` and added a "⏹ Stop All" button in
  `Canvas.tsx`, next to "+ Open Files". Disabled via
  `!tracks.some(t => t.state.playing)` when nothing is playing.
- Styled `.btn-stop-all` in `Canvas.css` to match `.btn-open`'s look or
  positioning (fixed bottom-right, to the left of "+ Open Files"), using a
  neutral colour instead of the accent red.
- Added tests: `AudioEngine.test.ts` (stop two playing tracks via `stopAll`,
  assert both stopped and reset), `Canvas.test.tsx` (button disabled with no
  playing tracks, calls `stopAll` when enabled).
