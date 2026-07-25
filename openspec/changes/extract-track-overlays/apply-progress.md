# Apply Progress: Extract Track Overlays (Fade / Delay / Reverb)

**Batch**: 3 (merged with Batch 1+2 — Fade and Delay/Filter-dedup progress below is preserved unchanged)
**Slice**: PR1 — Fade Extraction (Phase 1) + PR2 — Delay Extraction + Filter Dedup (Phase 2) + PR3 — Reverb Extraction + Distortion Dedup (Phase 3) + Final Verification (Phase 4)
**Branch**: `feat/extract-reverb-dialog` (base: `feat/extract-delay-dialog`, base: `feat/extract-fade-dialog`, base: `ref/full-code-refactor`)
**Chain strategy**: feature-branch-chain (PR1 = Fade, PR2 = Delay + Filter dedup, PR3 = Reverb + Distortion dedup — FINAL)
**Mode**: Strict TDD

## Completed Tasks (Phase 1: Fade Extraction)

- [x] 1.1 Moved fade apply test out of `TrackPlayer.test.tsx` (~214-241) into new `FadeSettingsDialog.test.tsx`; added the approved parity cancel-draft test ("discards fade draft changes and does not call the engine when cancelled"). Ran `pnpm test:no-watch -- FadeSettingsDialog` first — confirmed RED (module resolution failure: `FadeSettingsDialog` did not exist).
- [x] 1.2 Created `useFadeSettingsDialog.ts` mirroring `useFilterSettingsDialog`: `isOpen/open/close/apply` + `draftFadeIn/draftFadeOut/draftSeekFade`; `apply()` calls `setFadeDurations(state.id, draftFadeIn, draftFadeOut, draftSeekFade)` then closes.
- [x] 1.3 Created `FadeSettingsDialog.tsx` + co-located `FadeSettingsDialog.css`, replicating the Filter template's overlay/panel/field/actions structure and backdrop-vs-panel click behavior. Local `fmt()` helper preserved inside the component to keep the exact `"5s"` / `"3.5s"` display formatting from the original inline markup (component contract per design.md has no `fmt` prop).
- [x] 1.4 Wired `TrackPlayer.tsx`: added `fadeDialog = useFadeSettingsDialog(state)`; rendered `{fadeDialog.isOpen && <FadeSettingsDialog .../>}`; added `${fadeDialog.isOpen ? ' track-player--fade-open' : ''}` to the card className computation (net-new class, approved Fade parity addition — no CSS rule needed since the requirement only mandates class presence and Fade's 3-field panel doesn't need the extra `min-height: 225px` used by the 4-5 field dialogs).
- [x] 1.5 Removed the dead inline fade block from `useTrackPlayer.ts` (state, `openSettings`/`applySettings` handlers, `setFadeDurations` destructure, and all associated return keys) and the inline fade markup + old test block from `TrackPlayer.tsx`/`TrackPlayer.test.tsx`. Also removed the now-dead `.fade-settings-*` rules from `TrackPlayer.css` (moved to `FadeSettingsDialog.css`), matching the precedent already established by the Filter/Distortion extractions. Ran `pnpm test:no-watch` full suite — GREEN (89/89 tests).

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1-1.3 (create dialog + hook) | `FadeSettingsDialog.test.tsx` written first, imports non-existent `FadeSettingsDialog` → suite failed with Vite "Failed to resolve import" error | Created `useFadeSettingsDialog.ts` + `FadeSettingsDialog.tsx` + `FadeSettingsDialog.css` → `pnpm test:no-watch -- FadeSettingsDialog` green (mock-clearing bug found and fixed: added `beforeEach(() => { cleanup(); vi.clearAllMocks(); })` in the integration describe block so the second integration test doesn't see the first test's recorded `setFadeDurations` call) | No further refactor needed — code mirrors the proven Filter template exactly |
| 1.4-1.5 (wire + remove dead code) | N/A (wiring/cleanup step, not new behavior) | Wired `TrackPlayer.tsx`, removed inline block from `useTrackPlayer.ts` + old test + dead CSS → full suite green (89/89) | N/A |

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `src/renderer/components/TrackPlayer/useFadeSettingsDialog.ts` | Created | State hook: `isOpen/open/close/apply` + 3 draft fields, seeds from live state on open, applies via `setFadeDurations` |
| `src/renderer/components/TrackPlayer/FadeSettingsDialog.tsx` | Created | Presentational dialog, props = 3 draft/setter pairs + `onApply`/`onCancel`, mirrors Filter template |
| `src/renderer/components/TrackPlayer/FadeSettingsDialog.css` | Created | Moved verbatim from the old inline `.fade-settings-*` rules in `TrackPlayer.css` |
| `src/__tests__/components/TrackPlayer/FadeSettingsDialog.test.tsx` | Created | Component tests (render/setters/apply-cancel/backdrop) + integration tests moved from `TrackPlayer.test.tsx` (apply + new cancel-draft test) |
| `src/renderer/components/TrackPlayer/TrackPlayer.tsx` | Modified | Wired `FadeSettingsDialog`/`useFadeSettingsDialog`; removed inline fade overlay markup and destructured fade keys; added `track-player--fade-open` class |
| `src/renderer/components/TrackPlayer/useTrackPlayer.ts` | Modified | Removed fade state/handlers/return keys and the `setFadeDurations` destructure (now consumed by the new hook instead) |
| `src/renderer/components/TrackPlayer/TrackPlayer.css` | Modified | Removed dead `.fade-settings-*` rules (moved to `FadeSettingsDialog.css`) |
| `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` | Modified | Removed the relocated fade apply test |
| `openspec/changes/extract-track-overlays/tasks.md` | Modified | Marked Phase 1 tasks 1.1-1.5 `[x]` |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch -- FadeSettingsDialog` → 15 test files run (14 unrelated + 1 target), 90 tests passed, 0 failed |
| Runtime harness command/scenario and exact result | N/A — no e2e/runtime harness in this project; covered by the component + `TrackPlayer` integration tests inside `FadeSettingsDialog.test.tsx` (real `AudioProvider` + mocked `AudioEngine`) |
| Rollback boundary | `git revert` this PR: drops `FadeSettingsDialog.{tsx,css}`, `useFadeSettingsDialog.ts`, `FadeSettingsDialog.test.tsx`; restores the inline fade block in `useTrackPlayer.ts`/`TrackPlayer.tsx`/`TrackPlayer.css` and the old `TrackPlayer.test.tsx` assertion. No other overlay (Delay/Reverb/Filter/Distortion) touched. |

## Full Verification (this batch)

- `pnpm test:no-watch` → **15 test files passed, 89/89 tests passed**
- `pnpm typecheck` → **clean** (`tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json` all pass)
- `pnpm lint` → **clean** (0 errors after adding the same `eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await` header already used by `TrackPlayer.test.tsx` for the identical mock-engine boilerplate pattern)

## Deviations from Design

- Design's File Changes table didn't explicitly list `TrackPlayer.css` as a file to modify, but the dead `.fade-settings-*` rules had to be removed from it (moved into `FadeSettingsDialog.css`) to match the precedent already set by the Filter/Distortion extractions (no leftover unused CSS in `TrackPlayer.css` after a dialog is extracted).
- No `min-height` CSS rule was added for `.track-player--fade-open` (unlike the `225px` rules for reverb/delay/filter/distortion). The Fade panel only has 3 fields (vs. 4-5 for the others) and fits within the card's natural height; the spec only requires the class's presence/absence in the DOM, not a specific style, so no rule was added to avoid an unrequested visual change.
- `FadeSettingsDialog.test.tsx` combines pure component tests (mirroring `FilterSettingsDialog.test.tsx`) with a nested `integration via TrackPlayer` describe block containing the moved apply test + new cancel test (rendering the real `TrackPlayer` + `AudioProvider` + mocked `AudioEngine`). This is a deliberate literal reading of task 1.1 ("move the fade apply test ... into the new file"), and it satisfies the spec's "No Duplicate Component Tests in TrackPlayer.test.tsx" end-state for Fade specifically, ahead of the Filter/Distortion cleanup that remains scoped to PR2/PR3.

## Issues Found

- Initial integration test draft leaked mock call state between the two `integration via TrackPlayer` tests (second test saw the first test's `setFadeDurations` call). Fixed with `beforeEach(() => { cleanup(); vi.clearAllMocks(); })` inside that describe block.

## Completed Tasks (Phase 2: Delay Extraction + Filter Dedup)

- [x] 2.1 Wrote `DelaySettingsDialog.test.tsx` (component tests mirroring `FilterSettingsDialog.test.tsx`/`FadeSettingsDialog.test.tsx` + an `integration via TrackPlayer` describe block containing the apply test and the cancel test moved from `TrackPlayer.test.tsx` ~289-336). Ran `pnpm test:no-watch -- DelaySettingsDialog` first — confirmed RED (Vite "Failed to resolve import" for the not-yet-created `DelaySettingsDialog` module).
- [x] 2.2 Created `useDelaySettingsDialog.ts` mirroring `useFilterSettingsDialog`/`useFadeSettingsDialog`: `isOpen/open/close/apply` + 5 draft fields (`draftDelayTime/Feedback/Mix/Damping/Output`); `apply()` calls `setDelaySettings(state.id, draftDelayTime, draftDelayFeedback, draftDelayMix, draftDelayDamping, draftDelayOutput)` then closes.
- [x] 2.3 Created `DelaySettingsDialog.tsx` + co-located `DelaySettingsDialog.css`, replicating the Filter template's overlay/panel/field/actions structure (field order Time/Feedback/Tone(damping)/Output/Mix, matching the pre-refactor inline markup exactly — no behavior change) and backdrop-vs-panel click behavior. Verified GREEN via `pnpm test:no-watch -- DelaySettingsDialog`.
- [x] 2.4 Wired `TrackPlayer.tsx`: added `delayDialog = useDelaySettingsDialog(state)`; rendered `{delayDialog.isOpen && <DelaySettingsDialog .../>}`; replaced the delay button's `onClick={openDelaySettings}` with `onClick={delayDialog.open}`; replaced the raw `delaySettingsOpen` boolean in the card's top-level className computation with `delayDialog.isOpen` for the `track-player--delay-open` class (the min-height CSS rule for that class already existed in `TrackPlayer.css` and needed no change — only the boolean source changed).
- [x] 2.5 Removed the dead inline delay block from `useTrackPlayer.ts` (state, `openDelaySettings`/`applyDelaySettings` handlers, `setDelaySettings` destructure, and all associated return keys), the inline delay markup from `TrackPlayer.tsx`, the old delay test block from `TrackPlayer.test.tsx`, and the dead `.delay-settings-*` rules from `TrackPlayer.css` (moved to `DelaySettingsDialog.css`). Ran `pnpm test:no-watch` — GREEN (93/93).
- [x] Filter test de-duplication: verified `FilterSettingsDialog.test.tsx` did **not** yet have equivalent coverage for the 3 leftover `TrackPlayer.test.tsx` duplicate tests (integration apply-through-engine, integration cancel-discard, and the `btn-filter--active` class test) — only component-level tests existed (render/setters/apply-cancel-click/backdrop). Per the "do NOT delete unique coverage" guard, relocated (not just deleted) these 3 tests into a new `integration via TrackPlayer` describe block inside `FilterSettingsDialog.test.tsx` (mirroring the pattern already established for Fade in PR1), confirmed they pass unchanged in their new home, THEN removed the 3 now-true-duplicates from `TrackPlayer.test.tsx`. Final suite: `TrackPlayer.test.tsx` no longer contains any Filter dialog assertions; `FilterSettingsDialog.test.tsx` is the sole owner (7 tests: 4 component-level + 3 integration).

## TDD Cycle Evidence (Phase 2)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1-2.3 (create Delay dialog + hook) | `DelaySettingsDialog.test.tsx` written first, imports non-existent `DelaySettingsDialog` → suite failed with Vite "Failed to resolve import" error | Created `useDelaySettingsDialog.ts` + `DelaySettingsDialog.tsx` + `DelaySettingsDialog.css` → `pnpm test:no-watch -- DelaySettingsDialog` green (16 test files, 95 tests; integration tests passed against the still-inline old markup since class names matched, then continued passing after wiring in 2.4) | No further refactor needed — code mirrors the proven Filter/Fade template exactly |
| 2.4-2.5 (wire + remove dead code) | N/A (wiring/cleanup step, not new behavior) | Wired `TrackPlayer.tsx`, removed inline block from `useTrackPlayer.ts` + old test + dead CSS → full suite green (93/93) | N/A |
| Filter dedup (approval-style test relocation) | N/A — no production behavior change; this is a test-location refactor | Added the 3-test `integration via TrackPlayer` block to `FilterSettingsDialog.test.tsx` first (approval test capturing existing behavior in its new home) → ran `pnpm test:no-watch -- FilterSettingsDialog` green (96 tests) BEFORE deleting the originals, then removed the 3 duplicates from `TrackPlayer.test.tsx` → full suite still green (93/93) | N/A |

### Test Summary (Phase 2)
- **Total tests written/relocated this batch**: 4 new Delay component tests + 2 Delay integration tests (moved) + 3 Filter integration/active-button tests (moved) = 9
- **Total tests passing (full suite)**: 93/93
- **Layers used**: Unit/Component (Delay: 4), Integration (Delay: 2, Filter: 3)
- **Approval tests** (refactoring): 3 (the relocated Filter integration + active-button tests — captured existing behavior in the new dedicated suite before removing the originals)
- **Pure functions created**: 0 (React hook + component only, consistent with Fade/Filter/Distortion precedent)

## Files Changed (Phase 2)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/renderer/components/TrackPlayer/useDelaySettingsDialog.ts` | Created | State hook: `isOpen/open/close/apply` + 5 draft fields, seeds from live state on open, applies via `setDelaySettings` |
| `src/renderer/components/TrackPlayer/DelaySettingsDialog.tsx` | Created | Presentational dialog, props = 5 draft/setter pairs + `onApply`/`onCancel`, mirrors Filter template (field order: Time/Feedback/Tone/Output/Mix) |
| `src/renderer/components/TrackPlayer/DelaySettingsDialog.css` | Created | Moved verbatim from the old inline `.delay-settings-*` rules in `TrackPlayer.css` |
| `src/__tests__/components/TrackPlayer/DelaySettingsDialog.test.tsx` | Created | Component tests (render/setters/apply-cancel/backdrop) + integration tests moved from `TrackPlayer.test.tsx` (apply + cancel) |
| `src/renderer/components/TrackPlayer/TrackPlayer.tsx` | Modified | Wired `DelaySettingsDialog`/`useDelaySettingsDialog`; removed inline delay overlay markup and destructured delay keys; switched `track-player--delay-open` class source from `delaySettingsOpen` to `delayDialog.isOpen` |
| `src/renderer/components/TrackPlayer/useTrackPlayer.ts` | Modified | Removed delay state/handlers/return keys and the `setDelaySettings` destructure (now consumed by the new hook instead) |
| `src/renderer/components/TrackPlayer/TrackPlayer.css` | Modified | Removed dead `.delay-settings-*` rules (moved to `DelaySettingsDialog.css`); the pre-existing `.track-player--delay-open { min-height: 225px }` rule at the top of the file was untouched (still correct — same class name, new boolean source) |
| `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` | Modified | Removed the relocated delay apply/cancel tests AND the 3 leftover Filter duplicate tests (integration apply, integration cancel, active-button) |
| `src/__tests__/components/TrackPlayer/FilterSettingsDialog.test.tsx` | Modified | Added the `mockAudioEngine`/`AudioProvider`/`TrackPlayer` integration scaffolding (mirroring Fade/Delay) plus an `integration via TrackPlayer` describe block with the 3 relocated tests (apply, cancel, active-button) |
| `openspec/changes/extract-track-overlays/tasks.md` | Modified | Marked Phase 2 tasks 2.1-2.5 `[x]` |

