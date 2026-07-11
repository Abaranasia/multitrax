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

## [2026-07-11] — Reverb: settings UI (button + dialog, not yet wired)

**Files:** `src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer/useTrackPlayer.ts`,
`src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`,
`doc/TODO-effects.md`

- Decided the reverb parameter set (5 controls): Room preset, Wet/Dry mix,
  Pre-delay, Damping, Output level. Documented in `doc/TODO-effects.md` along
  with a deferred alternative (algorithmic IR generation for continuous
  Room Size / Decay Time sliders).
- Added a 🎛️ "Reverb settings" button to the track controls row (before the
  ⚙ fade-duration button), opening a settings overlay with the 5 controls,
  following the existing Apply/Cancel draft pattern.
- The reverb panel has more rows than the fade-duration panel, so
  `.track-player--reverb-open` grows the card's `min-height` while the
  overlay is open to avoid clipping.
- At this point the dialog only held local component state — no audio engine
  wiring yet.

---

## [2026-07-11] — Reverb: audio chain wiring

**Files:** `src/renderer/domain/TrackState.ts`, `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`, `src/renderer/components/TrackPlayer/useTrackPlayer.ts`,
`src/__tests__/audio/AudioEngine.test.ts`, `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`

- Decided to keep reverb (and future effects) as **per-track inserts** rather
  than a shared "effects rack" with a visual patchbay — reuses the existing
  `TrackState` + `TrackNodes` + `AudioEngine` setter pattern instead of adding
  a routing graph and cable-drag UI. Recorded in `doc/TODO-effects.md`,
  along with a follow-up TODO for a future shared reverb send/return bus
  (more CPU-efficient and closer to how real consoles route reverb).
- Added `reverbRoom`, `reverbMix`, `reverbPreDelay`, `reverbDamping`,
  `reverbOutput` to `TrackState` (new `ReverbRoom` union type: `small-room` |
  `hall` | `plate` | `cathedral`). Default `reverbMix: 0` so new tracks are
  fully dry until the user opts in.
- `AudioEngine.ts`: each track's `GainNode` now feeds a per-track reverb
  insert instead of connecting directly to `masterGain`:
  `gainNode → [dryGain │ preDelay → convolver → damping(lowpass) → wetGain] → outputGain → masterGain`.
  `dryGain`/`wetGain` crossfade the mix, `preDelay` is a `DelayNode` (0–500 ms),
  `damping` is a `BiquadFilterNode` mapping 0–100% to a 20000–500 Hz lowpass
  cutoff, `outputGain` trims the combined signal.
- No real IR audio files are bundled, so each room preset's impulse response
  is synthesised on demand (`_getImpulseResponse`): exponential-decay-shaped
  noise, one `AudioBuffer` per preset duration/decay pair (Small Room 0.4 s,
  Hall 2.2 s, Plate 1.4 s, Cathedral 4.5 s). Buffers are cached per room and
  safely shared across every track's `ConvolverNode` since they're read-only
  data.
- Added `AudioEngine.setReverbSettings(id, room, mix, preDelay, damping, output)`
  and the matching `AudioContext` callback, wired through
  `useTrackPlayer`'s existing Apply/Cancel draft flow (same shape as
  `setFadeDurations`).
- Updated `AudioEngine.test.ts`'s `FakeAudioContext` fixture with fakes for
  `createDelay`/`createConvolver`/`createBiquadFilter`/`createBuffer` so the
  existing unit tests keep working now that `addTrack` builds the reverb
  subgraph; added a smoke test for `setReverbSettings`.
- Verified end-to-end in-browser: dropped a synthetic WAV, changed all 5
  reverb controls, applied, and confirmed playback still runs with no
  console errors; instrumented `AudioContext.prototype` factory methods to
  confirm `addTrack` creates exactly the expected node graph
  (`gainNode`, `dryGain`, `preDelay`, `convolver`, `damping`, `wetGain`,
  `outputGain`).
