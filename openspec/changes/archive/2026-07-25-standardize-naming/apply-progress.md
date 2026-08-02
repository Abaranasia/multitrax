# Apply Progress: Standardize Internal Naming and Extract Magic Numbers in AudioEngine

**Change**: standardize-naming
**Mode**: Strict TDD
**Status**: 15/15 tasks complete. Ready for verify.

## Completed Tasks

### Phase 1: RED — Pin the Canonical Field Name
- [x] 1.1 Updated all 9 white-box `.outputLevel` assertions in `AudioEngine.test.ts` to `.output`
- [x] 1.2 Ran `vitest run src/__tests__/audio/AudioEngine.test.ts` — confirmed RED (5 failing test cases, 25/30 passing; failures were `expected undefined to be <value>`, proving the test now pins `.output` against the still-`outputLevel` engine)

### Phase 2: GREEN — Rename `outputLevel` → `output` in AudioEngine.ts
- [x] 2.1 Renamed field in `FilterNodes` interface (kept `// 0–100 (%)` comment)
- [x] 2.2 Renamed field in `DistortionNodes` interface
- [x] 2.3 Renamed field in `DelayNodes` interface
- [x] 2.4 Renamed field in `ReverbNodes` interface
- [x] 2.5 Updated all construction sites and setter bodies (`setFilterSettings`, `setDistortionSettings`, `setDelaySettings`, `setReverbSettings`) — 16 occurrences total across the file
- [x] 2.6 Grepped `AudioEngine.ts` for `outputLevel` — zero matches (exit code 1)
- [x] 2.7 Ran `vitest run src/__tests__/audio/AudioEngine.test.ts` — GREEN, 30/30 passing

### Phase 3: Extract Magic-Number Constants
- [x] 3.1 Added `const PARAM_RAMP_TIME_CONSTANT_S = 0.01;` to the const block, with comment
- [x] 3.2 Added `const REVERB_PREDELAY_MAX_MS = 500;` to the const block, distinct from `DAMPING_MIN_HZ = 500`
- [x] 3.3 Added `const FADE_DURATION_MAX_S = 10;` to the const block, distinct from `FADE_DURATION = 5`
- [x] 3.4 Replaced all 22 inline `, 0.01)` ramp-literal occurrences with `PARAM_RAMP_TIME_CONSTANT_S`
- [x] 3.5 Replaced the reverb `preDelay` upper-clamp `500` literal with `REVERB_PREDELAY_MAX_MS`
- [x] 3.6 Replaced the 3 fade-duration upper-clamp `10` literals (fadeIn/fadeOut/seekFade) with `FADE_DURATION_MAX_S`
- [x] 3.7 Grepped for stray inline `0.01` — only the const declaration itself remains; confirmed no stray `clamp(..., 0, 500)` / `clamp(..., 0, 10)` literals