## Work Unit Evidence (Phase 2)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch -- Delay TrackPlayer` → 16 test files, 96 tests passed (intermediate, before Filter dedup); `pnpm test:no-watch -- FilterSettingsDialog` → 16 test files, 96 tests passed (after adding Filter integration block, before removing duplicates) |
| Runtime harness command/scenario and exact result | N/A — no e2e/runtime harness in this project; covered by the component + `TrackPlayer` integration tests inside `DelaySettingsDialog.test.tsx` and `FilterSettingsDialog.test.tsx` (real `AudioProvider` + mocked `AudioEngine`) |
| Rollback boundary | `git revert` the two Phase 2 commits (`fd952fa` extraction, `baa806c` Filter dedup) independently: reverting `fd952fa` drops `DelaySettingsDialog.{tsx,css}`, `useDelaySettingsDialog.ts`, `DelaySettingsDialog.test.tsx`, restores the inline delay block in `useTrackPlayer.ts`/`TrackPlayer.tsx`/`TrackPlayer.css` and the old `TrackPlayer.test.tsx` delay assertions; reverting `baa806c` restores the 3 Filter duplicate tests in `TrackPlayer.test.tsx` and drops the integration block from `FilterSettingsDialog.test.tsx`. Neither touches Reverb/Distortion. |

