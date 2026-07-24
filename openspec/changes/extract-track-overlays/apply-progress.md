# Apply Progress: Extract Track Overlays (Fade / Delay / Reverb)

**Batch**: 1 (first apply — no prior progress to merge)
**Slice**: PR1 — Fade Extraction (Phase 1 only)
**Branch**: `feat/extract-fade-dialog` (base: `ref/full-code-refactor`)
**Chain strategy**: feature-branch-chain (this is PR1 of 3; PR2 = Delay, PR3 = Reverb)
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

## Remaining Tasks (out of scope for this batch)

- [ ] Phase 2: Delay Extraction + Filter Dedup (PR2, base = this branch)
- [ ] Phase 3: Reverb Extraction + Distortion Dedup (PR3, base = PR2 branch)
- [ ] Phase 4: Final Verification (after PR3)
- [ ] `doc/TODO.md` lines 212-223 checkbox (task 4.4, deferred to Phase 4 final verification)

## Workload / PR Boundary

- Mode: chained PR slice (feature-branch-chain onto `ref/full-code-refactor`)
- Current work unit: Unit 1 — Extract Fade dialog + parity (cancel test, `--fade-open` class)
- Boundary: starts from the inline fade block in `useTrackPlayer.ts`/`TrackPlayer.tsx`; ends with `FadeSettingsDialog` fully extracted, tested, and wired; Delay/Reverb untouched
- Estimated review budget impact: ~4 files created (~250 new lines incl. tests/CSS) + 4 files modified (net ~45 insertions / ~493 deletions, mostly deletions of moved code) — well within the single-PR budget for this slice per the tasks.md forecast (~350-400 lines for Fade)

## Status

5/5 Phase 1 tasks complete (5/20 total tasks across all phases). Ready for orchestrator to hand off to `sdd-verify` for this slice, then continue with PR2 (Delay) apply batch.

## Engram Note

Engram was unavailable this session per the delegated instructions — this progress was persisted to OpenSpec (`apply-progress.md`) only, and `tasks.md` was updated with `[x]` marks directly on the filesystem. No `mem_save` call was attempted.
