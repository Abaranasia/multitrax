# Exploration: Reduce duplication across effect dialogs, engine setters, and test fixtures

Source: `doc/TODO.md` line 239, detailed in `doc/FUTURE-IMPROVEMENTS.md` § 1.

## Current State (verified against real source on `ref/duplication-code`)

**Dialog hooks** — all 5 confirmed with the exact shape described in the doc:
- `src/renderer/components/TrackPlayer/components/effects/filter/useFilterSettingsDialog.ts:1-54`
- `src/renderer/components/TrackPlayer/components/effects/distortion/useDistortionSettingsDialog.ts:1-49`
- `src/renderer/components/TrackPlayer/components/effects/delay/useDelaySettingsDialog.ts:1-69`
- `src/renderer/components/TrackPlayer/components/effects/reverb/useReverbSettingsDialog.ts:1-69`
- `src/renderer/components/TrackPlayer/components/fadeSettings/useFadeSettingsDialog.ts:1-40`

Each: `useState(false)` isOpen + one `useState` per field seeded from `state.X`; `open()` re-syncs every draft + opens; one-line `close()`; `apply()` calls exactly one `useAudio()` setter then closes. All 5 wired in `TrackPlayer.tsx:111-115` (the single consumer) and re-exported from `src/renderer/components/TrackPlayer/components/index.ts:3-12`.

**CSS — correction to the doc**: the shared shape is 5 files, not 4. `FadeSettingsDialog.css` (99 lines) is ~90% identical to the other 4 (117/107/107/117 lines) — same overlay/panel/title/field/label/value/actions rules, only missing the `--mix` accent rule (Fade has no mix field) and using a 30px vs 40px value column. Per-effect accent values are just slider-thumb color + apply-button bg/hover; Filter and Reverb additionally share an identical `-settings-select` rule for their dropdown.

**JSX**: confirmed identical overlay/panel/title/field/actions structure across all 5 dialog components, differing only in field count and the optional `<select>`.

**Triple-declared setter signatures — confirmed, plus a 4th call site not in the doc**:
1. `src/renderer/audio/AudioEngine.ts` — `setFilterSettings:494`, `setDistortionSettings:528`, `setDelaySettings:556`, `setReverbSettings:593` (param name `outputLevel`)
2. `src/renderer/context/audioContextInstance.ts:32-62` — `AudioContextValue` interface types (param name `output`)
3. `src/renderer/context/AudioContext.tsx:306-420` — `useCallback` implementations (param name `output`)
4. `src/renderer/context/AudioContext.tsx:102-132` (`duplicateTrack`) — a 4th, not-in-doc call site invoking all 4 setters positionally with a source track's full field list.

**`outputLevel`/`output` naming drift — confirmed cosmetic, not a live bug.** All 4 sites pass args positionally; TypeScript only checks types, so differing param *names* never cause a runtime mismatch. The real latent risk is that a future param reorder at any of the 4 sites would not be caught by the type checker (same-typed `number` params) — a duplication-driven risk, not a current bug.

**Clamp + node-wiring duplication** — confirmed: 24 occurrences of `Math.max(min, Math.min(max, x))` across the 4 setters (`AudioEngine.ts:494-625`), and 4 near-identical `_create<Effect>Nodes()` builders (`_createFilterNodes:674`, `_createDistortionNodes:717`, `_createDelayNodes:791`, `_createReverbNodes:846`), each wiring `dryGain`/`wetGain`→`outputGain` with identical init values. Fade has no node builder (duration-only).

**Test fixture duplication** — confirmed: identical `const mockAudioEngine = {...}` (20-33 `vi.fn()` stubs) copy-pasted verbatim in exactly 8 files: `DelaySettingsDialog.test.tsx`, `DistortionSettingsDialog.test.tsx`, `FilterSettingsDialog.test.tsx`, `ReverbSettingsDialog.test.tsx`, `FadeSettingsDialog.test.tsx`, `TrackPlayer.test.tsx`, `AudioContext.test.tsx`, `RecorderBar.test.tsx`. `Canvas.test.tsx`/`TrackContextMenu.test.tsx` do not use it. Fake Web Audio classes live only in `AudioEngine.test.ts` (tracked separately, out of scope unless widened).

**Project convention constraint** (`openspec/config.yaml`): "Component-scoped hooks are not unit-tested in isolation; test the owning component instead" — confirmed none of the 5 hooks have dedicated tests (codegraph flags "no covering tests found" for all 5); they're exercised only via `TrackPlayer.test.tsx`. A generic hook design must keep that integration suite green rather than adding new isolated hook tests.

## Affected Areas
- `src/renderer/components/TrackPlayer/components/effects/{filter,distortion,delay,reverb}/use*SettingsDialog.ts` + `fadeSettings/useFadeSettingsDialog.ts` — generic hook candidate
- `.../*SettingsDialog.css` (5 files) — shared CSS + `--effect-accent` candidate
- `.../*SettingsDialog.tsx` (5 files) — shared `<EffectDialog>`/`<SettingsField>` candidate
- `src/renderer/components/TrackPlayer/TrackPlayer.tsx` (single consumer, lines 111-115 + 327-393) and `components/index.ts` barrel — must be updated on any rename/consolidation
- `src/renderer/audio/AudioEngine.ts`, `src/renderer/context/audioContextInstance.ts`, `src/renderer/context/AudioContext.tsx` (2 sites) — setter signature consolidation
- 8 test files with duplicated `mockAudioEngine` stub — shared `src/__tests__/test-utils/` candidate

## Approaches

1. **Big-bang single change** — one coherent design touching all 6 areas at once.
   - Pros: no intermediate inconsistent state
   - Cons: estimated ~2000+ changed lines across ~25 files, guaranteed to blow the 400-line PR review budget, hard partial rollback
   - Effort: High

2. **Chained/stacked slices**, one deliverable unit per duplication point (test-utils → CSS → JSX component → generic hook → AudioEngine clamp/wiring → setter-signature consolidation last).
   - Pros: each slice independently reviewable under budget, clear rollback per slice, low-risk test-utils extraction de-risks every later slice
   - Cons: coordination overhead, needs a tracker/feature branch
   - Effort: Medium per slice, High overall

## Recommendation

Chained/stacked slices, matching this session's pre-selected delivery strategy (chained, stacked-to-main). Suggested order: test-utils extraction first (lowest risk, de-risks later diffs) → CSS → JSX → hook → AudioEngine clamp/wiring → setter-signature consolidation last (touches the most call sites).

## Risks

- Positional-arg setter signatures (4 sites per effect) are not type-checker-safe against reordering — worth flagging in design even if not fixed now.
- `TrackPlayer.tsx` + `components/index.ts` barrel are high fan-in points; any rename must update both.
- `outputLevel`/`output` drift is cosmetic only — do not treat as a bug fix, just fold into the signature-consolidation slice.
- No isolated hook tests exist (by convention); `TrackPlayer.test.tsx` is the main regression gate for hook consolidation.
- Scope is large — high probability of exceeding the 400-line PR budget if delivered as one change; tasks phase should forecast per-slice line counts.

## Ready for Proposal

Yes — scope and file:line references are confirmed against live source, with one correction to `doc/FUTURE-IMPROVEMENTS.md` §1 (Fade's CSS belongs in the shared-CSS set too, making it 5 files, not 4).