## Full Verification (Phase 2 batch, final committed state)

- `pnpm test:no-watch` → **16 test files passed, 93/93 tests passed**
- `pnpm typecheck` → **clean** (`tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json` all pass)
- `pnpm lint` → **clean** (0 errors)

## Deviations from Design (Phase 2)

- The task list literally said "remove ... leftover Filter dup tests" (implying pure deletion), but inspection showed `FilterSettingsDialog.test.tsx` did not yet have equivalent integration/active-button coverage — only component-level tests. To satisfy both the spec's "No Duplicate Component Tests in TrackPlayer.test.tsx" requirement AND its implicit "do not lose coverage" intent, the 3 tests were relocated (added to the dedicated suite, verified green, then removed from `TrackPlayer.test.tsx`) rather than deleted outright. This mirrors exactly what PR1 already did for Fade, and leaves `FilterSettingsDialog.test.tsx` as the sole, complete owner of Filter's dialog + active-button assertions — the stronger and more spec-faithful reading of "duplicate."
- No other deviations. `DelaySettingsDialog`'s field order in the JSX (Time, Feedback, Tone/Damping, Output, Mix) matches the pre-refactor inline markup exactly, preserving `no behavior change`.

## Issues Found (Phase 2)

None.

## Completed Tasks (Phase 3: Reverb Extraction + Distortion Dedup)

