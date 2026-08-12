# Audio Effects — Future Development TODO

Effects to be added per-track in `AudioEngine.ts`.  
Integration point: `SourceNode → GainNode → [effects chain] → masterGain`.  
Each effect node should be stored in `TrackNodes` and exposed via the standard
`TrackState` + setter pattern already used for volume and fades.

---

## Architecture decision: per-track inserts vs. a shared effects rack

Considered whether effects should live directly on each track (current approach)
or as an independent "effects rack" section with a visual patchbay (cable-style
connections from tracks to shared effect units).

**Decided: keep per-track inserts for now.** Reuses the existing
`TrackState` + `TrackNodes` + `AudioEngine` setter pattern with no new
subsystem. A patchbay would require a routing graph, cable-drag UI on the
canvas, and rules for shared-instance behaviour — a lot of extra surface for
what's meant to stay a focused mixing/monitoring tool.

- [ ] **Future improvement: shared reverb send/return bus.** Real mixing
  consoles typically run reverb as a shared "send" effect — one reverb
  instance fed from multiple tracks via a per-track "send amount" — rather
  than one `ConvolverNode` duplicated per track. This is both more
  CPU-efficient (convolution is expensive) and matches how audio engineers
  expect reverb to behave. Could be implemented as a single shared bus
  without needing the full visual patchbay (just one reverb instance + a
  per-track send-level knob). Revisit if per-track `ConvolverNode` instances
  turn out to be a CPU bottleneck with many tracks, or if users want one
  consistent "room" applied across the whole mix.

---

## Native Web Audio API (no extra dependencies)

- [ ] **Equalizer** — `BiquadFilterNode`; 8 filter types (`lowpass`, `highpass`,
  `bandpass`, `lowshelf`, `highshelf`, `peaking`, `notch`, `allpass`);
  chain multiple nodes for a parametric EQ.

- [x] **Filter** — single sweepable `BiquadFilterNode` per track (distinct from
  the multi-band Equalizer above): lowpass/highpass/bandpass type switch,
  cutoff frequency, resonance (Q), mix, output level — the classic one-knob
  "Filter" control on DJ mixers. **Implemented** — see `AudioEngine.ts`
  (`_createFilterNodes`, `setFilterSettings`) and the new
  `FilterSettingsDialog.tsx` / `useFilterSettingsDialog.ts` (built as an
  independent component + hook per `doc/ARCHITECTURE.md`'s dialogs/overlays
  convention, unlike the older inline Delay/Reverb panels). Sits **before**
  delay/reverb in the chain (tone-shaping happens first):
  `gainNode → filter insert → delay insert → reverb insert → masterGain`.

- [ ] **Compressor / Limiter** — `DynamicsCompressorNode`; params: threshold,
  knee, ratio, attack, release; doubles as a master limiter at gain=1.

- [x] **Stereo Pan** — `StereoPannerNode`; range -1 (full left) to +1 (full
  right). **Implemented** — see `AudioEngine.ts` (`setPan`) and
  `TrackPlayer.tsx` (the pan slider, rendered above the volume control).
  Unlike Delay/Reverb, this is an always-visible plain `<input type="range">`
  applied live on every change — no settings dialog, no draft/Apply/Cancel,
  same treatment as the Volume slider. Sits as the last stage of the
  per-track chain, right before `masterGain`: `gainNode → delay → reverb →
  pannerNode → masterGain`. Double-clicking the slider recenters it to 0%.

- [ ] **3-D Spatial Audio** — `PannerNode` with HRTF model; full x/y/z position
  and orientation control; useful for immersive mixing.

- [x] **Reverb / Convolution** — `ConvolverNode`. **Implemented** — see
  `AudioEngine.ts` (`_createReverbNodes`, `_getImpulseResponse`,
  `setReverbSettings`) and `doc/DEVLOG.md` (2026-07-11 entries).
  **Parameter set (5 controls):**
  - **Room / IR type** — preset dropdown (Small Room, Hall, Plate, Cathedral);
    swaps `ConvolverNode.buffer` between synthesised impulse responses
    (no bundled IR audio files — each preset's IR is generated on demand as
    exponential-decay-shaped noise and cached per room).
  - **Wet/Dry mix** — slider 0–100%; parallel dry `GainNode` + wet `GainNode`
    (through the convolver), crossfaded.
  - **Pre-delay** — slider 0–500 ms; `DelayNode` inserted before the convolver.
  - **Damping / tone** — slider 0–100%; `BiquadFilterNode` (lowpass) on
    the wet tail, mapped to a 20000–500 Hz cutoff.
  - **Output level** — slider 0–100%; trim `GainNode` after the convolver.
  - Reuses the existing per-track settings-overlay pattern (sliders + Apply/Cancel).
  - **Future improvement (not in initial scope):** continuous **Room Size** and
    **Decay Time** sliders require generalising the synthesised-IR approach
    (parameterising duration/decay directly instead of fixed per-preset
    values). Revisit if the fixed presets feel too limited.