### Phase 4: Parity Gate and Verification
- [x] 4.1 Ran full suite (`pnpm test:no-watch`) — 19 files, 129/129 passing, no behavior change
- [x] 4.2 Grepped `src` recursively for `outputLevel` — only remaining hit is a historical doc comment in `effectSettings.ts` (past-tense, describing pre-rename state; out of scope per design's File Changes table, which lists only `AudioEngine.ts` + `AudioEngine.test.ts`)
- [x] 4.3 Ran `pnpm run typecheck` (`tsc --noEmit` across `tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json`) — exit 0, clean

## Files Changed

| File | Action | What Was Done |
|------|--------|----------------|
| `src/renderer/audio/AudioEngine.ts` | Modified | Renamed `outputLevel`→`output` across 4 node interfaces + setter bodies + construction sites (16 sites); added `PARAM_RAMP_TIME_CONSTANT_S`, `REVERB_PREDELAY_MAX_MS`, `FADE_DURATION_MAX_S` to the const block; replaced 22 inline `0.01` ramp literals, 1 reverb preDelay `500` clamp, 3 fade-duration `10` clamps |
| `src/__tests__/audio/AudioEngine.test.ts` | Modified | Renamed 9 white-box `.outputLevel` assertions to `.output` (RED before engine rename, GREEN after) |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–2.7 (rename) | `src/__tests__/audio/AudioEngine.test.ts` | Unit | ✅ 30/30 (baseline before any edit) | ✅ Written (9 assertions retargeted to `.output`) | ✅ 30/30 passing after engine rename | ➖ Skipped: purely structural rename, one possible output, no branching — "Triangulation skipped: mechanical field rename with a single valid post-condition, existing 9 assertions already cover both boundary (0/100) and mid-range (80/90) values across all 4 effect types" | ➖ None needed — rename only, no duplication introduced |
| 3.1–3.7 (constants) | `src/__tests__/audio/AudioEngine.test.ts` (existing clamp-boundary assertions act as approval tests) | Unit | ✅ 30/30 (post-rename baseline) | N/A — literal→identifier substitution is not new behavior; existing clamped-value assertions (500 ms preDelay, 10 s fade boundaries, gain-ramp targets) already pin the exact values before touching the constants | ✅ 30/30 passing after each substitution (ramp constant, preDelay bound, fade bound) | ➖ Skipped: pure literal substitution, same numeric value at every call site, no new logic path | ✅ Clean — named constants read clearly at each call site, matches existing `_MAX_HZ`/`_MAX_S`/`_MAX_MS` naming convention |

### Test Summary
- **Total tests written**: 0 new tests (rename + constant-extraction preserved by existing approval-style assertions, per design's Testing Strategy — "no new tests needed, values not names are the contract")
- **Total tests passing**: 30/30 (`AudioEngine.test.ts`), 129/129 (full suite)
- **Layers used**: Unit (30)
- **Approval tests** (refactoring): 9 white-box `.output` assertions + all pre-existing clamp-boundary assertions served as approval tests pinning exact numeric values across the rename and the constant extraction
- **Pure functions created**: 0 (no new functions; `clamp()` already existed)

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test:no-watch src/__tests__/audio/AudioEngine.test.ts` → 30/30 passing after both phases |
| Runtime harness command/scenario and exact result | N/A — pure internal rename + literal substitution, no observable runtime behavior boundary; full existing suite (`pnpm test:no-watch`, 129/129) is the parity gate, plus `pnpm run typecheck` (exit 0) |
| Rollback boundary | Revert the single commit/PR touching exactly 2 files (`src/renderer/audio/AudioEngine.ts`, `src/__tests__/audio/AudioEngine.test.ts`); no cross-layer callers touched |

## Deviations from Design

None — implementation matches design exactly. Verified counts matched design's forecast precisely: 16 `outputLevel` occurrences in the engine, 9 in the test file, 22 inline `0.01` literals, 1 reverb `preDelay` `500` clamp, 3 fade-duration `10` clamps.

## Issues Found

None. One observation (not a deviation): `src/renderer/audio/effectSettings.ts` contains a doc comment referencing `outputLevel (AudioEngine.ts)` in past tense, describing the pre-rename naming split from the earlier `reduce-effect-duplication` change. This file is not in the design's File Changes table (only `AudioEngine.ts` + `AudioEngine.test.ts` are in scope) and the comment is historically accurate (uses "was previously"), so it was left untouched. Flagging for awareness in case a future doc-freshness pass wants to update it.

## Remaining Tasks

None — all 15 tasks complete.

## Workload / PR Boundary

- Mode: single PR
- Current work unit: Unit 1 (Rename `outputLevel`→`output` + extract 3 magic-number constants, atomically)
- Boundary: starts at the pre-change baseline (30/30 passing, `outputLevel` present) and ends at full parity gate (129/129 passing, typecheck clean, zero `outputLevel` in AudioEngine.ts)
- Estimated review budget impact: ~60–70 changed lines across 2 files, well under the 400-line budget; matches forecast exactly

## Status

15/15 tasks complete. Ready for verify.
