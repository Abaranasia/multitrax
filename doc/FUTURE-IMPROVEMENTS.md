# Future Improvements — Code & Structural Refactor Proposals

Findings from a full-project refactor audit (audio engine/context layer, UI
component layer, and project structure/tooling), each entry backed by an actual
file:line reference. Grouped into five themes; each theme is tracked as its own
checklist item in `doc/TODO.md` → "Coding improvements" so they can be picked up
independently.

---

## 1. Duplication (highest payoff)

**Status: `[x]` DONE** — implemented as 6 stacked slices on
`ref/duplication-code` (`openspec/changes/reduce-effect-duplication/`); see
`apply-progress.md` for full TDD evidence per slice. Tracked in `doc/TODO.md`.
The "Shared test fixtures" bullet below was narrowed during exploration to
the `mockAudioEngine` stub only — the inline Fake Web Audio classes remain
out of scope for this item and stay tracked separately.

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

**Status: `[x]` DONE** — implemented on `ref/error-handling-gaps`
(`openspec/changes/error-handling-gaps/`), then archived to
`openspec/changes/archive/2026-07-26-error-handling-gaps/`. All 27 tasks
complete (Slices A/B/C fully implemented, B.10 and B.11 post-review fixes
included). 146/146 tests passing, typecheck/lint clean. One CRITICAL race
condition (overlapping-batch-import in Canvas layer) was discovered and
prototyped (148/148 tests validated) but reverted and deferred to a separate
follow-up change due to review-scope constraints. See `doc/TODO.md` "Guard
against overlapping Open-Files imports" item for the deferred fix.

- ~~**`_stopSource` swallows all errors**~~ — narrowed to only swallow the
  expected `InvalidStateError` (already-stopped); unexpected errors now logged
  distinctly via `console.error` instead of being hidden.

- ~~**No per-file error isolation on import**~~ — `addTracks` now wraps each
  file's decode/add cycle in a per-iteration try/catch; a corrupt file is
  logged and skipped, allowing other files in the batch to proceed; all
  successful files are retained.

- ~~**Unvalidated file-read IPC handler**~~ — `fs:readAudioFile` now enforces
  a session-scoped path allowlist populated by `dialog:openAudioFiles` (REPLACE
  semantics, not accumulate); both `readFileSync` and `writeFileSync` are
  wrapped in try/catch, rejecting cleanly on filesystem errors instead of
  crashing the main process or leaving IPC calls unresolved.

- ~~**Untested fade/loop scheduling**~~ — introduced `vi.useFakeTimers()` test
  infrastructure; added direct coverage for `_playLoopWithFade`,
  `_startFadeOut`, `_cancelFadeOut`, `setLoop`, `setFadeIn`, `setFadeOut`,
  `setSeekFade`, and `getRecordingStream` — 9 new tests (189 lines, test-only,
  zero production behavior change).

## 3. Naming / consistency

**Status: `[x]` DONE** — implemented on `ref/standardize-naming`
(`openspec/changes/standardize-naming/`); see `apply-progress.md` for full
TDD evidence. All 15 tasks complete (15/15). Full suite passes (129/129 tests),
typecheck clean (0 errors). All 3 ADDED spec requirements verified compliant
with 6/6 scenarios passing.

The `mix` parameter position bullet was already resolved by
`reduce-effect-duplication` (all four setters now have `mix` as the 4th
parameter) and was correctly marked out of scope in the proposal; therefore
it is not re-implemented here.

- ~~**`outputLevel` vs. `output`**~~ — renamed to canonical `output` across all
  4 internal per-track node interfaces (FilterNodes, DistortionNodes,
  DelayNodes, ReverbNodes) in `AudioEngine.ts`, matching the name already used
  at every other layer.

- ~~**Non-parallel setter signatures**~~ — the `mix` parameter position is
  already consistent (4th parameter for all four effect setters) as a result of
  `reduce-effect-duplication`.

- ~~**Un-named magic numbers**~~ — extracted as `PARAM_RAMP_TIME_CONSTANT_S =
  0.01` (22 call sites), `REVERB_PREDELAY_MAX_MS = 500`, and
  `FADE_DURATION_MAX_S = 10`, following the existing `DELAY_TIME_MAX_MS` /
  `DAMPING_MIN_HZ` pattern.

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
