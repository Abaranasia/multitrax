# Future Improvements — Code & Structural Refactor Proposals

Findings from a full-project refactor audit (audio engine/context layer, UI
component layer, and project structure/tooling), each entry backed by an actual
file:line reference. Grouped into five themes; each theme is tracked as its own
checklist item in `doc/TODO.md` → "Coding improvements" so they can be picked up
independently.

---

## 1. Duplication (highest payoff)

- **Shared `useEffectDialog<T>` hook** — `useFilterSettingsDialog.ts:6-54`,
  `useDistortionSettingsDialog.ts:6-49`, `useDelaySettingsDialog.ts:6-69`,
  `useReverbSettingsDialog.ts:6-69`, and `fadeSettings/useFadeSettingsDialog.ts:6-40`
  all share the exact same shape: `useState(false)` for `isOpen` + one `useState`
  per field seeded from `state.X`, an `open()` that re-syncs every draft from
  props, a one-line `close()`, and an `apply()` that calls one `useAudio()`
  setter with the draft values then closes. Extract a generic
  `useSettingsDialog<TDraft>(initial, onApply)` returning
  `{isOpen, draft, setDraft, open, close, apply}` — collapses ~260 lines into a
  handful of one-line call sites.

- **Shared effect-dialog CSS** — `FilterSettingsDialog.css`,
  `DistortionSettingsDialog.css`, `DelaySettingsDialog.css`,
  `ReverbSettingsDialog.css` (~107-117 lines each) share overlay/panel/field/
  label/value/actions rules verbatim; only the slider-thumb color (`#3b82f6` /
  `#3b82f6` / `#f59e0b` / `#2dd4bf`) and apply-button color differ. Consolidate
  into one shared `effect-dialog.css` with a CSS custom property (e.g.
  `--effect-accent`) for the per-effect override — removes ~400 duplicated lines.

- **Shared `<EffectDialog>` / `<SettingsField>` component** —
  `FilterSettingsDialog.tsx:20-119` and `DistortionSettingsDialog.tsx:16-102`
  (and, by extension, Delay/Reverb) share the same overlay/panel/title/field/
  actions JSX structure, differing only in field count and one `<select>`
  (Filter/Reverb have a type/room dropdown). A generic
  `<EffectDialog fields={...} onApply/onCancel>` renderer, or at minimum a
  shared `<SettingsField>` presentational component, removes most repeated markup.

- **Triple-declared effect setter signatures** — each effect setter's full
  parameter list is declared three times: once in `AudioEngine.ts` (e.g.
  `setFilterSettings` at line 494), once as a type in
  `audioContextInstance.ts:32-62`, and once again in the `useCallback`
  implementation in `AudioContext.tsx:306-420`. This is the root cause of the
  `outputLevel`/`output` naming drift tracked under Naming/consistency below —
  adding or renaming a param currently requires editing 3 files in lockstep.

- **`clamp()` + shared dry/wet/output node builder** — `AudioEngine.ts:494-625`
  (the four setters) each inline `Math.max(min, Math.min(max, x))` clamps before
  applying via `setTargetAtTime`; `AudioEngine.ts:674-889` (the four
  `_create<Effect>Nodes` builders) each hand-wire `dryGain`/`wetGain`/
  `outputGain` with identical initial values. A shared `clamp(v, min, max)`
  helper and a `_createDryWetOutput()` factory would remove both sets of
  duplication.

- **Shared test fixtures** — beyond the inline `FakeGain`/`FakeSource`/
  `FakeAudioParam`/`FakeAudioContext` classes in `AudioEngine.test.ts` (already
  tracked in `doc/TODO.md`), the same `mockAudioEngine` stub object (20+
  `vi.fn()` stubs) is copy-pasted verbatim across at least 8 test files:
  `DelaySettingsDialog.test.tsx`, `DistortionSettingsDialog.test.tsx`,
  `FilterSettingsDialog.test.tsx`, `ReverbSettingsDialog.test.tsx`,
  `FadeSettingsDialog.test.tsx`, `TrackPlayer.test.tsx`, `AudioContext.test.tsx`,
  `RecorderBar.test.tsx`. Extract both the fake node classes and the
  `mockAudioEngine` factory into one shared `src/__tests__/test-utils/` module.

## 2. Correctness / robustness

- **`_stopSource` swallows all errors** — `AudioEngine.ts:912-922` — catches
  *any* error from `sourceNode.stop()` via `console.warn`, not just the expected
  "already stopped" case, so a genuine failure is silently hidden.

- **No per-file error isolation on import** — `AudioContext.tsx:22` — the batch
  `decodeAudioData` loop over multiple dropped/selected files has no try/catch
  per file; one corrupt file throws and aborts processing of every subsequent
  file in the batch with no user feedback.

