# Audit — Round 01

Full-app review across five subsystems: the Web Audio engine, the Electron
main/IPC boundary, the React state/context layer, the UI component tree, and
build/CI/test-coverage config. Each finding below was verified by reading the
actual code and, where relevant, its tests — not inferred from naming or
structure alone. File:line references were accurate as of the review date;
re-verify before acting if this document is read much later.

Status legend: `[ ]` open, `[x]` fixed (see `doc/TODO.md` for the tracking
checklist and fix write-ups).

## 1. Bugs

Reachable, verified defects in already-shipped behavior. All 8 fixed — see
`doc/TODO.md`'s "Audit round 01 › Bugs" entry for the fix write-up and test
evidence for each.

- [x] **`AudioEngine.pause()` doesn't cancel a pending fade timer.**
  `src/renderer/audio/AudioEngine.ts:259-273`. `play()`, `stop()`, `seek()`
  and `removeTrack()` all call `_cancelFadeOut(track)` as their first step
  specifically to invalidate any in-flight `fadeOutTimer`; `pause()` is the
  one transport method that doesn't. Reachable sequence: enable seek-fade,
  play, `seek()` (schedules a cross-fade-then-resume timer while
  `track.playing` stays `true`), then `pause()` before that timer fires. The
  seek's timer still fires afterwards and unconditionally restarts playback,
  undoing the pause. If `track.fadeOut` is also enabled, `pause()` overwrites
  `track.fadeOutTimer` with a *new* timer, orphaning the original one so it
  can no longer be canceled at all.

- [x] **`AudioEngine.stop()`'s offset reset is lost if its fade gets
  canceled first.** `src/renderer/audio/AudioEngine.ts:275-294,656-665`. When
  `track.fadeOut` is true, `stop()` defers `track.startOffset = 0` into the
  `afterStop` callback passed to `_startFadeOut`, which only runs once the
  fade's `setTimeout` elapses. If `play()`/`seek()`/another `stop()` cancels
  that fade first (via `_cancelFadeOut`, which never invokes `afterStop`),
  the reset never happens — a quick stop-then-play resumes from the old
  position instead of 0, contradicting `stop()`'s own contract (exercised
  only in the non-fade path by the existing "stops and resets current time"
  test).

- [x] **`clamp()` lets `NaN` pass through unclamped.**
  `src/renderer/audio/audioParams.ts:1-3`. `Math.max`/`Math.min` propagate
  `NaN` (unlike `±Infinity`, which they already clamp correctly), so
  `clamp(NaN, min, max) === NaN`. Every numeric setter in `AudioEngine`
  trusts `clamp()`'s output and forwards it straight into Web Audio calls
  that throw a `TypeError` on non-finite values. Reachable via
  `AudioContext.tsx`'s `loadSession`, which feeds plain numeric fields off a
  disk-loaded `SessionTrackSnapshot` (no runtime validation) directly into
  `setVolume`/`setFilterSettings`/etc. — a corrupted or hand-edited session
  file with a missing/non-numeric field throws uncaught mid-load.

- [x] **`AudioEngine.setVolume()` doesn't account for a pending fade-out's
  scheduled hard-stop.** `src/renderer/audio/AudioEngine.ts:385-391` vs.
  `642-654`. `_startFadeOut` schedules a gain ramp-to-0 *and* an independent
  `setTimeout` that force-stops the source once it fires. `setVolume()`
  cancels the gain automation but leaves that `setTimeout` untouched, so it
  still fires at the original time/gain — moving the volume slider during a
  pause/stop fade-out (or a seek cross-fade) produces a scheduling mismatch
  between the (now-irrelevant) old ramp and the still-pending hard stop.

- [x] **`useCanvas.onLoadSession` has no `catch`, so a decode failure
  silently aborts the load.** `src/renderer/components/Canvas/useCanvas.ts:184-216`.
  The function's `try {…} finally {…}` has no `catch`.
  `AudioContext.tsx`'s `loadSession` calls
  `engine.audioContext.decodeAudioData(...)` per track with no try/catch of
  its own; one corrupted/non-audio file referenced by the session throws,
  the rejection propagates unhandled, the loading spinner still clears (via
  `finally`), and every track is silently dropped with zero user feedback.

- [x] **`useCanvas.onOpenFiles` has the same silent-rejection pattern.**
  `src/renderer/components/Canvas/useCanvas.ts:110-131`. `readAudioFile`
  rejects on an ungranted or unreadable path; the per-path read isn't
  wrapped in its own try/catch, so one bad file in a multi-file selection
  throws out of the loop and drops the *entire* batch (including files that
  read successfully before it) with no user feedback.