- [x] 3.1 Wrote `ReverbSettingsDialog.test.tsx` (component tests mirroring `FilterSettingsDialog.test.tsx`/`DelaySettingsDialog.test.tsx` + an `integration via TrackPlayer` describe block containing the apply test, the cancel test, and the "reverb button active only when reverbMix > 0" test moved from `TrackPlayer.test.tsx` ~214-287). Ran `pnpm test:no-watch -- ReverbSettingsDialog` first — confirmed RED (Vite "Failed to resolve import" for the not-yet-created `ReverbSettingsDialog` module). Safety net baseline before this change: 93/93 tests passing.
- [x] 3.2 Created `useReverbSettingsDialog.ts` mirroring `useDelaySettingsDialog`/`useFilterSettingsDialog`: `isOpen/open/close/apply` + 5 draft fields (`draftReverbRoom` typed `ReverbRoom`, `draftReverbMix/PreDelay/Damping/Output` typed `number`); `apply()` calls `setReverbSettings(state.id, draftReverbRoom, draftReverbMix, draftReverbPreDelay, draftReverbDamping, draftReverbOutput)` then closes.
- [x] 3.3 Created `ReverbSettingsDialog.tsx` + co-located `ReverbSettingsDialog.css`, replicating the Filter/Delay template's overlay/panel/field/actions structure (field order Room(select)/Pre-delay/Damping/Output/Mix, matching the pre-refactor inline markup exactly — no behavior change), preserving the Room field as a preset `<select>` (not a slider) with its 4 original options (Small Room/Hall/Plate/Cathedral), and the backdrop-vs-panel click behavior. Verified GREEN via `pnpm test:no-watch -- ReverbSettingsDialog` (100/100 tests — the moved integration tests passed even before wiring, since they exercised the still-inline `TrackPlayer` markup which shared identical class names).
- [x] 3.4 Wired `TrackPlayer.tsx`: added `reverbDialog = useReverbSettingsDialog(state)`; rendered `{reverbDialog.isOpen && <ReverbSettingsDialog .../>}`; replaced the reverb button's `onClick={openReverbSettings}` with `onClick={reverbDialog.open}`; replaced the raw `reverbSettingsOpen` boolean in the card's top-level className computation with `reverbDialog.isOpen` for the `track-player--reverb-open` class (the min-height CSS rule for that class already existed in `TrackPlayer.css` and needed no change — only the boolean source changed). The `btn-reverb--active` active-state logic (`state.reverbMix > 0`) was untouched — it lives on the button element itself, not inside the extracted dialog.
- [x] 3.5 Removed the dead inline reverb block from `useTrackPlayer.ts` (state, `openReverbSettings`/`applyReverbSettings` handlers, `setReverbSettings` destructure, and all associated return keys — also removed the now-unused `useState` import), the inline reverb overlay markup from `TrackPlayer.tsx` (and the now-unused `ReverbRoom` import there), the old reverb test block from `TrackPlayer.test.tsx`, and the dead `.reverb-settings-*` rules from `TrackPlayer.css` (moved to `ReverbSettingsDialog.css`). Also relocated the 3 leftover Distortion duplicate tests (integration apply-through-engine, integration cancel-discard, and the `btn-distortion--active` class test) into a new `integration via TrackPlayer` describe block inside `DistortionSettingsDialog.test.tsx` (mirroring the Filter/Fade precedent) — confirmed `DistortionSettingsDialog.test.tsx` did **not** yet have equivalent integration coverage (only component-level tests existed), so relocated-then-removed rather than deleted outright, per the "do NOT delete unique coverage" guard. Ran `pnpm test:no-watch` full suite — GREEN (97/97 tests).