- **Unvalidated file-read IPC handler** — `src/main/main.ts:82-86` —
  `fs:readAudioFile` resolves and reads whatever path the renderer sends, with
  no check that it originated from the `dialog:openAudioFiles` result; since
  `contextBridge` exposes `readAudioFile(filePath)` directly, a compromised
  renderer gets an arbitrary-file-read primitive. Also, `main.ts:76,84` has no
  try/catch around the synchronous `fs.readFileSync`/`writeFileSync` calls.

- **Untested fade/loop scheduling** — `_playLoopWithFade` (`AudioEngine.ts:936-990`)
  and `_startFadeOut`/`_cancelFadeOut` (`:993-1016`) — ~80 lines of nontrivial
  gain-ramp scheduling — have zero test coverage, as do `setLoop`, `setFadeIn`,
  `setFadeOut`, `setSeekFade`, `setFadeDurations`, and `getRecordingStream`.

## 3. Naming / consistency

- **`outputLevel` vs. `output`** — the same field is named `outputLevel` in
  `AudioEngine.ts` (all 4 effect interfaces/setters, e.g. lines 500, 528, 562,
  599) but `output` in the context layer (`audioContextInstance.ts:38,46,54,61`
  and `AudioContext.tsx:313,344,375,400`).

- **Non-parallel setter signatures** — the `mix` parameter's position varies
  across the four effect setters: 4th for `setFilterSettings`, 3rd for
  `setDistortionSettings`/`setDelaySettings`, 2nd for `setReverbSettings`. Easy
  to miscall positionally when maintaining more than one effect at a time.

- **Un-named magic numbers** — the `0.01` `setTargetAtTime` ramp time-constant
  is repeated ~20 times with no named constant (unlike `DAMPING_MIN_HZ`/
  `DAMPING_MAX_HZ`, which are already shared). Reverb's preDelay clamp
  (`AudioEngine.ts:608`) and the fade-duration clamps (`:487-489`) use inline
  `500`/`10` instead of named constants like the existing `DELAY_TIME_MAX_MS`.

## 4. Structural

- **`AudioEngine.ts` god-file risk** — 1017 lines covering track lifecycle,
  playback/pause/seek/loop-with-fade scheduling, recording export, and all 4
  effect inserts (~400 lines, roughly `:492-889`). The effect-insert logic is
  self-contained enough to extract into per-effect modules (e.g. `FilterInsert`,
  `DistortionInsert`) exposing `create()`/`apply()`, shrinking this file by
  ~40% and allowing each effect to be unit-tested independently.

- **`TrackPlayer.tsx` complexity** — 419 lines, 8 hook calls (`useTrackPlayer`
  plus 5 settings-dialog hooks plus `useRef`/`useEffect`), and 5 conditionally
  rendered dialog overlays inline (`:326-407`). Extract the waveform-canvas
  `useEffect` into a `useWaveformCanvas` hook, and/or wrap the 5 dialogs into a
  small `<EffectDialogs>` component to shrink the main component's JSX.

- **Inline styles vs. `doc/CSS-CONVENTIONS.md`** — that doc states "No inline
  styles in JSX — use CSS classes instead," but `TrackPlayer.tsx` computes full
  gradient strings inline for the pan slider (`:294-301`) and volume slider
  (`:317-319`). Move to CSS custom properties (e.g. `style={{ '--pan': ... }}`)
  with the gradient itself defined in `TrackPlayer.css`.

## 5. Housekeeping

- **`doc/as commented in the resilient forest.md`** — a stale, oddly-named
  70-line implementation-notes file for the Filter effect, which is now marked
  `[x]` implemented in `doc/TODO.md` and superseded by `doc/DEVLOG.md`.
  Candidate for deletion.

- **`doc/templates/Audio UI modernization project/`** — a ~66KB unrelated
  design-mockup bundle (`support.js`, `Multitrack Redesign.dc.html`, a
  `.thumbnail` binary). Confirmed via repo-wide grep that nothing in `src/`
  references it — it's a standalone design prototype, not build output, just
  confusingly placed under `doc/` next to markdown specs. Move to a clearly
  labeled `doc/mockups/` folder or add a short README noting it's non-runtime.

- **Unused `tsx` devDependency** — `package.json:73` — not referenced by any
  script; confirm intended use or remove.

- **`pnpm test` defaults to watch mode** — `package.json:15` — `"test": "vitest
  watch"` with a separate `test:no-watch` for single-run, inverted from the
  common CI convention. Low risk since the non-watch variant exists, but worth
  flagging as a footgun for anyone running `pnpm test` expecting a single pass.
