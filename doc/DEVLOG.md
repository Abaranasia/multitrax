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

---

## [2026-07-11] — Dashboard "Play All" button

**Files:** `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/renderer/components/Canvas/Canvas.css`

- Added `AudioEngine.playAll()`: mirrors `stopAll()`, iterating every track id
  and calling the existing per-track `play(id)`, which already no-ops on
  tracks that are already playing.
- Added `playAll` action to `AudioContext`: calls `engine.playAll()` then sets
  `playing: true` across every track in `TrackEntry[]` state in a single
  `setTracks` pass (no `currentTime` reset — playback resumes from each
  track's existing offset, unlike `stopAll`).
- Threaded `playAll` through `useCanvas` and added a "▶ Play All" button in
  `Canvas.tsx`, next to "⏹ Stop All". Disabled when there are no tracks, or
  when every track is already playing.
- Styled `.btn-play-all` in `Canvas.css` matching `.btn-stop-all`'s layout,
  positioned further left, using a green accent instead of the stop button's
  neutral colour.
- Added tests: `AudioEngine.test.ts` (`playAll` starts every track playing),
  `Canvas.test.tsx` (button disabled with no tracks or all tracks playing,
  calls `playAll` when enabled).
- Checked off the "Play All button" item in `doc/TODO.md`.

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

---

## [2026-07-11] — Delay/Echo: insert effect (audio chain + settings UI)

**Files:** `src/renderer/domain/TrackState.ts`, `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`, `src/renderer/components/TrackPlayer/useTrackPlayer.ts`,
`src/renderer/components/TrackPlayer/TrackPlayer.tsx`, `src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/audio/AudioEngine.test.ts`, `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`,
`doc/TODO-effects.md`

- Added a per-track delay/echo insert, following the same pattern established
  for reverb: `TrackState` fields + `AudioEngine` setter + settings-overlay
  draft/Apply/Cancel UI. Delivered UI and audio wiring together in one pass
  this time, since the pattern is now well-established.
- Placed **before** reverb in the signal chain, per the standard mixing
  convention (delay first, then let the reverb tail wash over the repeats):
  `gainNode → delay insert → reverb insert → masterGain`. `addTrack` now
  wires `gainNode` into the delay's entry points and the delay's
  `outputGain` into reverb's entry points (previously `gainNode` fed reverb
  directly).
- Delay uses a feedback `DelayNode` topology: dry/wet split around the delay
  line, with `delayNode → feedbackGain → damping (lowpass) → delayNode`
  closing the loop. Legal per the Web Audio cycle rule (the loop contains a
  `DelayNode` with non-zero delay — MDN's own feedback-delay example uses
  the identical shape). Feedback is clamped to 0–90% (`DELAY_FEEDBACK_MAX`)
  to keep the loop gain under 1.0 and guarantee decaying repeats; delay time
  is clamped to 1–2000 ms (`DELAY_TIME_MAX_MS`) with a 1 ms floor (not 0)
  specifically because this node sits inside a cycle, unlike reverb's
  `preDelay` which doesn't.