## TDD Cycle Evidence (Phase 3)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.1-3.3 (create Reverb dialog + hook) | `ReverbSettingsDialog.test.tsx` written first, imports non-existent `ReverbSettingsDialog` → suite failed with Vite "Failed to resolve import" error | Created `useReverbSettingsDialog.ts` + `ReverbSettingsDialog.tsx` + `ReverbSettingsDialog.css` → `pnpm test:no-watch -- ReverbSettingsDialog` green (17 test files, 100 tests) | No further refactor needed — code mirrors the proven Filter/Delay template exactly, `draftReverbRoom` correctly typed as `ReverbRoom` (not `number`) per the design's explicit note |
| 3.4-3.5 (wire + remove dead code + Distortion dedup) | N/A (wiring/cleanup step, not new behavior); Distortion dedup is a test-location refactor, no production behavior change | Wired `TrackPlayer.tsx`, removed inline block from `useTrackPlayer.ts` (+ unused `useState`/`ReverbRoom` imports) + old test + dead CSS; added the 3-test `integration via TrackPlayer` block to `DistortionSettingsDialog.test.tsx` first (approval test capturing existing behavior in its new home) → ran `pnpm test:no-watch -- DistortionSettingsDialog` green BEFORE deleting the originals, then removed the 3 duplicates from `TrackPlayer.test.tsx` → full suite green (97/97) | N/A |

