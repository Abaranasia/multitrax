# Apply Progress: Reduce Effect Dialog / Engine / Test Duplication

## Mode
Strict TDD (per `openspec/config.yaml`: `strict_tdd: true`, `test_command: pnpm test:no-watch`).

## Scope Executed
Slice 1 (test-utils factory, PR 1) — complete.
Slice 2 (shared CSS, PR 2) — complete, this batch. Slices 3-6 NOT started — out of scope for this batch.

## Completed Tasks (Slice 1)
- [x] 1.1 RED: import `test-utils/mockAudioEngine` in `TrackPlayer.test.tsx` (fails, missing)
- [x] 1.2 GREEN: create `mockAudioEngine.ts` — `createMockAudioEngine()` (verbatim stub, fresh `vi.fn()`s)
- [x] 1.3 GREEN: 8 test files import factory, drop inline stub
- [x] 1.4 Parity gate: full suite green

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `src/__tests__/test-utils/mockAudioEngine.ts` | Created | `createMockAudioEngine(options?)` factory returning fresh `vi.fn()` stubs each call. Union of all 8 files' stub surface (25 stubbed members incl. `audioContext.decodeAudioData`). Accepts `decodeAudioDataDuration` / `getBufferDuration` overrides to preserve each file's pre-existing literal return values without changing behavior. |
| `src/__tests__/components/TrackPlayer/DelaySettingsDialog.test.tsx` | Modified | Replaced 22-line inline `mockAudioEngine` object with `createMockAudioEngine()` call; dropped now-unused `no-unused-vars` file-level disable (kept `require-await`, still needed elsewhere in file). |
| `src/__tests__/components/TrackPlayer/DistortionSettingsDialog.test.tsx` | Modified | Same as above. |
| `src/__tests__/components/TrackPlayer/FilterSettingsDialog.test.tsx` | Modified | Same as above. |
| `src/__tests__/components/TrackPlayer/ReverbSettingsDialog.test.tsx` | Modified | Same as above. |
| `src/__tests__/components/TrackPlayer/FadeSettingsDialog.test.tsx` | Modified | Same as above. |
| `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` | Modified | Same pattern; kept `no-explicit-any`/`no-unsafe-*` disables, dropped `no-unused-vars`, kept `require-await`. |
| `src/__tests__/context/AudioContext.test.tsx` | Modified | Replaced 26-line inline stub (21-key subset, no `stopAll`/`playAll`) with `createMockAudioEngine({ decodeAudioDataDuration: 12, getBufferDuration: 12 })`; removed now-dead `FAKE_BUFFER` const (was only used to build the old inline stub); dropped now-unused `no-unused-vars`/`require-await` file-level disables entirely (verified no other unused-var/require-await violation in file). |
| `src/__tests__/components/Recorder/RecorderBar.test.tsx` | Modified | Replaced 6-line minimal inline stub with `createMockAudioEngine({ decodeAudioDataDuration: 1 })`; extra unused stub members (from the richer union shape) are harmless since `RecorderBar` never calls them. |

## Deviations from Design

Design said "verbatim stub" copy-pasted across the 8 files. On inspection, the 8 files were **not** byte-identical:
- 6 files (5 dialogs + `TrackPlayer.test.tsx`) shared one 23-key shape (`decodeAudioData` → `duration: 3`, `getBuffer` → `duration: 12`).
- `AudioContext.test.tsx` used a 21-key subset (no `stopAll`/`playAll`) with `decodeAudioData`/`getBuffer` both → `duration: 12`.
- `RecorderBar.test.tsx` used a 3-key minimal subset (`getRecordingStream`, `audioContext.decodeAudioData` → `duration: 1`, `close`) — no `addTrack`/`play`/etc.