- [x] **Delay / Echo** — `DelayNode` with a feedback `GainNode` looped back
  through a `BiquadFilterNode` (lowpass) into the delay input. **Implemented**
  — see `AudioEngine.ts` (`_createDelayNodes`, `setDelaySettings`) and
  `doc/DEVLOG.md` (2026-07-11 entry). Sits **before** the reverb insert in the
  per-track chain: `gainNode → delay → reverb → masterGain`.
  **Parameter set (5 controls):**
  - **Delay Time** — slider 1–2000 ms (step 10); `DelayNode.delayTime`.
    Floor of 1 ms (not 0) because this node sits inside a feedback cycle,
    unlike reverb's pre-delay which doesn't.
  - **Feedback** — slider 0–90%; capped below 100% so the
    `delayNode → feedbackGain → damping → delayNode` loop gain always stays
    under 1.0 — repeats decay to silence and never runaway/self-oscillate.
  - **Wet/Dry mix** — slider 0–100%; default 0 (fully dry until opted in),
    same convention as reverb.
  - **Tone / Damping** — slider 0–100%; `BiquadFilterNode` (lowpass) placed
    *inside* the feedback loop (not just once on the wet tail), so each
    successive repeat is progressively darker — classic tape-echo character.
    Reuses reverb's existing `DAMPING_MIN_HZ`/`DAMPING_MAX_HZ` (500–20000 Hz)
    mapping.
  - **Output level** — slider 0–100%; trim `GainNode` after the dry/wet sum.
  - Reuses the existing per-track settings-overlay pattern (sliders + Apply/Cancel).

- [ ] **Distortion / Saturation** — `WaveShaperNode`; apply an arbitrary
  waveshaping curve; covers soft-clip, overdrive, and bit-crush.

- [ ] **Playback Rate** — `AudioBufferSourceNode.playbackRate` (already present
  on every source node); changes speed and pitch together.

- [ ] **Waveform / Spectrum Analyser** — `AnalyserNode`; exposes
  `getByteTimeDomainData` and `getByteFrequencyData`; foundation for
  waveform and FFT visualisations in the UI.

- [ ] **Channel Routing** — `ChannelSplitterNode` + `ChannelMergerNode`;
  enables mid-side processing, per-channel EQ, and mono downmix.

---

## AudioWorklet (custom DSP, still no external libraries)

- [ ] **Pitch Shift** (time-preserving) — phase vocoder implemented in a
  worklet; high complexity.

- [ ] **Time Stretch** (pitch-preserving) — phase vocoder or WSOLA in a worklet;
  alternatively pre-process with `OfflineAudioContext`; high complexity.

- [ ] **Chorus / Flanger** — short modulated delay; can be approximated with
  `DelayNode` + `OscillatorNode` LFO without a worklet; medium complexity.

- [ ] **Tremolo** — `OscillatorNode` modulating a `GainNode`; low complexity.

- [ ] **Vibrato** — `OscillatorNode` modulating `AudioBufferSourceNode.playbackRate`;
  low complexity.

- [ ] **Noise Gate** — RMS envelope follower that mutes the signal below a
  threshold; medium complexity; requires a worklet.

- [ ] **Tape Saturation / Vintage Warmth** — `WaveShaperNode` soft-clip curve
  combined with a mild high-frequency roll-off `BiquadFilterNode`; medium
  complexity.

---

## Track / UI features (non-effects)

- [x] **Stop-all button** — dashboard-level control to stop every currently
  running track at once.

- [x] **Play All button** — dashboard-level control to start playback of every
  loaded track at once, mirroring "Stop All". **Implemented** — see
  `AudioEngine.ts` (`playAll`), `AudioContext.tsx` (`playAll`), `Canvas.tsx`
  ("▶ Play All" button, disabled when there are no tracks or all tracks are
  already playing) and `doc/DEVLOG.md` (2026-07-11 entry).

- [x] **Clone track** — context menu on right-click over a track, with an
  option to duplicate it (current settings/effects plus the loaded wav
  audio) as a new track. **Implemented** — see `AudioEngine.ts` (`getBuffer`),
  `AudioContext.tsx` (`duplicateTrack`), and the new `TrackContextMenu.tsx` /
  `useTrackContextMenu.ts` (right-click menu, wired into `TrackPlayer.tsx`).
  The cloned track reuses the same decoded `AudioBuffer` by reference (no
  re-decode) and copies volume/loop/fade/delay/reverb settings via the
  existing per-track setters; it's dropped onto the canvas offset by
  `+20/+20` from the source card.