### Test Summary (Phase 3)
- **Total tests written/relocated this batch**: 4 new Reverb component tests + 3 Reverb integration tests (moved, incl. active-button) + 3 Distortion integration/active-button tests (moved) = 10
- **Total tests passing (full suite)**: 97/97
- **Layers used**: Unit/Component (Reverb: 4), Integration (Reverb: 3, Distortion: 3)
- **Approval tests** (refactoring): 3 (the relocated Distortion integration + active-button tests — captured existing behavior in the new dedicated suite before removing the originals)
- **Pure functions created**: 0 (React hook + component only, consistent with Fade/Delay/Filter/Distortion precedent)

## Files Changed (Phase 3)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/renderer/components/TrackPlayer/useReverbSettingsDialog.ts` | Created | State hook: `isOpen/open/close/apply` + 5 draft fields (`draftReverbRoom: ReverbRoom`, rest `number`), seeds from live state on open, applies via `setReverbSettings` |
| `src/renderer/components/TrackPlayer/ReverbSettingsDialog.tsx` | Created | Presentational dialog, props = 5 draft/setter pairs + `onApply`/`onCancel`, mirrors Filter/Delay template (field order: Room(select)/Pre-delay/Damping/Output/Mix) |
| `src/renderer/components/TrackPlayer/ReverbSettingsDialog.css` | Created | Moved verbatim from the old inline `.reverb-settings-*` rules in `TrackPlayer.css` |
| `src/__tests__/components/TrackPlayer/ReverbSettingsDialog.test.tsx` | Created | Component tests (render/setters/apply-cancel/backdrop) + integration tests moved from `TrackPlayer.test.tsx` (apply, cancel, active-button) |
| `src/renderer/components/TrackPlayer/TrackPlayer.tsx` | Modified | Wired `ReverbSettingsDialog`/`useReverbSettingsDialog`; removed inline reverb overlay markup, destructured reverb keys, and the now-unused `ReverbRoom` import; switched `track-player--reverb-open` class source from `reverbSettingsOpen` to `reverbDialog.isOpen` |
| `src/renderer/components/TrackPlayer/useTrackPlayer.ts` | Modified | Removed reverb state/handlers/return keys, the `setReverbSettings` destructure, and the now-unused `useState` import (now consumed by the new hook instead) |
| `src/renderer/components/TrackPlayer/TrackPlayer.css` | Modified | Removed dead `.reverb-settings-*` rules (moved to `ReverbSettingsDialog.css`); the pre-existing `.track-player--reverb-open { min-height: 225px }` rule was untouched (still correct — same class name, new boolean source) |
| `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` | Modified | Removed the relocated reverb apply/cancel/active-button tests AND the 3 leftover Distortion duplicate tests (integration apply, integration cancel, active-button) |
| `src/__tests__/components/TrackPlayer/DistortionSettingsDialog.test.tsx` | Modified | Added the `mockAudioEngine`/`AudioProvider`/`TrackPlayer` integration scaffolding (mirroring Fade/Delay/Filter) plus an `integration via TrackPlayer` describe block with the 3 relocated tests (apply, cancel, active-button) |
| `doc/TODO.md` | Modified | Checked off the "Extract per-track overlays/dialogs into independent components" item (lines 212-223) — all five overlays (Fade, Filter, Distortion, Delay, Reverb) are now independent components |
| `openspec/changes/extract-track-overlays/tasks.md` | Modified | Marked Phase 3 tasks 3.1-3.5 and Phase 4 tasks 4.1-4.4 `[x]` — all tasks in the change now complete |