- [x] **`AudioContext.addTracks` snapshots `anySoloed` once for the whole
  batch instead of reading live state.** `src/renderer/context/AudioContext.tsx:51`.
  `anySoloed` is computed from the `tracks` closure before the batch's async
  decode loop starts. If the user toggles solo on an existing track while a
  multi-file `addTracks` batch is still decoding, every file processed after
  that toggle still uses the stale, pre-toggle value — it gets the wrong
  initial engine gain until manually corrected (e.g. by re-toggling solo).

- [x] **`loadSession`/`newSession` race with a concurrent `addTracks` (drop
  or Open Files), leaking engine nodes.** `src/renderer/context/AudioContext.tsx:580`
  (and `587`). `loadSession`/`newSession` replace `tracks` wholesale via a
  non-functional `setTracks(...)`, with no mutual exclusion against a
  concurrently in-flight `addTracks` (which appends via the safe functional
  form). Depending on which state update lands last, either a track added
  mid-load is dropped from React state while its `AudioEngine` node is never
  removed (leak), or a functional append re-adds tracks whose engine nodes
  `loadSession`/`newSession` already removed (dangling `TrackEntry`s that
  can't produce audio).

## 2. Security (Electron / IPC)

All 5 fixed — see `doc/TODO.md`'s "Audit round 01 › Security" entry for the
fix write-up and test evidence for each.

- [x] **`fs:writeSessionFile` has no path validation, unlike its sibling
  read handlers.** `src/main/main.ts:130-141`. `fs:readSessionAudioFile` and
  `shell:revealFile` both explicitly gate on `path.isAbsolute` +
  `fs.statSync(...).isFile()`; this handler calls `fs.writeFileSync`
  directly on a renderer-supplied path with no checks. Not reachable with
  attacker-controlled content through today's UI (the only caller always
  passes a path obtained from a prior save/open dialog), but it's an
  inconsistently-hardened point on the full IPC surface — a defense-in-depth
  gap if the renderer is ever compromised (malicious dependency, dev-mode
  MITM of the `localhost:5173` dev server).

- [x] **`fs:readSessionAudioFile` allows reading any absolute path that's a
  file.** `src/main/main.ts:170-188`. No audio-type/extension check (unlike
  `dialog:openAudioFiles`, which UI-filters by extension). A hand-edited or
  untrusted session file that points `filePath` at an arbitrary readable
  path will have those bytes read into renderer memory. Today's only
  consumer feeds the result to `decodeAudioData`, which rejects non-audio
  content — no confirmed exfiltration path currently, but the read
  primitive itself is real.

- [x] **`dev:main` runs Electron with `--no-sandbox` unconditionally, plus
  Linux/Wayland-only flags on every OS.** `package.json:9`. Exists to work
  around a GNOME 46 GTK/gsettings issue (`scripts/patch-gsettings.mjs`
  addresses the same root cause), but disables a major Electron defense
  layer for all local development regardless of host OS, and doesn't appear
  in `build`/`start`/`pack` (production unaffected).

- [x] **No navigation hardening on the main `BrowserWindow`.**
  `src/main/main.ts:15-25`. No `will-navigate`, `will-redirect`, or
  `setWindowOpenHandler` listener. `nodeIntegration: false` +
  `contextIsolation: true` limit blast radius, but nothing stops a
  compromised/buggy renderer from top-level-navigating the window to an
  arbitrary remote URL — a standard item on Electron's own security
  checklist, currently absent.

- [x] **No regression test asserts the security-relevant `webPreferences`.**
  `src/__tests__/main/main.test.ts`. `contextIsolation`, `nodeIntegration`,
  and the `preload` path are the entire security boundary of the app, but no
  test pins their values — a future refactor could silently weaken them with
  nothing failing.

## 3. Accessibility

All 6 fixed — see `doc/TODO.md`'s "Audit round 01 › Accessibility" entry for
the fix write-up and test evidence for each.

- [x] **Effect dialogs have no keyboard dismissal.**
  `src/renderer/components/TrackPlayer/components/EffectDialog.tsx:11-34`.
  No `role="dialog"`/`aria-modal`, no Escape-to-close, across all 5 dialogs
  (Delay/Filter/Distortion/Reverb/Fade) — inconsistent with
  `useTrackContextMenu.ts`, `useSessionMenu.ts`, and `useViewMenu.ts`, which
  all correctly close on Escape.

- [x] **Settings-field labels aren't programmatically associated with their
  controls.** `src/renderer/components/TrackPlayer/components/SettingsField.tsx:34-47,56-67`.
  Bare `<span>` labels with no `htmlFor`/`aria-labelledby` — every slider and
  select in all 5 effect dialogs is announced to screen readers with no
  name.