- The tone/damping filter sits *inside* the feedback loop (not once on the
  wet tail like reverb's), so each successive repeat gets progressively
  darker — the classic tape-echo character. Reused the existing
  `DAMPING_MIN_HZ`/`DAMPING_MAX_HZ` constants for the mapping instead of
  duplicating them, since they were already named generically.
- Added `delayTime`, `delayFeedback`, `delayMix`, `delayDamping`,
  `delayOutput` to `TrackState`; `delayMix: 0` default keeps new tracks dry
  until opted in, same convention as reverb.
- Added a delay settings button (`·•●` — three Unicode circles growing
  left-to-right, U+00B7/U+2022/U+25CF — amber `#f59e0b` accent) to the
  controls row, positioned before the reverb button (mirroring signal-chain
  order); overlay/panel follow the identical Apply/Cancel draft pattern as
  reverb and fade-durations, but with 5 sliders and no dropdown.
- `AudioEngine.test.ts`: no new fake node classes needed — `FakeGain`,
  `FakeDelay`, and `FakeBiquadFilter` were already exercised by the reverb
  subgraph and are fully reused; added a `setDelaySettings` smoke test.
- `TrackPlayer.test.tsx`: added Apply/Cancel tests for the delay panel
  mirroring the reverb tests (5 range inputs, no dropdown).
- Verified end-to-end in-browser: instrumented `AudioContext.prototype` to
  confirm `addTrack` now creates the delay subgraph (6 nodes) before the
  reverb subgraph (6 nodes), in the right order; changed all 5 delay
  controls, applied, and confirmed playback still runs with no console
  errors; visually confirmed the `·•●` icon renders as three clean,
  distinctly-sized growing circles.

---

## [2026-07-12] — Clone track (right-click context menu)

**Files:** `src/renderer/audio/AudioEngine.ts`, `src/renderer/context/AudioContext.tsx`,
`src/renderer/components/TrackPlayer/TrackContextMenu.tsx` (new),
`src/renderer/components/TrackPlayer/TrackContextMenu.css` (new),
`src/renderer/components/TrackPlayer/useTrackContextMenu.ts` (new),
`src/renderer/components/TrackPlayer/useTrackPlayer.ts`, `src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/__tests__/audio/AudioEngine.test.ts`, `src/__tests__/context/AudioContext.test.tsx`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`,
`src/__tests__/components/TrackPlayer/TrackContextMenu.test.tsx` (new), `doc/TODO.md`

- Added `AudioEngine.getBuffer(id)`, a small accessor returning a track's
  decoded `AudioBuffer` by reference. An `AudioBuffer` is just decoded PCM
  data, safe to share across tracks (the same principle already used for
  cached reverb impulse responses), so cloning never re-decodes or re-reads
  the source wav file — it hands the same buffer object to a new
  `AudioEngine.addTrack` call.
- Added `AudioContext.duplicateTrack(id)`: looks up the source `TrackEntry`,
  calls `engine.addTrack(newId, sourceBuffer)`, then re-applies the source's
  delay/reverb/volume/loop settings through the existing per-track setters
  (`addTrack` always builds a fresh, default-parameter node graph, so the
  clone's effects only match once these are replayed). Builds a new
  `TrackState` copying every field except `id` (fresh `crypto.randomUUID()`),
  `currentTime` (reset to 0) and `playing` (reset to false); title gets a
  " copy" suffix. The new `TrackEntry` keeps the source's `filePath` and is
  placed offset `+20/+20` from the source card, mirroring the existing
  `nextPos` offset used when adding tracks.
- No context-menu component existed anywhere in the codebase yet, so built
  one from scratch as its own component + hook, per the `ARCHITECTURE.md`
  "dialogs and overlays are independent components" convention:
  `TrackContextMenu.tsx` (menu shell, `position: fixed` at the click
  coordinates so it isn't clipped by the track card's `overflow: hidden`)
  and `useTrackContextMenu.ts` (open/close state, closes on outside
  mousedown or Escape). Wired into `TrackPlayer.tsx` via a new
  `onContextMenu` handler on the card root, alongside the existing fade/delay/
  reverb overlays.
- Added tests: `AudioEngine.test.ts` (`getBuffer` returns the same reference
  passed to `addTrack`, `undefined` for an unknown id), `AudioContext.test.tsx`
  (`duplicateTrack` reuses the same buffer, copies settings, resets
  transient state), `TrackContextMenu.test.tsx` (renders at the given
  coordinates, calls `onDuplicate` on click), and `TrackPlayer.test.tsx`
  (right-click opens the menu and Duplicate triggers it end-to-end; clicking
  outside closes it).
- Hit one mock-related snag while writing the `AudioContext`/`TrackPlayer`
  test mocks: `getBuffer: vi.fn().mockReturnValue(...)` gets silently wiped
  by the existing `vi.restoreAllMocks()` in `beforeEach` (which behaves like
  `mockReset()` for a bare `vi.fn()`, unlike an implementation passed
  directly to the `vi.fn(impl)` constructor, which survives). Fixed by
  defining `getBuffer` with its implementation passed straight into `vi.fn()`,
  matching the existing `decodeAudioData` mock's pattern.
- Verified end-to-end in-browser: dropped a synthetic WAV, right-clicked the
  card, clicked Duplicate — a "… copy" card appeared offset on the canvas
  with the same duration; changed the original's delay mix to 75% and
  duplicated again, confirming the new clone's delay panel showed identical
  values while the earlier clone (made before the change) was unaffected.
- Checked off the "Clone track" item in `doc/TODO.md`.

---

## [2026-07-12] — Filter: sweepable insert effect (audio chain + settings UI)

**Files:** `src/renderer/domain/TrackState.ts`, `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/TrackPlayer/FilterSettingsDialog.tsx` (new),
`src/renderer/components/TrackPlayer/FilterSettingsDialog.css` (new),
`src/renderer/components/TrackPlayer/useFilterSettingsDialog.ts` (new),
`src/renderer/components/TrackPlayer/TrackPlayer.tsx`, `src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/audio/AudioEngine.test.ts`, `src/__tests__/context/AudioContext.test.tsx`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`,
`src/__tests__/components/TrackPlayer/FilterSettingsDialog.test.tsx` (new), `doc/TODO.md`

- Added a per-track sweepable filter insert — a single `BiquadFilterNode`
  (lowpass/highpass/bandpass, cutoff, resonance/Q, mix, output), distinct
  from the still-unbuilt multi-band Equalizer item. Same 5-field shape as
  Reverb (type dropdown + 3 shaping params + mix + output) and the same
  dry/wet-insert topology, minus a feedback loop (not needed for a plain
  filter): `dryGain ─┐; biquadFilter → wetGain ┴→ outputGain`.
- Placed **before** delay/reverb in the signal chain, per the user's
  request and standard tone-shaping-first mixing convention:
  `gainNode → filter insert → delay insert → reverb insert → masterGain`.
  `addTrack` now builds `filter` first and rewires `gainNode` into the
  filter's entry points, with the filter's `outputGain` feeding into delay's
  entry points (previously `gainNode` fed delay directly).
- Added `filterType`, `filterCutoff` (20–20000 Hz), `filterResonance`
  (0.1–20 Q), `filterMix`, `filterOutput` to `TrackState`; new `FilterType`
  union (`lowpass` | `highpass` | `bandpass`), same shape as `ReverbRoom`.
  `filterMix: 0` default keeps new tracks dry until opted in, same
  convention as delay/reverb — and reuses the identical `mix > 0` check for
  the toggle button's active state.
- `AudioEngine.setFilterSettings` assigns `biquadFilter.type` directly
  (not an `AudioParam`, so it switches instantly — same as reverb's instant
  `convolver.buffer` swap on room change) and ramps `frequency`/`Q`/dry-wet/
  output via `setTargetAtTime`, same as every other insert's setter.
- This is the first effect built as an independent component from the
  start, per the user's explicit request to follow
  `doc/ARCHITECTURE.md`'s dialogs/overlays convention rather than adding to
  the inline Delay/Reverb panels (a known, already-flagged debt item in
  `doc/TODO.md`): `FilterSettingsDialog.tsx` (presentational overlay,
  fully controlled by props) + `useFilterSettingsDialog.ts` (a
  self-contained hook taking the track's `TrackState`, calling `useAudio()`
  itself for `setFilterSettings`, owning open/close + all 5 draft values).
  `TrackPlayer.tsx` calls the hook directly alongside `useTrackPlayer(...)`
  — `useTrackPlayer.ts` needed zero changes for this feature, unlike every
  prior effect.
- Added a "F" button (`btn-filter`) to the effects row, positioned
  **before** Delay ("F", "D", "R" — matching signal-chain order); extended
  the shared `.btn-delay, .btn-reverb` CSS selectors to include `.btn-filter`
  rather than duplicating the button styling. Filter's own dialog panel
  uses a blue accent, distinct from delay's amber and reverb's teal.
- Updated `duplicateTrack` (from the clone-track feature) to also call
  `engine.setFilterSettings` with the source's filter settings — otherwise
  clones would have silently dropped their filter settings.
- Hit one fixture gap while testing: `AudioEngine.test.ts`'s
  `FakeBiquadFilter` only had a `frequency` `AudioParam` (all it needed for
  delay/reverb's damping filters) — no `Q`. Added a `Q` fake param so
  `setFilterSettings` doesn't throw against the fake audio context.
- Added tests: `AudioEngine.test.ts` (`setFilterSettings` smoke test),
  `AudioContext.test.tsx` (extended the `duplicateTrack` test to assert
  `setFilterSettings` is called with the source's filter values),
  `TrackPlayer.test.tsx` (Apply/Cancel tests for the filter panel mirroring
  the delay/reverb tests, plus an active-button-state test), and a new
  `FilterSettingsDialog.test.tsx` unit-testing the presentational component
  in isolation (renders draft values, calls the setters/`onApply`/`onCancel`,
  backdrop click cancels but panel click doesn't).
- Verified end-to-end in-browser: dropped a synthetic WAV, opened the
  Filter panel via the new "F" button (confirmed it renders before "D"/"R"),
  switched type to highpass with cutoff 500Hz and mix 70%, applied, and
  confirmed the button lit up with no console errors; duplicated the track
  and confirmed the clone's Filter panel showed the identical
  highpass/500Hz/70% values.
- Checked off the "Filter" item in `doc/TODO.md`, and added a note pointing
  to `FilterSettingsDialog`/`useFilterSettingsDialog` as the concrete
  template for the pending fade/delay/reverb panel extraction.

---

## [2026-07-12] — Stereo Pan (always-on control, not an effect dialog)

**Files:** `src/renderer/domain/TrackState.ts`, `src/renderer/audio/AudioEngine.ts`,
`src/renderer/context/AudioContext.tsx`, `src/renderer/components/TrackPlayer/useTrackPlayer.ts`,
`src/renderer/components/TrackPlayer/TrackPlayer.tsx`, `src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/audio/AudioEngine.test.ts`, `src/__tests__/context/AudioContext.test.tsx`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`, `doc/TODO.md`

- Added a per-track `StereoPannerNode` — a single-parameter node (`.pan`,
  -1 to 1), unlike the Delay/Reverb inserts this needs no dry/wet split or
  sub-graph. Per `doc/TODO.md`'s own note ("drop-in before `masterGain`"),
  it's the **last** stage of the per-track chain: `gainNode → delay →
  reverb → pannerNode → masterGain`.
- `_createReverbNodes()` used to connect its `outputGain` straight to
  `masterGain` internally (reverb was previously the last stage). That
  connection moved to `addTrack`, mirroring how the delay insert's
  `outputGain` was already left deliberately unconnected for the caller to
  wire onward — reverb's `outputGain` now does the same, feeding into the
  new `pannerNode`.
- Added `pan: number` to `TrackState` (0 = center, default for new tracks)
  and `AudioEngine.setPan(id, value)`, clamping to [-1, 1] and ramping via
  `setTargetAtTime` — same shape as `setVolume`.
- Unlike every effect built so far (Delay, Reverb — both opt-in, behind a
  settings button + draft/Apply/Cancel dialog), pan is a core, always-on
  mixing control per the user's explicit request: a plain
  `<input type="range" min={-1} max={1}>` rendered directly in the card
  body, applied live on every `onChange` exactly like the existing Volume
  slider — no dialog, no draft state, no `useTrackPlayer.ts` settings-open
  boilerplate needed.
- Positioned the pan row directly **above** Volume in `TrackPlayer.tsx`,
  with `L`/`R` labels at the two range extremes (matching the Volume row's
  icon-plus-label layout convention) and a tooltip mirroring Volume's
  (`"Pan: Center"` / `"35% Left"` / `"70% Right"`). Reused Volume's red
  accent (`#e94560`) on the slider thumb since pan is a core control, not a
  colour-coded "effect" like Delay/Reverb.
- Bumped `.track-controls`'s row gap (8px → 10px) to give the card a touch
  more breathing room for the extra row — the card has no fixed height
  (grows with content), so no hard height override was needed.
- Updated `duplicateTrack` to also call `engine.setPan` with the source's
  pan value — it's a persistent per-track setting like volume, so it's
  copied on clone rather than reset like `currentTime`/`playing`.
- Added tests: `AudioEngine.test.ts` (`createStereoPanner`/`FakePanner`
  added to the `FakeAudioContext` fixture; a `setPan` smoke test),
  `AudioContext.test.tsx` (extended the `duplicateTrack` test to assert
  `setPan` is called with the source's pan), `TrackPlayer.test.tsx` (pan
  slider renders centered by default with the right min/max, appears before
  the volume control in document order, and calls `engine.setPan` on
  change).
- Verified end-to-end in-browser: dropped a synthetic WAV, confirmed the
  pan slider renders above Volume labelled "Pan: Center"; dragged it to
  75% left and confirmed the tooltip updated with no console errors;
  duplicated the panned track and confirmed the clone's pan slider showed
  the identical -0.75 (75% Left) position.
- Checked off the "Stereo Pan" item in `doc/TODO.md`.

---

## [2026-07-12] — Pan slider: double-click to recenter

**Files:** `src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`, `doc/TODO.md`

- Added an `onDoubleClick={() => setPan(state.id, 0)}` handler to the pan
  slider, so double-clicking anywhere on the fader snaps it back to center
  (0%) — a common convention for pan controls (avoids having to drag back
  to the exact midpoint by hand).
- Added a `TrackPlayer.test.tsx` test: renders with `pan: -0.6`, fires a
  double-click on the pan input, asserts `engine.setPan` is called with 0.
- Verified end-to-end in-browser: set the pan slider to 80% right, then
  dispatched a `dblclick` on it and confirmed it reset to `Pan: Center`
  with no console errors.
- Noted the shortcut in the "Stereo Pan" entry in `doc/TODO.md`.

---

## [2026-07-17] — TrackPlayer UI rework

**Files:** `src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`

- Refined the waveform preview so it fills the track-card shell cleanly and
  renders the bars with the correct sizing and alignment inside the container.
- Replaced the checkbox-style toggle controls with compact button-styled
  actions, using clearer active-state accents for loop, fade-in, fade-out, and
  seek-fade behavior.
- Grouped the per-track controls on the right side of the card, and unified the
  settings button styling so it matches the other compact actions.
- Updated the visible track title to show only the file name while preserving the
  full path in the tooltip for quick context.
- Restyled the volume slider with a stronger accent fill and thumb treatment to
  make the current level easier to read at a glance.
- Updated the TrackPlayer regression tests to cover the new button controls and
  the shortened title presentation.

---

## [2026-07-19] — TrackPlayer pan control visual polish

**Files:** `src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`

- Refined the pan slider so its progress bar now uses a directional gradient when
  the control is offset from center, matching the refreshed volume control styling.
- Kept the centered state visually neutral while making left/right offsets feel
  more intentional and consistent with the rest of the TrackPlayer UI rework.
- Added regression coverage to ensure the pan slider exposes the new gradient
  background styling when it is moved away from the center position.
---

## [2026-08-02] — Reveal a track's source file in the OS file manager

**Files:** `src/main/main.ts`, `src/main/preload.ts`,
`src/renderer/types/electron.d.ts`,
`src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/renderer/components/TrackPlayer/TrackPlayer.tsx`,
`src/renderer/components/TrackPlayer/useTrackPlayer.ts`,
`src/renderer/components/TrackPlayer/components/contextMenu/TrackContextMenu.tsx`,
`src/renderer/components/TrackPlayer/components/contextMenu/TrackContextMenu.css`,
`src/__tests__/test-utils/mockElectronAPI.ts` (new), plus the main, preload,
Canvas, TrackContextMenu and TrackPlayer test suites

- Added a **Show in Folder** item to the track right-click menu, next to
  Duplicate. It opens the OS file manager with the track's source file selected,
  via a new `shell:revealFile` IPC handler backed by `shell.showItemInFolder`.
- The handler validates that the path is absolute, exists, and is a file, then
  resolves `{ revealed, error? }` instead of rejecting — same contract as
  `dialog:saveRecording`, so the renderer can never hit an unhandled rejection.
- It deliberately does **not** reuse the `grantedPaths` allowlist that guards
  `fs:readAudioFile`. That set is cleared and replaced on every open-file dialog,
  so tracks loaded in an earlier batch would stop being revealable, and dropped
  files never enter it at all. Revealing never reads or executes the file, so the
  exists/is-a-file check is the proportionate gate.
- **Fixed a latent path bug found while implementing this.** `useCanvas.onDrop`
  read `(file as File & { path?: string }).path ?? file.name`, but Electron
  removed `File.path` in v32 and this project runs 42.x — every drag-and-dropped
  track was therefore storing a bare filename instead of a path. Drops now
  resolve the real location through a new `getPathForFile` preload method
  (`webUtils.getPathForFile`), keeping the `file.name` fallback for non-Electron
  hosts. This also unblocks the planned Save / Load session feature, which
  persists file paths.
- `TrackEntry.filePath` is threaded from `Canvas` into `TrackPlayer` as a prop,
  following the precedent already set by `x`/`y`. `useTrackPlayer` exposes
  `reveal` alongside `duplicate`, plus a `canReveal` guard that disables the menu
  item (with an explanatory tooltip) when the track has no usable path.
- Extracted `createMockElectronAPI()` into `src/__tests__/test-utils/`, mirroring
  the existing `createMockAudioEngine()`, so `window.electronAPI` stubs stay
  type-complete as the bridge grows.

---

## [2026-08-03] — Mute by clicking the volume icon

**Files:** `src/renderer/components/TrackPlayer/components/volumeControl/VolumeControl.tsx`,
`src/renderer/components/TrackPlayer/components/volumeControl/useVolumeControl.ts`,
`src/renderer/components/TrackPlayer/TrackPlayer.css`,
`src/__tests__/components/TrackPlayer/VolumeControl.test.tsx`,
`src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx`,
`doc/volume-mute-plan.md` (new), `doc/TODO.md`

- Investigated via `codegraph_explore` and confirmed no `muted` concept existed
  anywhere in `TrackState`, `AudioEngine`, or `AudioContext`. Decided (confirmed
  with the user, recorded in `doc/volume-mute-plan.md`) not to add one: "muted"
  is derived as `volume === 0`, keeping the whole feature inside the
  `VolumeControl`/`useVolumeControl` pair and reusing the existing `setVolume`
  setter untouched.
- `useVolumeControl.ts`: added a `lastVolumeRef` (`useRef`, synced via
  `useEffect` whenever `state.volume > 0`) so the last non-zero volume survives
  both manual slider drags and mute/unmute toggles. Added `isMuted =
  state.volume === 0` and `onToggleMute = () => setVolume(id, isMuted ?
  lastVolumeRef.current : 0)`.
- `VolumeControl.tsx`: turned the `.volume-icon` from a plain `<span>` into a
  real `<button type="button">` (matching the existing `.btn-close` pattern)
  for keyboard/AT accessibility, wired to `onToggleMute`. Glyph swaps
  🔊 ↔ 🔇 with a "Mute"/"Unmute" `title` and `aria-label`.
- `TrackPlayer.css`: reset default button chrome on `.volume-icon` (background,
  border, padding) and added `cursor: pointer` / `flex-shrink: 0`, mirroring
  how `.btn-close` resets its own button, so the glyph-only look is unchanged.
- Added tests: `VolumeControl.test.tsx` (clicking the icon calls
  `onToggleMute`; renders 🔇/"Unmute" when `isMuted`, 🔊/"Mute" otherwise),
  `TrackPlayer.test.tsx` (end-to-end: clicking the icon at volume 0.6 calls
  `engine.setVolume('track-1', 0)`, clicking again at volume 0 restores 0.6).
- Checked off "Mute by clicking the volume icon" in `doc/TODO.md`, noting the
  derived-state approach and the button/accessibility change.

---

## [2026-08-03] — New Session action + timestamped session filenames

**Files:** `src/renderer/context/AudioContext.tsx`,
`src/renderer/context/audioContextInstance.ts`,
`src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/SessionMenu/SessionMenu.tsx`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/__tests__/context/AudioContext.test.tsx`,
`src/__tests__/components/Canvas/Canvas.test.tsx`,
`src/__tests__/components/SessionMenu/SessionMenu.test.tsx`, `doc/TODO.md`

- Added a "New Session" menu item that clears the dashboard and frees every
  track's audio resources. `AudioContext.tsx`'s new `newSession()` follows the
  exact teardown precedent `loadSession` already established: loop
  `engine.removeTrack(id)` over every current track (disposing the gain,
  filter, delay, reverb, and panner nodes) *before* replacing state with
  `setTracks([])` — a bare `setTracks([])` would otherwise leak the engine's
  internal node map. No blob-URL revocation is needed since tracks load via
  `ArrayBuffer`, never `createObjectURL`.
- `useCanvas.ts`'s `onNewSession` gates the call behind `window.confirm`,
  shown only when `tracks.length > 0` (an empty canvas clears instantly, same
  as `stopAll`), and resets `currentSessionPath` to `null` so a subsequent
  "Save Session" doesn't overwrite the previous file.
- Wired a "New Session" button into `SessionMenu.tsx` (closes the menu on
  click, same as the other items) and threaded `onNewSession` through
  `Canvas.tsx`.
- Changed `defaultSessionFileName()` in `useCanvas.ts` to include hour and
  minute (`session-YYYY-MM-DD_HH-mm.json` instead of `session-YYYY-MM-DD.json`)
  so multiple sessions saved the same day no longer collide/overwrite each
  other by default.
- Added tests for both: `AudioContext.test.tsx` (newSession removes every
  engine track and clears state), `Canvas.test.tsx` (no confirm when the
  canvas is empty, confirm-and-clear, confirm-and-cancel, plus the updated
  filename regex), `SessionMenu.test.tsx` (renders/clicks the new item).
- Checked off "Save / Load session" filename note and added "New Session" to
  `doc/TODO.md`.

---

## [2026-08-03] — Dashboard track-view reorganization (grid Organize button)

**Files:** `src/renderer/utils/canvasLayout.ts` (new),
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/renderer/components/Canvas/Canvas.css`,
`src/renderer/components/SessionMenu/SessionMenu.css`,
`src/__tests__/utils/canvasLayout.test.ts` (new),
`src/__tests__/context/AudioContext.test.tsx`,
`src/__tests__/components/Canvas/Canvas.test.tsx`, `doc/TODO.md`

- New `canvasLayout.ts` util is the single source of truth for track
  placement, shared by both the default cascade and the new grid action:
  `TOP_INSET = 90` / `SIDE_INSET = 20` reserve the top band occupied by the
  `SessionMenu` and `RecorderBar` floating buttons; `TRACK_CARD_WIDTH = 380`
  mirrors `.track-player`'s CSS width; `computeGridPositions(count,
  viewportWidth)` fills a row-major grid using those insets plus a
  `GRID_GAP = 20` and an approximate `TRACK_CARD_HEIGHT = 260` row spacing
  (card height is content-driven, so this is a spacing approximation, not an
  enforced height).
- Added a `⊞ Organize` floating button next to the Session menu
  (`Canvas.tsx`, disabled when there are no tracks). `useCanvas.ts`'s new
  `onOrganizeTracks` computes `computeGridPositions(tracks.length,
  window.innerWidth)` and calls the existing `updatePosition(id, x, y)` once
  per track in array order — organizing is a one-shot snapshot, not a
  persistent layout mode, so tracks stay freely draggable afterward.
- `AudioContext.tsx`'s cascade start for new/duplicated tracks moved from the
  literal `{ x: 20, y: 20 }` — which sat directly under the Session menu
  button — to `{ x: SIDE_INSET, y: TOP_INSET }`, so default (non-organized)
  placement also skips the reserved top band.
- `SessionMenu.css`'s `.session-menu` positioning changed from `fixed;
  top/left: 20px` to `position: relative`, since a new `.top-left-actions`
  flex wrapper in `Canvas.tsx` now owns the fixed top-left placement for both
  the Session menu and the Organize button. `.session-menu-dropdown`'s
  `position: absolute` anchoring is unaffected — `relative` still
  establishes the same positioning context.
- Added tests: `canvasLayout.test.ts` (column/row math, every position stays
  within the reserved insets, single-column wrap, empty case),
  `AudioContext.test.tsx` (first added track lands at `TOP_INSET`/`SIDE_INSET`
  instead of `20`/`20`), `Canvas.test.tsx` (Organize button disabled when
  empty, clicking it calls `updatePosition` per track with the computed grid
  coordinates).
- Checked off "Dashboard track-view reorganization" in `doc/TODO.md`.

---

## [2026-08-03] — Mixer-style vertical track view (View menu + console layout)

**Files:** `src/renderer/components/Canvas/useCanvas.ts`,
`src/renderer/components/Canvas/Canvas.tsx`,
`src/renderer/components/Canvas/Canvas.css`,
`src/renderer/components/ViewMenu/useViewMenu.ts` (new),
`src/renderer/components/ViewMenu/ViewMenu.tsx` (new),
`src/renderer/components/ViewMenu/ViewMenu.css` (new),
`src/renderer/components/MixerView/MixerView.tsx` (new),
`src/renderer/components/MixerView/ChannelStrip.tsx` (new),
`src/renderer/components/MixerView/PanDial.tsx` (new),
`src/renderer/components/MixerView/useChannelStrip.ts` (new),
`src/renderer/components/MixerView/MixerView.css` (new),
`src/renderer/utils/formatDb.ts` (new),
`src/renderer/components/TrackPlayer/components/transportControls/TransportControls.tsx`,
`src/renderer/components/TrackPlayer/components/transportControls/PlaybackButtons.tsx` (new),
`src/renderer/components/TrackPlayer/components/transportControls/TransportToggles.tsx` (new),
`src/renderer/components/TrackPlayer/components/index.ts`,
`src/renderer/components/TrackPlayer/TrackPlayer.css`,
various new/updated tests under `src/__tests__/components/ViewMenu/`,
`src/__tests__/components/MixerView/`, `src/__tests__/utils/formatDb.test.ts`,
`src/__tests__/components/Canvas/Canvas.test.tsx`, `doc/TODO.md`

- Added a second track-display mode — a mixing-console layout — following
  "Option 1C — Rack" from
  `doc/templates/Audio UI modernization project/Multitrack Redesign.dc.html`.
  Shipped as a **visual-only MVP**: reuses only what already existed
  (volume, pan, effects, waveform, transport) and deliberately omits
  Mute/Solo, a live VU meter, and a Master strip, since none of `TrackState`,
  `AudioContext.tsx`, or the audio engine carry the state (mute/solo flags,
  an `AnalyserNode`, or a master bus) those would need — tracked instead as
  three new deferred `doc/TODO.md` entries.
- `useCanvas.ts` gained `viewMode: 'canvas' | 'mixer'` and `switchView()`
  (toggles between the two). `Canvas.tsx` branches its track rendering on
  `viewMode`: the existing free-form `TrackPlayer` card mapping is untouched
  in `'canvas'` mode; `'mixer'` renders the new `<MixerView tracks={tracks}/>`
  instead, iterating `tracks` in array order (ignoring `x`/`y`, which are
  canvas-only).
- The old standalone `⊞ Organize` button was replaced by a `ViewMenu`
  dropdown, mirroring `SessionMenu`/`useSessionMenu`'s open/close pattern
  exactly (`useViewMenu.ts`, same mousedown/Escape auto-close). The menu
  shows `⊞ Organize Tracks` (the pre-existing grid-snap action) only while
  in canvas mode, plus one dynamic item that always names the *other* view
  — `🎚 Switch to Mixer View` / `🖼 Switch to Track View` — so only one
  "switch" target is ever offered at a time.
- `MixerView.tsx` renders one `ChannelStrip` per track in a horizontally
  scrollable `.mixer-rack`. Each `ChannelStrip` composes **existing**
  `TrackPlayer` sub-components rather than reimplementing control logic:
  `WaveformCanvas`, `EffectToggles`, `VolumeControl`, and a new `PanDial`
  (below), plus a derived dB readout (`formatDb.ts`: `20·log10(volume)`,
  `"-∞ dB"` at 0 — pure display math, not stored state).
- `PanDial.tsx` replaces the card view's pan slider **in the mixer view
  only** — the shared `PanControl`/`usePanControl` slider is untouched for
  `TrackPlayer`. It reuses `usePanControl`'s `pan`/`onChange`/`onDoubleClick`
  exactly as-is, rendering a rotating dial face (`±45°` sweep, tick mark via
  `::after`) with a compact `L60`/`Center`/`R60` label; the original range
  input is kept underneath for real drag/keyboard interaction but made
  invisible (`opacity: 0`) and overlaid on the dial.
- `TransportControls.tsx` was split into `PlaybackButtons.tsx` (play/pause +
  stop) and `TransportToggles.tsx` (loop/fade-in/fade-out/seek-fade/settings),
  with `TransportControls` now just composing both — `TrackPlayer.tsx`'s
  card view keeps calling the combined component, so its DOM/CSS/tests are
  unchanged. `ChannelStrip.tsx` uses the two pieces independently: a
  `.mixer-middle-row` puts `TransportToggles` (stacked vertically via
  `flex-direction: column`) to the left of the vertical fader, while
  `PlaybackButtons` stays on its own line below the dB readout — a 150px
  strip can't fit any of these groups in one row without overflowing.
- Fixed several layout bugs found after the first pass: the rotated volume
  `<input type="range">` (`transform: rotate(-90deg)`) doesn't reserve
  layout space for its rotated bounds, so the `%` value sat hidden underneath
  it — fixed by taking the input out of flow (`position: absolute`, centered)
  and pinning `.volume-value` to the bottom of the fader box instead. The
  volume mute icon is hidden in the mixer view (`display: none`, scoped to
  `.mixer-fader`) since a real mute/solo control will replace it later.
  `.mixer-rack`'s padding changed from a flat `18px` to `90px 20px 20px`,
  mirroring `TOP_INSET`/`SIDE_INSET` from `canvasLayout.ts`, so strips start
  below the fixed Session/View button row instead of underneath it.
- Checked off "Mixer-style vertical track view" in `doc/TODO.md` with an
  implementation note, and added three new deferred entries: Mute/Solo
  buttons, a live per-strip VU meter, and a Master strip with master volume
  — each needs `TrackState`/`AudioContext.tsx`/audio-engine changes beyond
  a pure view addition.

---

## [2026-08-03] — Drag-to-reorder channel strips in the mixer view

**Files:** `src/renderer/context/audioContextInstance.ts`,
`src/renderer/context/AudioContext.tsx`,
`src/renderer/components/MixerView/useMixerReorder.ts` (new),
`src/renderer/components/MixerView/MixerView.tsx`,
`src/renderer/components/MixerView/ChannelStrip.tsx`,
`src/renderer/components/MixerView/MixerView.css`,
`src/renderer/components/Canvas/useCanvas.ts`, `src/renderer/components/Canvas/Canvas.tsx`,
`src/__tests__/components/MixerView/useMixerReorder.test.tsx` (new),
`src/__tests__/components/MixerView/MixerView.test.tsx`,
`src/__tests__/components/MixerView/ChannelStrip.test.tsx`,
`src/__tests__/context/AudioContext.test.tsx`, `src/__tests__/components/Canvas/Canvas.test.tsx`

- Channel strips in the mixer view can now be reordered by dragging — a
  live-swap-on-hover model (the row reorders the instant the pointer
  crosses into a neighboring slot, not on drop), matching how a real
  mixing console lets you rearrange channel strips.
- Added `reorderTracks(id, toIndex)` to `AudioContextValue`/`AudioProvider`,
  next to the existing `updatePosition`. `tracks` order was previously only
  ever appended-to or filtered — no mutator moved an item within the array.
  `reorderTracks` splices the matching entry out and back in at the target
  index and is a no-op if the id is missing or already at that index; it
  only ever changes array position, never `x`/`y`, so it has zero effect on
  canvas view or on the free-form card placement.
- New `useMixerReorder.ts` drives the drag interaction with the same manual
  `mousedown` → `window` `mousemove`/`mouseup` pattern already used for
  canvas-card dragging in `useTrackPlayer.ts` — no drag library was added
  (none exists in this repo). On `mousemove` it reads `.mixer-rack`'s
  children (1:1 with `tracks`) via `getBoundingClientRect()` to find which
  strip's horizontal bounds contain the pointer (clamped to the first/last
  slot past either edge), and calls `reorderTracks` as soon as that index
  differs from the dragged track's current one.
- Because `reorderTracks` gives `tracks` a new array reference on every
  live swap, the long-lived `mousemove` listener can't just close over
  `tracks`/`draggingId` from drag-start — it would keep computing target
  indices against a stale order. Both are read through refs
  (`tracksRef`/`draggingIdRef`) kept in sync via a `useEffect`, not written
  directly during render.
- `ChannelStrip.tsx` gained a `.mixer-strip-header` row: a small `⣿` grip
  (`title="Drag to reorder"`) beside the title, wired to
  `onDragHandleMouseDown`. Dragging is scoped to that handle rather than
  the whole strip, since (unlike a canvas card, which only needs to dodge
  its own `.track-controls`) a channel strip is almost entirely interactive
  controls — fader, pan dial, effect toggles, transport, waveform-seek —
  leaving little safe surface to grab otherwise. The root strip gets an
  `is-dragging` class (orange outline, reduced opacity, `cursor: grabbing`)
  while its id matches `MixerView`'s `draggingId`.
- `MixerView`/`useCanvas.ts`/`Canvas.tsx` thread `reorderTracks` through
  from `useAudio()` down to `MixerView`, the same way `tracks` already
  flows.
- New order survives session save/load for free — both already round-trip
  on array order, so no `SessionFile` changes were needed.
- Added tests: `useMixerReorder.test.tsx` (edge clamping, `userSelect`
  restore on drop, no stale updates after a drag ends), plus updated
  `AudioContext.test.tsx` (reorder moves the right entry, no-ops on missing
  id / same index, `x`/`y` travel with the moved entry rather than staying
  at the array slot), `ChannelStrip.test.tsx`/`MixerView.test.tsx` (grip
  triggers the handler, `is-dragging` class reflects the prop), and
  `Canvas.test.tsx`'s `useAudio()` mock updated with `reorderTracks`.