## Work Unit Evidence (Phase 3)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch -- ReverbSettingsDialog` → 17 test files, 100 tests passed (intermediate, before Distortion dedup); `pnpm test:no-watch -- DistortionSettingsDialog` → 17 test files, 100 tests passed (after adding Distortion integration block, before removing duplicates) |
| Runtime harness command/scenario and exact result | N/A — no e2e/runtime harness in this project; covered by the component + `TrackPlayer` integration tests inside `ReverbSettingsDialog.test.tsx` and `DistortionSettingsDialog.test.tsx` (real `AudioProvider` + mocked `AudioEngine`) |
| Rollback boundary | `git revert` the Phase 3 commits independently: reverting the Reverb-extraction commit drops `ReverbSettingsDialog.{tsx,css}`, `useReverbSettingsDialog.ts`, `ReverbSettingsDialog.test.tsx`, restores the inline reverb block in `useTrackPlayer.ts`/`TrackPlayer.tsx`/`TrackPlayer.css` and the old `TrackPlayer.test.tsx` reverb assertions; reverting the Distortion-dedup commit restores the 3 Distortion duplicate tests in `TrackPlayer.test.tsx` and drops the integration block from `DistortionSettingsDialog.test.tsx`. Neither touches Fade/Delay/Filter. |

## Full Verification (Phase 3 batch, final committed state)

- `pnpm test:no-watch` → **17 test files passed, 97/97 tests passed**
- `pnpm typecheck` → **clean** (`tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json` all pass)
- `pnpm lint` → **clean** (0 errors after adding the same `eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await` header already used by the other dialog test files)
- `pnpm build` → **clean** (`build:renderer` via Vite succeeded; `build:main` via `tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json` succeeded)

## Deviations from Design (Phase 3)

- Same relocate-then-remove pattern applied to Distortion dedup as PR2 applied to Filter dedup: the task list said "remove ... leftover Distortion dup tests" (implying pure deletion), but `DistortionSettingsDialog.test.tsx` only had component-level tests, not integration/active-button coverage. Relocated first (added to the dedicated suite, verified green), then removed from `TrackPlayer.test.tsx` — preserving the stronger "do not lose coverage" reading of "duplicate" established in PR2.
- No other deviations. `draftReverbRoom` was correctly typed as `ReverbRoom` (not `number`) as explicitly called out in the design/instructions. `ReverbSettingsDialog`'s field order (Room, Pre-delay, Damping, Output, Mix) and the Room field's `<select>` control type (not a slider) match the pre-refactor inline markup exactly, preserving `no behavior change`.

## Issues Found (Phase 3)

None.

## Confirmed Final State (Phase 4 verification)

- `useTrackPlayer.ts` contains **zero** remaining inline dialog blocks — only `cardRef`, `fmt`, drag/progress/context-menu logic, and audio transport passthroughs remain.
- `TrackPlayer.test.tsx` contains **zero** per-dialog component assertions for any of the five dialogs (Fade, Filter, Distortion, Delay, Reverb) — confirmed via `rg` for `reverb-settings|distortion-settings|filter-settings|delay-settings|fade-settings` returning no matches in that file.
- `AudioContext.tsx` and `AudioEngine.ts` were **not modified** in any of the three PRs — `git status` across the full change shows no changes to either file; `setReverbSettings`/`setDelaySettings`/etc. were pre-existing engine methods consumed as-is.
- The audio effects chain order (`gainNode → filter → distortion → delay → reverb → pan → masterGain`) is untouched — verified via `codegraph_explore` reading the current `AudioEngine.addTrack` wiring, which is unchanged from before this SDD change began.