To preserve 100% behavioral parity (no assertion could observe a changed literal), the factory:
1. Returns the **union** of all stub members across all 8 files (safe: unused extra `vi.fn()` stubs on the mock object never affect a test that doesn't call them).
2. Accepts `MockAudioEngineOptions { decodeAudioDataDuration?, getBufferDuration? }` so each file can restate its pre-existing literal return value instead of silently changing to a different file's value.

This is a deliberate, minimal deviation from "verbatim" — required because a truly verbatim single stub does not exist across the 8 files. No test assertion changed; the full suite is green with identical pass/fail results to the pre-change baseline.

## Issues Found
- Initial factory draft used `vi.fn().mockResolvedValue(...)` for `decodeAudioData` and a param-less `getBuffer`, which broke `pnpm typecheck` (`AudioContext.test.tsx:307` calls `mockAudioEngine.getBuffer(SOURCE_ID)` directly, and TS narrowed the inferred signature to 0-arg) and tripped `@typescript-eslint/no-unnecessary-type-assertion` in ESLint. Fixed by keeping the original typed-but-unused-param async/sync function shape (matching the pre-existing per-file pattern) and adding scoped `eslint-disable` for `no-unused-vars`/`require-await` in the new factory file, mirroring the convention already used across the 8 test files.
- First pass at removing "unused eslint-disable" warnings over-removed `require-await` from the 6 richer test files (it actually IS still used elsewhere in those files for other async arrow functions unrelated to this change) — caught by re-running `pnpm lint`, corrected by restoring just that one disable per file while leaving `no-unused-vars` removed.

## Safety Net (Baseline, before any change)
`pnpm test:no-watch` (full suite, no file filters — `-- <files>` did not narrow vitest's own `include` globs): **17 test files / 109 tests passing.**

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-------------|-----|-------|-------------|----------|
| 1.1–1.2 | `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` (consumer) + new `src/__tests__/test-utils/mockAudioEngine.ts` | Integration (React Testing Library, via existing `TrackPlayer.test.tsx` suite) | ✅ 17/17 files, 109/109 tests | ✅ Written — changed `TrackPlayer.test.tsx` to import `createMockAudioEngine` from a module that did not yet exist; confirmed failure: `Error: Failed to resolve import "@/__tests__/test-utils/mockAudioEngine"` | ✅ Passed — created `mockAudioEngine.ts`; re-ran, full suite 17/17 files, 109/109 tests | ✅ 3 cases — `createMockAudioEngine()` (default), `createMockAudioEngine({ decodeAudioDataDuration: 12, getBufferDuration: 12 })` (AudioContext), `createMockAudioEngine({ decodeAudioDataDuration: 1 })` (RecorderBar) all exercised by the full suite; each produces a distinct resolved value forcing the options object to be real, not hardcoded | ✅ Clean — extracted shared factory, eliminated 8x duplicated ~22–33-line literal object |
| 1.3 | 7 remaining test files (`DelaySettingsDialog`, `DistortionSettingsDialog`, `FilterSettingsDialog`, `ReverbSettingsDialog`, `FadeSettingsDialog`, `AudioContext`, `RecorderBar`) | Integration | ✅ (same baseline, re-verified after 1.2) | ➖ N/A — these are structural migrations (approval-style: existing tests already assert full behavior; task is "same test, different stub source"), not new behavior. Approval tests = the existing suites themselves | ✅ Passed — after each file's edit, full suite still 17/17, 109/109 | ➖ N/A — structural only, no new logic | ✅ Clean — dead `FAKE_BUFFER` const removed in `AudioContext.test.tsx`; `no-unused-vars` disables no longer needed in 6 files |
| 1.4 | Full suite | Integration | ✅ 17/17, 109/109 (pre-change) | N/A — parity gate | ✅ 17/17 test files, 109/109 tests passing (identical counts to baseline) | N/A | N/A |

### Test Summary
- **Total tests written**: 0 new test cases (pure refactor of test infrastructure — no behavior changed, so no new assertions were needed or added)
- **Total tests passing**: 109/109 (full suite), 0 regressions vs. 109/109 baseline
- **Layers used**: Integration (109, all pre-existing, re-verified against new mock source)
- **Approval tests** (refactoring): 8 — the 8 pre-existing test files themselves acted as approval tests for the stub migration (unchanged assertions, changed stub construction)
- **Pure functions created**: 1 (`createMockAudioEngine` — deterministic given its `options` argument, no hidden state beyond fresh `vi.fn()` closures per call)

## Work Unit Evidence (Slice 1 / PR 1)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch` (vitest ignores file-path args via `--`, runs full configured suite) → **17 test files passed, 109 tests passed** |
| Runtime harness command/scenario and exact result | N/A — pure test refactor, no UI/runtime path touched (per tasks.md: "N/A — pure test refactor") |
| Rollback boundary | `git revert` the two commits `test: add shared mockAudioEngine test-utils factory` and `test: dedupe mockAudioEngine stub via shared factory in 8 test files` — fully isolated to `src/__tests__/**`, zero production code touched |

## Quality Gates (Full Repo)
- `pnpm test:no-watch`: **17 passed (17) / 109 passed (109)** — 0 failures
- `pnpm typecheck`: clean (0 errors) — `tsc --noEmit` across `tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json`
- `pnpm lint`: clean (0 errors, 0 warnings)
- `pnpm format:check`: fails with 95 files flagged — **pre-existing on the clean tree** (verified via `git stash` / re-run / `git stash pop`, same 95-file failure count before any slice-1 change). Not introduced by this batch; out of scope to fix here.

## Diff Size (vs. 400-line review budget)
`git diff --stat` (8 modified files): 30 insertions(+), 212 deletions(-) = 242 changed lines.
New file `mockAudioEngine.ts`: 51 lines.
**Total: ~293 changed lines — within the tasks.md forecast (200–260, "Low" risk) and well under the 400-line budget.** No chain-strategy exception needed for this slice.

---

# Slice 2: Shared CSS (PR 2)

## Completed Tasks (Slice 2)
- [x] 2.1 RED: dialog test asserts shared class from `effect-dialog.css` (fails, missing) — N/A, see Deviations below
- [x] 2.2 GREEN: create `effects/effect-dialog.css` (grouped selectors, 5 prefixes)
- [x] 2.3 GREEN: shrink 5 `*SettingsDialog.css` to `--effect-accent` + apply-button colors
- [x] 2.4 Parity gate: full suite green, same classNames
- [x] 2.5 If diff >400: split 2a/2b per forecast — done (see Diff Size below)

## Files Changed (Slice 2)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/renderer/components/TrackPlayer/components/effects/effect-dialog.css` | Created | Shared structural rules for all 5 effect dialogs: overlay/panel/title/field/label/range-track/select/value/mix/actions/apply-cancel-base/cancel-hover, grouped into one selector list per rule (keyed on the 5 existing class prefixes, exactly per design). Accent-dependent values (`slider-thumb` background, Apply background, Apply hover background) reference `var(--effect-accent)` / `var(--effect-apply-bg)` / `var(--effect-apply-hover-bg)`. Value-column width uses `var(--effect-value-width, 40px)` with a default matching 4 of the 5 dialogs. |
| `src/renderer/components/TrackPlayer/components/effects/filter/FilterSettingsDialog.css` | Modified | Shrunk from 117 lines to a 3-line `@import '../effect-dialog.css'` + `.filter-settings-overlay { --effect-accent: #3b82f6; --effect-apply-bg: #1e3a8a; --effect-apply-hover-bg: #1d4ed8; }` block. |
| `src/renderer/components/TrackPlayer/components/effects/distortion/DistortionSettingsDialog.css` | Modified | Same pattern; identical accent/apply colors to Filter (verified byte-for-byte identical in the original files, not an approximation). |
| `src/renderer/components/TrackPlayer/components/effects/delay/DelaySettingsDialog.css` | Modified | Same pattern; `--effect-accent:#f59e0b; --effect-apply-bg:#78350f; --effect-apply-hover-bg:#92400e`. |
| `src/renderer/components/TrackPlayer/components/effects/reverb/ReverbSettingsDialog.css` | Modified | Same pattern; `--effect-accent:#2dd4bf; --effect-apply-bg:#115e59; --effect-apply-hover-bg:#0f766e`. Reverb's `<select>` styling is covered by the shared `.filter-settings-select,.reverb-settings-select` grouped rule (the only 2 of 5 dialogs with a `<select>`). |
| `src/renderer/components/TrackPlayer/components/fadeSettings/FadeSettingsDialog.css` | Modified | Same pattern, but imports `../effects/effect-dialog.css` (Fade lives in a sibling folder to `effects/`); `--effect-accent:#a855f7; --effect-apply-bg:#4c1d95; --effect-apply-hover-bg:#6d28d9`, plus `--effect-value-width:30px` (Fade's value column is narrower than the other 4 — see Deviations). |

No `.tsx` file was touched in this slice — verified via `git diff --stat` (CSS files only) and by re-running the full suite/typecheck/lint unchanged.

## Deviations from Design (Slice 2)

1. **Task 2.1 (RED test) — N/A, not written.** The parent prompt for this batch explicitly instructed: "Where CSS has no direct unit test, treat 'existing dialog tests still assert the same classNames / rendered DOM' as the parity gate... this is a CSS-only change, not adding new tests." Investigated first: Vitest's jsdom environment in this repo has no `css: true` / CSS-loading configured (confirmed via `grep css vite.config.ts` — no match), so `import './XSettingsDialog.css'` inside each dialog component is a no-op at test time; no test in this repo can observe computed CSS values. A "RED test" asserting a shared class from `effect-dialog.css` would have to inspect the CSS file's raw text (a brittle, non-behavioral check), which the parent prompt's override supersedes. Per the same pattern already used in Slice 1 (task 1.3, marked RED "N/A — structural migration"), this is marked N/A rather than FAILED: the existing 5 dialog test suites (unchanged assertions on classNames/DOM) plus the full-suite baseline before/after are the actual parity gate, exactly as design's own Testing Strategy table states for slice 2 ("existing dialog tests assert same classNames").
2. **`--effect-value-width` custom property — not in original design wording.** Design said per-effect files shrink to "`--effect-accent` + apply-button vars" only. On measuring the 5 files byte-for-byte (`diff` after normalizing class-prefix names), Fade's `.fade-settings-value` uses `width: 30px` while the other 4 use `width: 40px` — a real, pre-existing visual difference (Fade's value strings like "10.0s" are shorter than the other dialogs' need). To preserve 100% parity without depending on CSS `@import`/cascade ordering, I added one more custom property, `--effect-value-width` (default `40px`, overridden to `30px` only in `FadeSettingsDialog.css`), rather than leaving Fade's value column silently widened to 40px. This is a minimal, necessary addition beyond the design's literal two-variable description — required because a truly uniform 5-file value-width does not exist, mirroring the same category of finding as Slice 1's "verbatim stub" deviation.
3. **Mechanism: CSS `@import` (not JS-side global CSS import), plus CSS custom properties instead of relying on cascade order.** Design left the exact wiring unspecified. I used a plain CSS `@import '../effect-dialog.css';` at the top of each per-effect file — zero `.tsx` changes, and Vite/Rollup's CSS pipeline resolves and dedupes the import once into the final bundle (verified via `pnpm build:renderer` + inspecting the built CSS: the 5-prefix grouped selectors appear exactly once in `dist/renderer/assets/*.css`, and `var(--effect-accent)` etc. are correctly emitted per accent). Accent/width differences are expressed as CSS custom properties set on each dialog's own `.X-settings-overlay` (the common ancestor of every other element in that dialog), so they resolve correctly regardless of import/bundle order — no reliance on cascade/specificity tie-breaking between the shared file and the per-effect override file.
4. **Grouping scope for `select` and `--mix` rules** — grouped only for the prefixes that actually have a matching element in their `.tsx` (`select`: Filter + Reverb only; `--mix`: Filter/Distortion/Delay/Reverb, not Fade — Fade has no mix control), rather than listing all 5 prefixes for every rule (which would be harmless but misleading, implying Fade has a mix control it doesn't).

## Issues Found (Slice 2)
None. The CSS `@import` + custom-property mechanism worked on the first `pnpm build:renderer` attempt; no ESLint/TS/format issues were introduced (the 6 touched CSS files are not among the pre-existing 91-file `format:check` failure list, confirmed via `pnpm format:check | grep -E "effect-dialog|SettingsDialog\.css"` → no output).

## Safety Net (Slice 2)
Baseline before any Slice 2 change (re-verified, matches Slice 1's final state): `pnpm test:no-watch` → **17 test files / 109 tests passing.**
After 2a (Filter/Distortion/Fade shrink + shared file): 17/17 files, 109/109 tests — unchanged.
After 2b (Delay/Reverb shrink): 17/17 files, 109/109 tests — unchanged.

## TDD Cycle Evidence (Slice 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|-------------|-----|-------|-------------|----------|
| 2.1–2.3 (Filter/Distortion/Fade, "2a") | 5 existing dialog test files (`FilterSettingsDialog.test.tsx`, `DistortionSettingsDialog.test.tsx`, `FadeSettingsDialog.test.tsx` as direct consumers; `DelaySettingsDialog.test.tsx`/`ReverbSettingsDialog.test.tsx` as unaffected-so-far controls) + real production build (`pnpm build:renderer`) as the CSS-parity oracle | Integration (RTL classNames) + build-output inspection (actual CSS cascade/var resolution, since jsdom cannot) | ✅ 17/17 files, 109/109 tests (pre-change) | ➖ N/A — CSS-only structural change, no jsdom CSS loading exists in this repo to fail against; see Deviation #1. The build-output check (`grep -c "filter-settings-overlay" dist/.../*.css` before edits would show 5 separate un-grouped declarations if this were a real RED/GREEN, but no test framework encodes that assertion here) | ✅ Passed — after creating `effect-dialog.css` and shrinking Filter/Distortion/Fade: full suite still 17/17, 109/109; `pnpm build:renderer` succeeds; built CSS shows the 5-prefix grouped selector for overlay/panel/title/field/label/range-track/value/actions/button-base emitted exactly once, `var(--effect-accent)` present for the 3 shrunk files, `--effect-accent:#3b82f6` etc. correctly attached to each `.X-settings-overlay` | ➖ N/A — no new runtime logic to triangulate, pure CSS extraction | ✅ Clean — zero duplicated structural CSS across Filter/Distortion/Fade |
| 2.3 (Delay/Reverb, "2b") | `DelaySettingsDialog.test.tsx`, `ReverbSettingsDialog.test.tsx` + full suite + build-output inspection | Integration + build-output inspection | ✅ 17/17, 109/109 (after 2a) | ➖ N/A — same reasoning as above | ✅ Passed — after shrinking Delay/Reverb: full suite 17/17, 109/109; build succeeds; built CSS shows all 5 prefixes in ONE grouped selector per rule (verified `.filter-settings-overlay,.distortion-settings-overlay,.delay-settings-overlay,.reverb-settings-overlay,.fade-settings-overlay{...}` appears once, and a standalone `.delay-settings-overlay{...}` block only for the 3 accent-var custom properties, not duplicate structure) | ➖ N/A | ✅ Clean — all 5 dialogs now share one structural source of truth |
| 2.4 | Full suite | Integration | ✅ (both 2a/2b baselines) | N/A — parity gate | ✅ 17/17 test files, 109/109 tests (identical to Slice-1-final baseline, 0 regressions) | N/A | N/A |

### Test Summary (Slice 2)
- **Total tests written**: 0 new test cases (pure CSS refactor — no rendered DOM/behavior changed, per orchestrator's explicit "not adding new tests" instruction for this slice)
- **Total tests passing**: 109/109 (full suite), 0 regressions vs. 109/109 baseline (both after 2a and after 2b)
- **Layers used**: Integration (109, all pre-existing, unaffected by CSS-only change) + manual build-output inspection (`pnpm build:renderer`, `dist/renderer/assets/*.css`) as the substitute oracle for actual CSS cascade/variable resolution, which jsdom/Vitest cannot observe in this repo
- **Approval tests** (refactoring): 5 — the 5 pre-existing per-dialog test suites act as approval tests confirming unchanged classNames/DOM structure
- **Pure functions created**: 0 (CSS-only; no new TS/JS logic)

## Work Unit Evidence (Slice 2 / PR 2)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch` (full suite, vitest ignores path args) → **17 test files passed, 109 tests passed**, both after 2a and after 2b — identical to pre-slice-2 baseline |
| Runtime harness command/scenario and exact result | `pnpm build:renderer` (production Vite build) → succeeds, 49 modules transformed, single CSS bundle emitted; manually inspected `dist/renderer/assets/*.css` to confirm (a) the 5-prefix grouped selectors are deduplicated to one declaration each, (b) `var(--effect-accent)`/`var(--effect-apply-bg)`/`var(--effect-apply-hover-bg)`/`var(--effect-value-width,40px)` are correctly emitted, and (c) each dialog's own accent/width custom properties are attached to its `.X-settings-overlay` selector. True pixel-level visual regression (opening each dialog in the running Electron app and comparing) is out of scope for this environment — flagged as the residual manual-verification gap the tasks.md harness column calls for ("manual: open each dialog, compare visuals") |
| Rollback boundary | `git revert` the two commits (`refactor: extract shared effect-dialog.css structural rules (2a)` and `(2b)`) — fully isolated to the 6 CSS files listed above; zero `.tsx`/`.ts` files touched, zero test files touched |

## Quality Gates (Slice 2, Full Repo)
- `pnpm test:no-watch`: **17 passed (17) / 109 passed (109)** — 0 failures (re-verified after both 2a and 2b)
- `pnpm typecheck`: clean (0 errors)
- `pnpm lint`: clean (0 errors, 0 warnings)
- `pnpm build:renderer`: succeeds; built CSS bundle shrank (single shared block replaces 5 near-duplicate blocks)
- `pnpm format:check`: still fails on the same pre-existing baseline noise (91 files this run, was 95 in Slice 1 — pre-existing drift unrelated to this batch); **none of the 6 files touched in Slice 2 appear in the flagged list**, confirmed via `pnpm format:check | grep -E "effect-dialog|SettingsDialog\.css"` → no output

## Diff Size (Slice 2, vs. 400-line review budget)

| Commit | `git diff --stat` | Changed lines |
|---|---|---|
| 2a (`effect-dialog.css` create + Filter/Distortion/Fade shrink) | 4 files changed, 215 insertions(+), 315 deletions(-) | **530** |
| 2b (Delay/Reverb shrink) | 2 files changed, 14 insertions(+), 218 deletions(-) | **232** |
| **Slice 2 total** | 6 files changed, 229 insertions(+), 533 deletions(-) | **762** |

**Important finding for the orchestrator's PR-splitting decision**: the tasks.md forecast (500–650, High risk) undercounted — actual measured total is **762 changed lines**. Worse, the suggested 2a/2b sub-split does **not** bring both halves under the 400-line budget: **2a alone is 530 lines, still over budget**; only 2b (232 lines) is comfortably under. If this needs to ship as a single PR 2, it is a `size:exception` case (chain strategy was already resolved as `stacked-to-main` with no new decision needed per tasks.md, but the 400-line-per-PR budget is a separate guard from the chain-strategy decision). If PR 2 must itself be split for review, the natural boundary is NOT 2a/2b as originally suggested — a finer cut (e.g., "shared file + one dialog" per PR, or "shared file alone" then "all 5 shrinks together") would be needed to get every piece under 400. Both commits are already isolated on this branch at the 2a/2b boundary per the batch instructions, so re-splitting into more/fewer PRs later is still possible without rewriting history — this is a reporting flag, not a blocker, since the chain-strategy/delivery decision itself is already resolved and this batch was told to proceed and report.

---

## Remaining Tasks
- [x] Slice 2: shared CSS (PR 2) — complete
- [ ] Slice 3: shared JSX (PR 3) — not started
- [ ] Slice 4: generic hook (PR 4) — not started
- [ ] Slice 5: AudioEngine clamp/wiring (PR 5) — not started
- [ ] Slice 6: setter consolidation (PR 6) — not started

## Workload / PR Boundary
- Mode: chained/stacked PR slice (`stacked-to-main`, per tasks.md forecast)
- Current work unit: Slice 2 — shared CSS (PR 2), split into commits 2a and 2b on this branch
- Boundary: starts from 5 near-duplicate per-effect CSS files (99–117 lines each); ends with one shared `effect-dialog.css` (192 lines) + 5 shrunk per-effect files (~9 lines each of accent/apply/width custom-property overrides), full suite green, zero `.tsx` change, build-verified CSS parity
- Estimated review budget impact: **762 changed lines total, High risk — exceeds the 400-line budget even at the 2a/2b sub-split (2a alone = 530)**. Flagged to the orchestrator for a PR-splitting/size-exception decision; not blocking this apply batch since the chain-strategy decision was already resolved before apply

## Status
4/4 slice-1 tasks complete (1.1–1.4). 5/5 slice-2 tasks complete (2.1–2.5). Slices 1–2 done, ready for verify (of slice 2) pending orchestrator's PR-size decision. Slices 3–6 remain for future apply batches (out of this batch's assigned scope).