- [x] **Mixer channel-strip reordering is mouse-only.**
  `src/renderer/components/MixerView/ChannelStrip.tsx:82-88`,
  `src/renderer/components/MixerView/useMixerReorder.ts:32-77`. The drag
  handle has no `role`/`tabIndex`/keydown handler, and the reorder logic is
  wired entirely through `window` mouse events — no keyboard path exists.

- [x] **Waveform seek is mouse-only.**
  `src/renderer/components/TrackPlayer/components/waveform/WaveformCanvas.tsx:17`.
  A plain `<div onClick>`, not a button — unreachable by keyboard in both
  TrackPlayer and Mixer view.

- [x] **Toggle buttons inconsistently expose `aria-pressed`.**
  `MuteSoloButtons.tsx` sets it (and is tested for it); the structurally
  identical toggles in
  `src/renderer/components/TrackPlayer/components/effectToggles/EffectToggles.tsx:25-58`
  and
  `src/renderer/components/TrackPlayer/components/transportControls/TransportToggles.tsx:35-72`
  don't — 8 toggle buttons rely on color/class alone.

- [x] **Dropdown-menu toggles lack `aria-expanded`/`aria-haspopup`.**
  `src/renderer/components/SessionMenu/SessionMenu.tsx:48`,
  `src/renderer/components/ViewMenu/ViewMenu.tsx:36`.

## 4. Consistency / Maintainability

- [ ] **`PanDial` reintroduces the inline-style pattern the "remove inline
  styles" TODO already fixed elsewhere.**
  `src/renderer/components/MixerView/PanDial.tsx:23-26`. Sets a raw
  `style={{ transform: ... }}` directly; every other analogous control
  (`useVolumeControl`, `usePanControl`, `useVUMeter`, `useMasterVUMeter`)
  was migrated to a CSS custom property per `doc/CSS-CONVENTIONS.md`.
  `PanDial` was added later (`653ef2b`) and drifted back to the pattern the
  TODO fixed.

- [ ] **Stale invariant comment in `AudioContext.tsx`.**
  `src/renderer/context/AudioContext.tsx:15` vs. `:529`. The comment above
  `effectiveVolume` claims it's "the single place" gain reaches
  `engine.setVolume`; `loadSession` calls `engine.setVolume(id,
  snapshot.volume)` directly, bypassing it. Currently harmless (loaded
  tracks are hardcoded unmuted/unsoloed) but a latent trap if session
  persistence of mute/solo is ever added.

- [ ] **Stale comment on `tickCurrentTimes`.**
  `src/renderer/context/AudioContext.tsx:609`. Says "called by animation
  frame"; it's actually driven by a 100ms `setInterval`
  (`useCanvas.ts:76`).

- [ ] **`tickCurrentTimes` + unmemoized context value cause a full-tree
  re-render 10×/sec.** `src/renderer/context/AudioContext.tsx:610,624`.
  Every tick rebuilds every track object unconditionally, and the
  `Ctx.Provider` value is a fresh object literal every render with no
  `React.memo` anywhere downstream — all `useAudio()` consumers re-render
  10 times a second for the app's entire lifetime, whether or not anything
  changed.

- [ ] **Stale class-doc comment on `AudioEngine`.**
  `src/renderer/audio/AudioEngine.ts:24-31`. Describes only the reverb +
  gain node per track; predates the filter/distortion/delay inserts and the
  panner/analyser nodes.

- [ ] **Unnamed magic numbers in `computeWaveformPeaks`.**
  `src/renderer/audio/waveform.ts:9,19`. `48` (bucket count) and `1.4`
  (visual peak-boost factor) are bare literals; every other numeric
  constant under `audio/` is named and exported.

## 5. CI / Tooling / Coverage

- [ ] **Electron-builder packaging config has zero CI signal.**
  `.github/workflows/ci.yml` only runs `pnpm build` (vite + tsc); it never
  invokes `electron-builder`/`pnpm pack`, so the `"build"` block in
  `package.json` (appId, per-OS targets, output dir) is never exercised.

- [ ] **`useVUMeter.ts` has no dedicated test.**
  `src/renderer/components/MixerView/useVUMeter.ts`. Its sibling
  `useMasterVUMeter.ts` has one (`useMasterVUMeter.test.ts`); `ChannelStrip.test.tsx`
  renders the component that uses `useVUMeter` but never asserts on its
  meter/level output. Looks like an accidental gap, not a deliberate skip.

- [ ] **`@types/node` is three majors ahead of CI's pinned Node version.**
  `package.json` declares `^25.9.1`; `.github/workflows/ci.yml:24` pins
  Node 22. No concrete API-gap bug found from this, just a version-
  declaration drift worth tightening.