## Workload / PR Boundary

### PR1 (Fade) — completed, unchanged from Batch 1
- Mode: chained PR slice (feature-branch-chain onto `ref/full-code-refactor`)
- Current work unit: Unit 1 — Extract Fade dialog + parity (cancel test, `--fade-open` class)
- Boundary: starts from the inline fade block in `useTrackPlayer.ts`/`TrackPlayer.tsx`; ends with `FadeSettingsDialog` fully extracted, tested, and wired; Delay/Reverb untouched
- Estimated review budget impact: ~4 files created (~250 new lines incl. tests/CSS) + 4 files modified (net ~45 insertions / ~493 deletions, mostly deletions of moved code)

### PR2 (Delay + Filter dedup) — completed, unchanged from Batch 2
- Mode: chained PR slice (feature-branch-chain onto `feat/extract-fade-dialog`)
- Current work unit: Unit 2 — Extract Delay dialog + remove leftover Filter dup tests
- Boundary: starts from the inline delay block in `useTrackPlayer.ts`/`TrackPlayer.tsx` plus the 3 leftover Filter dup tests in `TrackPlayer.test.tsx`; ends with `DelaySettingsDialog` fully extracted/tested/wired and `TrackPlayer.test.tsx` free of all Filter dialog assertions; Reverb/Distortion untouched
- Estimated review budget impact: commit `fd952fa` (Delay extraction) = 8 files changed, 529 insertions(+), 313 deletions(-); commit `baa806c` (Filter dedup) = 2 files changed, 164 insertions(+), 77 deletions(-). Combined ≈ 1083 changed lines — above the single-PR 400-line guideline, consistent with the tasks.md forecast ("Delay ~480-560 incl. Filter dedup" was an underestimate; actual driven by the two new full-size test files + moved integration suites). This PR boundary was pre-approved by the orchestrator via forced `chained` delivery / `feature-branch-chain` strategy (PR2 of 3, stacked on PR1) before this apply batch started, so no further split was made — reported here for reviewer awareness.

### PR3 (Reverb + Distortion dedup, FINAL) — this batch
- Mode: chained PR slice (feature-branch-chain onto `feat/extract-delay-dialog`)
- Current work unit: Unit 3 — Extract Reverb dialog + remove leftover Distortion dup tests + final verification
- Boundary: starts from the inline reverb block in `useTrackPlayer.ts`/`TrackPlayer.tsx` plus the 3 leftover Distortion dup tests in `TrackPlayer.test.tsx`; ends with `ReverbSettingsDialog` fully extracted/tested/wired, `TrackPlayer.test.tsx` free of all per-dialog assertions (final state for all five overlays), `doc/TODO.md` checkbox checked, and full-suite verification (test/typecheck/lint/build) green. This is the FINAL slice — no further overlay work remains.
- Estimated review budget impact: commit `60fd85d` (Reverb extraction) = 8 files changed, 567 insertions(+), 360 deletions(-); commit `6bd6ac8` (Distortion dedup) = 2 files changed, 165 insertions(+), 76 deletions(-). Combined ≈ 1168 changed lines — above the single-PR 400-line guideline, consistent with the tasks.md forecast and the precedent set by PR2 (large diffs are driven by full-size dedicated test files + moved integration suites, not by production logic growth). This PR boundary was pre-approved by the orchestrator via forced `chained` delivery / `feature-branch-chain` strategy (PR3 of 3, final, stacked on PR2) before this apply batch started, so no further split was made — reported here for reviewer awareness.

## Status

20/20 tasks complete across all phases (5 Fade + 5 Delay/Filter-dedup + 5 Reverb/Distortion-dedup + 4 Final Verification + 1 workload-forecast row not itself a task). The `extract-track-overlays` change is now fully implemented: all five per-track overlays (Fade, Filter, Distortion, Delay, Reverb) are independent components with their own hook + CSS + dedicated test suite; `TrackPlayer.test.tsx` owns no per-dialog assertions; `useTrackPlayer.ts` has no remaining inline dialog blocks; `doc/TODO.md` lines 212-223 are checked off. Ready for orchestrator to hand off to `sdd-verify` for this final slice, then `sdd-archive` once verified.

## Engram Note

Engram was unavailable this session per the delegated instructions — this progress was persisted to OpenSpec (`apply-progress.md`) only, and `tasks.md` was updated with `[x]` marks directly on the filesystem. No `mem_save` call was attempted.
