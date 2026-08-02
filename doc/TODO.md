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

- [ ] **Reveal file in explorer** — add a new option in `TrackContextMenu`
  to open the selected track's source file in the OS file explorer / finder,
  using the existing file path information already available for each track.

- [ ] **Mute by clicking the volume icon** — make the volume icon in each
  track card toggle mute/unmute for that track when clicked, using the
  existing per-track volume state and setter flow.

- [ ] **Save / Load session** — persist the current set of tracks to an
  external file so the whole setup (which files are loaded, their canvas
  position, and their per-track settings) can be restored later. Would need a
  serialisable snapshot of each `TrackEntry`/`TrackState` — file path (not the
  raw audio, so the session file stays small), volume, loop, fade in/out/seek
  settings and durations, plus reverb/delay parameters — written as JSON via a
  new IPC save/open-dialog pair in `main.ts` (mirroring the existing
  open-audio-files / save-recording handlers). Loading would re-resolve each
  stored file path, re-decode it through `addTracks`, then re-apply the saved
  settings via the existing per-track setters. Missing/moved source files
  would need a clear "file not found" fallback per track rather than failing
  the whole load.

- [ ] **Dashboard track-view reorganization** — add a dashboard-level action to
  reorganize the visible track views in a consistent layout, such as aligning
  cards by size, spacing, or a predictable grid/order when the user requests it.
  This should help reduce visual clutter when many tracks are loaded.

- [ ] **Mixer-style vertical track view** — add a second view mode that displays
  track information in a vertical, console-like layout with one track per row,
  making it easier to compare levels, mute/solo states, and per-track controls
  at a glance.

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

- [ ] **Guard against overlapping Open-Files imports.** A race condition was
  discovered during the error-handling-gaps change review (review-resilience
  lens, corroborated by refuter): a second "Open Files" click while a first
  batch's IPC reads are still in flight wipes the session-scoped `grantedPaths`
  allowlist mid-flight, causing the first batch's still-pending `readAudioFile`
  IPC calls to reject with "Access denied", silently discarding every
  already-read file in that batch with zero UI feedback (unhandled promise
  rejection). The fix is a busy-guard on `onOpenFiles` (useRef checked
  synchronously, prevents re-invocation while in-flight) + disabled state on
  the "+ Open Files" button in Canvas.tsx while a batch is in flight
  (mirroring RecorderBar.tsx's `disabled={isSaving}` pattern). A working
  prototype was implemented and independently validated (148/148 tests) during
  error-handling-gaps; see apply-progress narrative and B.12 task for the
  exact approach. Reverted from error-handling-gaps to keep review scope clean
  (Canvas files were not in the originally-reviewed diff); pick up as a new
  SDD change with its own stacked-PR scope (Canvas.tsx / useCanvas.ts /
  Canvas.test.tsx only).

- [ ] **Split up oversized files and remove inline styles.** Full detail in
  `doc/FUTURE-IMPROVEMENTS.md` § 4.
  - Extract the ~400 lines of effect-insert logic in `AudioEngine.ts` into
    per-effect modules.
  - Extract `TrackPlayer.tsx`'s waveform-canvas `useEffect` into a
    `useWaveformCanvas` hook, and wrap its 5 conditional dialog overlays into
    an `<EffectDialogs>` component.
  - Replace `TrackPlayer.tsx`'s inline pan/volume slider gradients with CSS
    custom properties, per `doc/CSS-CONVENTIONS.md`'s no-inline-styles rule.

- [ ] **Repo housekeeping.** Full detail in `doc/FUTURE-IMPROVEMENTS.md` § 5.
  - Delete or archive the stale `doc/as commented in the resilient forest.md`.
  - Relocate `doc/templates/Audio UI modernization project/` (an unreferenced
    design-mockup bundle) out of `doc/`'s spec-document space, or add a
    clarifying README.
  - Remove the unused `tsx` devDependency, or confirm it's needed.
  - Reconsider `pnpm test` defaulting to watch mode.