- [x] **Reveal file in explorer** — add a new option in `TrackContextMenu`
  to open the selected track's source file in the OS file explorer / finder,
  using the existing file path information already available for each track.
  **Implemented** as a "Show in Folder" item — see `main.ts`
  (`shell:revealFile`, backed by `shell.showItemInFolder`), `preload.ts`
  (`revealFile`), `useTrackPlayer.ts` (`reveal` / `canReveal`) and
  `TrackContextMenu.tsx`. `TrackEntry.filePath` is threaded down to
  `TrackPlayer` as a prop, the same way `x`/`y` already were.
  - The main-process handler deliberately does **not** gate on the
    `grantedPaths` allowlist used by `fs:readAudioFile`: that set is *replaced*
    on every open-file dialog, so tracks from an earlier batch could no longer
    be revealed, and drag-and-drop paths never enter it. Revealing only opens
    the OS file manager, so an absolute-path + exists + is-a-file check is the
    proportionate gate. It resolves `{ revealed, error? }` rather than
    rejecting, matching `dialog:saveRecording`.
  - **Latent bug fixed along the way:** drag-and-drop stored
    `(file as File & { path?: string }).path ?? file.name`, but Electron
    removed `File.path` in v32 (this project runs 42.x) — so every dropped
    track held a bare filename, not a path. `useCanvas.onDrop` now resolves the
    real path through a new `getPathForFile` preload method
    (`webUtils.getPathForFile`). This also unblocks **Save / Load session**
    below, which persists file paths.

- [x] **Mute by clicking the volume icon** — the volume icon in each track
  card toggles mute/unmute for that track when clicked.
  **Implemented** entirely in `useVolumeControl.ts` / `VolumeControl.tsx` —
  no new state on `TrackState`/`AudioEngine`. "Muted" is derived as
  `volume === 0`; a `useRef` remembers the last non-zero volume so clicking
  the icon again restores it via the existing `setVolume` setter. The icon
  is now a real `<button>` (was a `<span>`) for keyboard/AT accessibility,
  swapping between 🔊/🔇 with a "Mute"/"Unmute" title.

- [x] **Save / Load session** — persist the current set of tracks (file path,
  canvas position, and every per-track setting) to a JSON file, then restore
  that exact setup later.
  **Implemented** via `SessionFile`/`SessionTrackSnapshot`
  (`domain/SessionFile.ts`), 3 new IPC handlers in `main.ts`
  (`dialog:saveSession`, `dialog:openSession`, `fs:readSessionAudioFile` —
  the latter gated the same way as `shell:revealFile`, not `grantedPaths`,
  since session file paths come from a previously saved session) exposed
  through `preload.ts`/`electron.d.ts`, and `AudioContext.tsx`'s
  `loadSession`. Load Session **replaces** the canvas (`engine.removeTrack`
  for every existing track, then a single `setTracks` with the newly built
  entries) rather than merging. The waveform-peak computation used by both
  `addTracks` and `loadSession` was extracted into
  `audio/waveform.ts#computeWaveformPeaks`. Missing/moved files are skipped
  individually and reported back as `{ missing: string[] }`; `useCanvas.ts`'s
  `onLoadSession` surfaces that list via `window.alert` (no toast system
  exists yet, so this is the proportionate fallback). UI lives in a top-left
  `SessionMenu` dropdown (`components/SessionMenu/`, opened via a `☰ Session`
  toggle button, closes on outside click/Escape like `TrackContextMenu`) with
  "Load Session" / "Save Session" / "Save New Session" items, each guarded
  against concurrent clicks the same way `onOpenFiles` is. "Save Session" is
  now a quick save: `useCanvas.ts` tracks `currentSessionPath` (set on a
  successful save-as or load) and, when known, writes straight to it via the
  new `fs:writeSessionFile` IPC handler — no dialog. "Save New Session" is the
  save-as path, always opening the save dialog via `dialog:saveSession` (now
  suggesting a date-and-time-based `session-YYYY-MM-DD_HH-mm.json` name, so
  same-day saves don't collide) and updating `currentSessionPath` on success.

- [x] **New Session** — clear the canvas and release every track's audio
  resources in one action, for starting over without restarting the app.
  **Implemented** via `AudioContext.tsx`'s `newSession()`, following the same
  teardown precedent as `loadSession`: loop `engine.removeTrack(id)` over
  every existing track (disposing all Web Audio nodes) before wiping state
  with `setTracks([])` — a bare `setTracks([])` alone would leak the engine's
  internal node map. `useCanvas.ts`'s `onNewSession` guards it behind
  `window.confirm` (only shown when there are tracks to lose) and resets
  `currentSessionPath` to null. Added as a "New Session" item in the
  `SessionMenu` dropdown, alongside Load/Save Session.

- [x] **Dashboard track-view reorganization** — add a dashboard-level action to
  reorganize the visible track views in a consistent layout, such as aligning
  cards by size, spacing, or a predictable grid/order when the user requests it.
  This should help reduce visual clutter when many tracks are loaded.
  **Implemented** via a new `⊞ Organize` floating button next to the Session
  menu, backed by a new `canvasLayout.ts` util shared by both the default and
  organized placement paths: `TOP_INSET = 90` / `SIDE_INSET = 20` reserve the
  screen-top band occupied by the `SessionMenu` (top-left) and `RecorderBar`
  (top-right) buttons, and `computeGridPositions(count, viewportWidth)` fills
  a row-major grid (`TRACK_CARD_WIDTH = 380`, matching `.track-player`'s CSS
  width, plus a `GRID_GAP = 20` and an approximate `TRACK_CARD_HEIGHT = 260`
  row spacing — card height is content-driven, so this is a spacing
  approximation, not an enforced height). `useCanvas.ts`'s new
  `onOrganizeTracks` calls the existing `updatePosition(id, x, y)` once per
  track with the computed coordinates, so organizing is a one-shot snapshot
  rather than a persistent "layout mode" — tracks can still be dragged
  freely afterward. `AudioContext.tsx`'s cascade start for new/duplicated
  tracks moved from the literal `{ x: 20, y: 20 }` (which sat directly under
  the Session menu button) to `{ x: SIDE_INSET, y: TOP_INSET }`, so default
  placement also skips the reserved top band. `SessionMenu.css`'s
  `.session-menu` positioning moved from `fixed` to `relative`, since the new
  `.top-left-actions` wrapper in `Canvas.tsx` now owns the fixed top-left
  placement for both the Session menu and the Organize button.

- [x] **Mixer-style vertical track view** — add a second view mode that displays
  track information in a vertical, console-like layout with one track per row,
  making it easier to compare levels, mute/solo states, and per-track controls
  at a glance.
  **Implemented** as a visual-only MVP following the "Option 1C — Rack" design
  in `doc/templates/Audio UI modernization project/Multitrack Redesign.dc.html`.
  The old standalone `⊞ Organize` button in `.top-left-actions` was replaced by
  a `ViewMenu` dropdown (mirroring `SessionMenu`'s open/close pattern), which
  lists `⊞ Organize Tracks` only while in canvas mode, plus a single dynamic
  item that switches to the other view (`🎚 Switch to Mixer View` /
  `🖼 Switch to Track View`). `useCanvas.ts` now owns `viewMode: 'canvas' |
  'mixer'` and `switchView()`; `Canvas.tsx` branches its track rendering
  between the existing free-form `TrackPlayer` cards and the new `MixerView`,
  which renders one `ChannelStrip` per track (in `tracks` array order, ignoring
  `x`/`y`). Each strip **reuses** existing `TrackPlayer` sub-components as-is
  (`WaveformCanvas`, `EffectToggles`, `PanControl`, `VolumeControl`,
  `TransportControls`, effect dialogs) restyled into a vertical fader via CSS,
  plus a derived dB readout (`formatDb.ts`, `20*log10(volume)`) — no new track
  state was added. Mute/Solo, a live level meter, and the design's Master strip
  were explicitly deferred (see the three new entries below) since none of
  `TrackState`, `AudioContext.tsx`, or the audio engine have the backing data
  (mute/solo flags, an `AnalyserNode`, or a master bus) required to drive them.

- [x] **Mixer view: Mute / Solo buttons** — add `muted`/`soloed` booleans to
  `TrackState`, plus setters in `AudioContext.tsx` (mute routes through the
  existing volume path to 0 and restores the prior value; solo mutes every
  other track). Deferred out of the initial mixer-view MVP above; no
  audio-graph changes needed, just new state + wiring.

- [x] **Mixer view: live VU meter per channel strip** — requires an
  `AnalyserNode` per track in the audio engine and a polling/animation-frame
  bridge into React to drive the meter bar next to each `ChannelStrip`'s
  fader. Deferred out of the initial mixer-view MVP above; touches the audio
  engine itself, not just the UI.
  **Implemented**: an `AnalyserNode` is inserted serially into each track's
  chain (`pannerNode → analyser → masterGain`, unity-gain passthrough) in
  `AudioEngine.ts`; `getLevel(id)` reads its time-domain data and returns RMS
  amplitude. `useVUMeter.ts` polls it via `requestAnimationFrame` with
  peak-hold-style decay and exposes a `--meter-level` CSS var; `VUMeter.tsx`
  renders the bar, styled in `MixerView.css` from the rack mock's
  `.rk-meter`.

- [x] **Mixer view: Master strip with master volume** — there is no master bus
  in the current audio graph (each track routes independently). Adding one
  means introducing a master `GainNode` in the engine, a corresponding
  `masterVolume` value in `AudioContext.tsx`, and rendering the design's
  `.strip.master` column as a real control instead of a static element.
  Deferred out of the initial mixer-view MVP above.
  **Implemented** following "Option 1C — Rack"'s `.strip.master` column: a
  new `MasterStrip.tsx` (title, static "OUT" placeholder, balance dial,
  fader, two VU meters, dB readout — no REC/mute/solo/DIM, kept minimal).
  `AudioEngine.ts`'s constructor rewires `masterGain → masterPanner →
  destination`/`recorderDest`, plus a `ChannelSplitterNode` feeding two
  `AnalyserNode`s for independent L/R metering; new `setMasterVolume`,
  `setMasterBalance`, `getMasterLevel(channel)` methods mirror the existing
  per-track setters/`getLevel` shape. `masterVolume`/`masterBalance` live in
  `AudioContextValue`/`AudioContext.tsx` (id-less, no mute/solo — master has
  neither), not on `TrackState`. `MixerView.tsx` renders `MasterStrip`
  **outside** the `rackRef`-scoped container: `useMixerReorder.ts` computes
  drag-reorder targets from every DOM child of that ref with no filtering,
  so the master strip sits in a sibling `.mixer-master-dock` to avoid
  corrupting drag math. A shared `meterLevel.ts` was extracted from the
  existing `useVUMeter.ts` (peak-hold decay + dB-scale mapping) to back the
  new two-channel `useMasterVUMeter.ts` without duplicating that logic.

- [ ] **Real-time effect preview + floating settings panel** — convert the
  Filter/Distortion/Delay/Reverb settings dialogs from "draft state,
  Apply/Cancel" full-bleed overlays into a live-preview floating panel
  positioned beside the `TrackPlayer` card instead of covering it, so tweaking
  a knob is heard immediately and the waveform/transport controls stay visible
  while adjusting. Full technical plan in `doc/REALTIME-EFFECTS-PLAN.md`.

---

## Coding improvements

- [x] **Extract fake Web Audio classes from `AudioEngine.test.ts` into a
  fixtures file.** `FakeGain`, `FakeSource`, `FakeMediaStreamDestination`, and
  `FakeAudioContext` currently live inline at the top of
  `src/__tests__/audio/AudioEngine.test.ts`. Move them to a shared fixtures
  module (e.g. `src/__tests__/audio/fixtures/fakeAudioContext.ts`) so they can
  be reused by other audio-related test suites without duplication.

- [x] **Extract per-track overlays/dialogs into independent components.**
  The fade-duration settings panel and the reverb (and delay) options dialogs
  currently live inline inside `TrackPlayer.tsx` (markup) and
  `useTrackPlayer.ts` (state/logic), rather than as their own components.
  Split each into its own component (e.g. `FadeSettingsDialog`,
  `ReverbSettingsDialog`) plus its own hook/use-case for the linked logic,
  following the existing per-track setter pattern (`AudioContext` →
  `AudioEngine`). Relocate the existing overlay related tests out of
  `TrackPlayer.test.tsx` into dedicated test suites for the new components
  once extracted. `FilterSettingsDialog.tsx` / `useFilterSettingsDialog.ts`
  (see the Filter effect above) are a concrete example of the target shape —
  use them as the template.

- [x] **Write down a standing architecture rule for dialogs/overlays** (see
  the new "Dialogs and overlays" convention added to `doc/ARCHITECTURE.md`):
  every new dialog or overlay must be built as its own independent component
  with its own tests, rather than inline markup/logic inside the track card.
  Apply this rule to the two extraction items above and to all overlays added
  from now on.

- [x] **Reduce duplication across effect dialogs, engine setters, and test
  fixtures.** Full detail in `doc/FUTURE-IMPROVEMENTS.md` § 1. Delivered as 6
  stacked slices on `ref/duplication-code`; see
  `openspec/changes/reduce-effect-duplication/apply-progress.md`.
  - [x] Extract a generic `useEffectDialog<T>` hook to replace the identical
    draft-state/open/close/apply shape duplicated across all 5 settings-dialog
    hooks (Filter/Distortion/Delay/Reverb/Fade).
  - [x] Consolidate the 4 near-identical effect-dialog CSS files into one shared
    stylesheet with a per-effect accent-color variable.
  - [x] Extract a shared `<EffectDialog>`/`<SettingsField>` component to replace
    the repeated dialog JSX.
  - [x] Resolve the triple-declared effect setter signatures across
    `AudioEngine.ts` / `audioContextInstance.ts` / `AudioContext.tsx` (now
    `(id, s: XSettings)` via `src/renderer/audio/effectSettings.ts`).
  - [x] Add a shared `clamp()` helper and a `_createDryWetOutput()` factory in
    `AudioEngine.ts` to remove repeated clamp/node-wiring code.
  - [x] Extract the copy-pasted `mockAudioEngine` stub (duplicated across 8+
    test files) into a shared `src/__tests__/test-utils/` module. The inline
    Fake Web Audio classes in `AudioEngine.test.ts` were confirmed out of
    scope for this item during exploration and remain tracked separately.

- [x] **Fix known error-handling gaps and close test-coverage holes in the
  audio engine.** Full detail in `doc/FUTURE-IMPROVEMENTS.md` § 2. Implemented
  via `ref/error-handling-gaps` (3 stacked slices: `_stopSource` narrowing,
  per-file import isolation, IPC path allowlist + fs hardening, fake-timer
  test coverage). All 27 tasks complete, 146/146 tests passing. One CRITICAL
  race condition (overlapping Open-Files batch-import) was discovered during
  review-resilience lens, fixed and validated (148/148 tests), but reverted
  due to review-scope constraints (fix required Canvas-layer files outside
  the originally-reviewed diff). Accepted as a known interim risk; tracked as
  a separate follow-up change — see new "Guard against overlapping Open-Files
  imports" item below.

- [x] **Standardize naming and extract magic numbers in the effects code.**
  Full detail in `doc/FUTURE-IMPROVEMENTS.md` § 3.
  - Unified `outputLevel` (engine layer) to `output` (canonical across all layers).
  - `mix` parameter position was already resolved by `reduce-effect-duplication`
    (all four setters now have `mix` as 4th parameter) — out of scope here.
  - Extracted the repeated `0.01` ramp time-constant as `PARAM_RAMP_TIME_CONSTANT_S`
    and the `500`/`10` clamp bounds as `REVERB_PREDELAY_MAX_MS` and
    `FADE_DURATION_MAX_S`, matching the existing `DELAY_TIME_MAX_MS` /
    `DAMPING_MIN_HZ` pattern.

- [x] **Guard against overlapping Open-Files imports.** A race condition was
  discovered during the error-handling-gaps change review (review-resilience
  lens, corroborated by refuter): a second "Open Files" click while a first
  batch's IPC reads are still in flight wipes the session-scoped `grantedPaths`
  allowlist mid-flight, causing the first batch's still-pending `readAudioFile`
  IPC calls to reject with "Access denied", silently discarding every
  already-read file in that batch with zero UI feedback (unhandled promise
  rejection). Fixed with a busy-guard on `onOpenFiles` in `useCanvas.ts`
  (`useRef` checked synchronously, prevents re-invocation while in-flight,
  cleared in a `finally` block) + a `disabled` state on the "+ Open Files"
  button in `Canvas.tsx` while a batch is in flight (mirroring
  RecorderBar.tsx's `disabled={isSaving}` pattern). This re-applies the exact
  approach prototyped and independently validated during error-handling-gaps
  (see that change's apply-progress narrative, B.12 task) but reverted there
  to keep review scope clean; 2 new tests added to `Canvas.test.tsx`
  (overlapping-click no-op, button disabled/re-enabled), 189/189 full suite
  passing, `tsc`/`eslint` clean.

- [x] **Split up oversized files and remove inline styles.** Full detail in
  `doc/FUTURE-IMPROVEMENTS.md` § 4.
  - Extract the ~400 lines of effect-insert logic in `AudioEngine.ts` into
    per-effect modules.
  - Extract `TrackPlayer.tsx`'s waveform-canvas `useEffect` into a
    `useWaveformCanvas` hook, and wrap its 5 conditional dialog overlays into
    an `<EffectDialogs>` component.
  - Replace `TrackPlayer.tsx`'s inline pan/volume slider gradients with CSS
    custom properties, per `doc/CSS-CONVENTIONS.md`'s no-inline-styles rule.

- [x] **Investigate the double-wired delay insert in `AudioEngine.ts`'s
  `addTrack`.** Confirmed copy-paste artifact, not intentional design:
  `gainNode` connected directly to `delay.dryGain`/`delay.delayNode` *and*
  `distortion.outputGain` also fed the same two nodes via the
  filter→distortion chain, so delay received the dry signal twice regardless
  of filter/distortion settings. The direct `gainNode → delay` wiring was a
  leftover from before the filter/distortion insert existed (chain used to be
  `gainNode → delay → reverb → panner`); when filter/distortion were inserted
  ahead of delay, the old direct connections should have been removed but
  weren't. Fixed by deleting the two stale `gainNode.connect(delay.*)` calls
  and their stale comment, leaving the single correct path: `gainNode →
  filter → distortion → delay → reverb → panner`. No test asserted the direct
  `gainNode → delay` connection, and the full 48-test `AudioEngine.test.ts`
  suite still passes.

- [x] **De-duplicate effect-dialog integration tests between `TrackPlayer.test.tsx`
  and each dialog's own test file.** Confirmed the duplication: each of
  `FadeSettingsDialog.test.tsx`, `FilterSettingsDialog.test.tsx`,
  `DelaySettingsDialog.test.tsx`, `ReverbSettingsDialog.test.tsx` and
  `DistortionSettingsDialog.test.tsx` already had its own "integration via
  TrackPlayer" block (each carrying a comment claiming to be "the sole owner"
  of that dialog's open/apply/cancel/active-button coverage), but
  `TrackPlayer.test.tsx` still had the identical assertions too — the "move"
  from the earlier `extract-track-overlays` work only ever copied the tests,
  it never removed the originals. Trimmed `TrackPlayer.test.tsx` down to the
  regressions that aren't covered elsewhere (waveform render, title/tooltip,
  play/pause/stop, loop/fade/seek toggles, the fade-reseed-on-reopen
  regression, context menu, reveal-in-folder, volume/pan/mute), removing 9
  duplicated integration tests (27 → 18 tests in that file). Full suite still
  323/323 passing across all 40 files.

- [x] **Repo housekeeping.** Full detail in `doc/FUTURE-IMPROVEMENTS.md` § 5.
  - Deleted the stale `doc/as commented in the resilient forest.md` — confirmed
    it was superseded implementation notes for the Filter effect, which is
    marked `[x]` above and documented in `doc/DEVLOG.md`.
  - Moved `doc/templates/Audio UI modernization project/` to
    `doc/mockups/Audio UI modernization project/` (`git mv`, history
    preserved) so it reads as a design-mockup bundle, not a spec document.
    Correction to the original note: it's *not* fully unreferenced — a lineage
    comment at the top of `MixerView.css` cites it (`Ported from doc/.../
    Multitrack Redesign.dc.html`); updated that comment's path to match the
    move. `doc/templates/` is now empty and untracked by git.
  - Removed the unused `tsx` devDependency from `package.json` — confirmed via
    a repo-wide search for real CLI usage (not just `.tsx` file-extension
    matches) that nothing invokes it; `pnpm install` re-run to sync
    `pnpm-lock.yaml`.
  - Swapped `pnpm test` to `vitest run` (single pass, matching common CI
    convention) and kept the watch variant as `test:watch`. Left
    `test:no-watch` in place as an alias since `.github/workflows/ci.yml` and
    `openspec/config.yaml` call it directly by name — renaming it outright
    would have broken CI and the openspec verify/archive tooling.

## Audit round 01

Full-app review (audio engine, Electron main/IPC, React state layer, UI
components, build/CI/coverage). Full detail, file:line references, and the
concrete reachable-failure scenario for every item are in
`doc/audit-round01.md`; that document's own checkboxes track fix status too
— keep both in sync as items are closed.

- [x] **Bugs** (`doc/audit-round01.md` § 1) — reachable defects in shipped
  behavior; fixed first, per plan.
  - [x] `pause()` doesn't cancel a pending fade timer, letting a playback
    restart or an orphaned timer undo the pause. Fixed by calling
    `_cancelFadeOut(track)` at `pause()`'s entry, matching `play()`/`stop()`/
    `seek()`'s existing convention. Regression test in `AudioEngine.test.ts`
    (seek cross-fade timer can no longer resume playback after a pause).
  - [x] `stop()`'s offset-reset-to-0 is lost if its fade gets canceled by a
    subsequent command. Fixed by setting `track.startOffset = 0` synchronously
    in `stop()`'s fade branch instead of deferring it into the fade's
    `afterStop` callback. Regression test covers an interrupted fade.
  - [x] `clamp()` lets `NaN` through instead of falling back to a safe value.
    Fixed with an explicit `Number.isNaN` check (± Infinity were already
    handled correctly and are left alone). New `audioParams.test.ts`.
  - [x] `setVolume()` doesn't account for a pending fade-out's scheduled
    hard-stop, causing a scheduling mismatch. Fixed by skipping the immediate
    gain retarget while `track.fadeOutTimer` is pending — the new volume is
    still recorded and takes effect once the fade completes (as the
    post-fade reset value, or as a seek's fade-in target).
  - [x] `onLoadSession` has no `catch`; a decode failure silently aborts the
    whole session load. Root cause fixed in `AudioContext.loadSession` with a
    per-snapshot try/catch (same resilience `addTracks` already had) so one
    bad track lands in `missing` instead of aborting the batch; added an
    outer catch in `onLoadSession` too as a second layer.
  - [x] `onOpenFiles` has the same silent-rejection pattern for a single bad
    file in a multi-file batch. Fixed with a per-path try/catch; failed paths
    are collected and surfaced via `window.alert`, mirroring the existing
    "missing session files" pattern.
  - [x] `addTracks` snapshots `anySoloed` once per batch instead of reading
    live state, misapplying solo to later files in the same import. Fixed
    with a `tracksRef` mirroring `tracks` via `useEffect`, read fresh right
    before each file's `engine.setVolume` call instead of once up front.
  - [x] `loadSession`/`newSession` race with a concurrent `addTracks`,
    leaking or corrupting engine/React track state. Fixed at the entry points
    in `useCanvas.ts`: `onDrop`/`onOpenFiles`/`onLoadSession`/`onNewSession`
    now cross-check each other's in-flight refs (extending the existing
    single-operation busy-guard pattern to be mutually exclusive across all
    four track-list-mutating operations).

  All 8 fixes verified with new regression tests that fail against the
  pre-fix code and pass after (confirmed via `git stash` round-trip on each
  changed file) — `AudioEngine.test.ts` (+3), `audioParams.test.ts` (new,
  +3), `AudioContext.test.tsx` (+2), `Canvas.test.tsx` (+3). Full suite
  41 files / 334 tests passing, `tsc`/`eslint` clean.

- [x] **Security** (`doc/audit-round01.md` § 2) — Electron/IPC
  defense-in-depth gaps, no confirmed exploit path through today's UI.
  - [x] `fs:writeSessionFile` has no path validation, unlike sibling read
    handlers. Fixed with the same `path.isAbsolute` gate the read handlers
    already use.
  - [x] `fs:readSessionAudioFile` allows reading any absolute path that's a
    file, with no audio-type check. Fixed with an extension allowlist
    (`AUDIO_FILE_EXTENSIONS`, shared with `dialog:openAudioFiles`'s native
    file-picker filter so the two agree on what counts as "an audio file";
    adds `webm` to both, which the renderer's own drag-and-drop check
    already accepted but the dialog filter and this gate didn't).
  - [x] `dev:main` runs with `--no-sandbox` unconditionally in dev. Fixed by
    moving the Electron launch into `scripts/dev-main.mjs`, which only
    applies the Linux/Wayland env vars and `--no-sandbox`/Ozone flags when
    `process.platform === 'linux'` — macOS/Windows dev now runs sandboxed.
    Side effect: the `cross-env` devDependency became unused (it existed
    solely for this one script) and was removed; `pnpm install` re-run to
    sync the lockfile.
  - [x] No navigation hardening (`will-navigate`/`setWindowOpenHandler`) on
    the main `BrowserWindow`. Fixed: `setWindowOpenHandler` now denies every
    window-open/popup request (the app never needs child windows), and a
    `will-navigate` listener blocks top-level navigation to anything other
    than the app's own origin (the dev-server origin in dev, `file://` in
    production).
  - [x] No test pins the security-relevant `webPreferences`
    (`contextIsolation`/`nodeIntegration`/`preload`). Fixed: added tests
    asserting those three `BrowserWindow` options, plus new tests for the
    `setWindowOpenHandler` deny-all behavior and the `will-navigate` block/
    allow behavior.

  All 5 fixes verified with new regression tests in `main.test.ts` (+6) that
  fail against the pre-fix `main.ts` and pass after (confirmed via `git
  stash` round-trip). Full suite 41 files / 340 tests passing, `tsc`/`eslint`
  clean.

- [x] **Accessibility** (`doc/audit-round01.md` § 3).
  - [x] Effect dialogs have no keyboard (Escape) dismissal or
    `role="dialog"`. Fixed once, in `EffectDialog.tsx` (the shared shell
    behind all 5 effect dialogs): added `role="dialog"`/`aria-modal="true"`/
    `aria-label={title}` on the panel, and a `keydown` listener that calls
    `onCancel` on Escape — safe to attach unconditionally since the
    component only exists in the tree while its dialog is open.
  - [x] Settings-field labels aren't programmatically associated with their
    controls. Fixed in `SettingsField.tsx`: the bare `<span>` is now a
    `<label>` paired via `htmlFor`/`id`, with the id generated per instance
    via `useId()` (not derived from `effect`/`label`) so two tracks with the
    same effect dialog open at once never collide on one DOM id.
  - [x] Mixer channel-strip reordering is mouse-only. Fixed: `useMixerReorder`
    gained `onGripKeyDown`, moving the focused strip one slot on
    ArrowLeft/ArrowRight (clamped at both ends); the grip in `ChannelStrip.tsx`
    is now `role="button" tabIndex={0}` with a matching `aria-label` and a
    focus-visible outline (`MixerView.css`).
  - [x] Waveform seek is mouse-only. Fixed: `WaveformCanvas`'s shell is now
    `role="slider"` with `tabIndex={0}` and `aria-valuemin/max/now`; both
    `useTrackPlayer` and `useChannelStrip` gained an `onProgressKeyDown` that
    seeks ±5s on ArrowLeft/ArrowRight and to 0/duration on Home/End, plus a
    focus-visible outline (`TrackPlayer.css`, shared by both views).
  - [x] Toggle buttons inconsistently expose `aria-pressed`. Fixed: added
    `aria-pressed` to all 4 `EffectToggles` buttons and all 4 toggleable
    `TransportToggles` buttons (not the fade-settings gear, which opens a
    dialog rather than toggling), matching `MuteSoloButtons`' existing
    pattern.
  - [x] Dropdown-menu toggles lack `aria-expanded`/`aria-haspopup`. Fixed:
    added both attributes to the `SessionMenu` and `ViewMenu` toggle buttons,
    `aria-expanded` bound to `isOpen`.

  All 6 fixes verified with new/extended tests (`EffectDialog`, `SettingsField`,
  `EffectToggles`, `TransportControls`, `SessionMenu`, `ViewMenu`,
  `WaveformCanvas`, `useMixerReorder`, `ChannelStrip`, `TrackPlayer` test
  files) that fail against the pre-fix source and pass after (confirmed via a
  single `git stash` round-trip across all 13 changed source files at once).
  Full suite 41 files / 359 tests passing, `tsc`/`eslint` clean. Deeper
  dialog focus-trapping (moving focus in on open, returning it on close)
  wasn't part of what the audit flagged and was left out to keep this change
  scoped to the 6 stated findings.

- [ ] **Consistency / maintainability** (`doc/audit-round01.md` § 4).
  - [ ] `PanDial` reintroduces the inline-style anti-pattern the "remove
    inline styles" TODO already fixed elsewhere.
  - [ ] Stale `effectiveVolume` "single place" comment — `loadSession`
    bypasses it.
  - [ ] Stale `tickCurrentTimes` "animation frame" comment — it's a 100ms
    `setInterval`.
  - [ ] `tickCurrentTimes` + unmemoized context value cause a full-tree
    re-render 10×/sec.
  - [ ] Stale `AudioEngine` class-doc comment (predates filter/distortion/
    delay/panner/analyser).
  - [ ] Unnamed magic numbers in `computeWaveformPeaks`.

- [ ] **CI / tooling / coverage** (`doc/audit-round01.md` § 5).
  - [ ] Electron-builder packaging config has zero CI signal.
  - [ ] `useVUMeter.ts` has no dedicated test.
  - [ ] `@types/node` is three majors ahead of CI's pinned Node version.
