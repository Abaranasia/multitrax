# Tasks: Standardize Internal Naming and Extract Magic Numbers in AudioEngine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 60–70 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

Rationale: single production file (`src/renderer/audio/AudioEngine.ts`) plus
its white-box test (`src/__tests__/audio/AudioEngine.test.ts`); verified counts
match design exactly — 16 `outputLevel` occurrences in the engine, 9 in the
test file, 22 inline `0.01` literals. Both edits are mechanical (rename +
literal→identifier substitution), well under the 400-line budget. `auto-chain`
resolves to proceeding with the single slice without asking.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Rename `outputLevel`→`output` + extract 3 magic-number constants, atomically | PR 1 | `vitest run src/__tests__/audio/AudioEngine.test.ts` | N/A — pure internal rename + literal substitution, no observable runtime behavior change; full existing suite is the parity gate | Revert the single PR; changes confined to 2 files, no cross-layer callers touched |

## Phase 1: RED — Pin the Canonical Field Name

- [x] 1.1 In `src/__tests__/audio/AudioEngine.test.ts`, update all 9 white-box
      `.outputLevel` assertions to `.output` (rename only, same expected values)
      so the suite fails against the still-`outputLevel` engine
- [x] 1.2 Run `vitest run src/__tests__/audio/AudioEngine.test.ts` and confirm
      RED: failures point to the renamed field not existing on the node,
      proving the test now pins `output`

## Phase 2: GREEN — Rename `outputLevel` → `output` in AudioEngine.ts

- [x] 2.1 Rename the `outputLevel: number` field to `output: number` in the
      `FilterNodes` interface (keep the `// 0–100 (%)` comment)
- [x] 2.2 Rename the `outputLevel: number` field to `output: number` in the
      `DistortionNodes` interface
- [x] 2.3 Rename the `outputLevel: number` field to `output: number` in the
      `DelayNodes` interface
- [x] 2.4 Rename the `outputLevel: number` field to `output: number` in the
      `ReverbNodes` interface
- [x] 2.5 Update all construction sites and setter bodies
      (`setFilterSettings`, `setDistortionSettings`, `setDelaySettings`,
      `setReverbSettings`) that read/write `.outputLevel` to use `.output`,
      covering the remaining occurrences (16 total across the file)
- [x] 2.6 Grep `src/renderer/audio/AudioEngine.ts` for `outputLevel` and
      confirm zero remaining matches
- [x] 2.7 Run `vitest run src/__tests__/audio/AudioEngine.test.ts` and confirm
      GREEN (all 9 renamed assertions pass, values unchanged)

## Phase 3: Extract Magic-Number Constants

- [x] 3.1 Add `const PARAM_RAMP_TIME_CONSTANT_S = 0.01;` to the existing const
      block (near line 18–56), with a short comment (`setTargetAtTime`
      smoothing time-constant)
- [x] 3.2 Add `const REVERB_PREDELAY_MAX_MS = 500;` to the const block
      (reverb pre-delay clamp ceiling) — do not conflate with the existing
      `DAMPING_MIN_HZ = 500`
- [x] 3.3 Add `const FADE_DURATION_MAX_S = 10;` to the const block
      (user-settable fade clamp ceiling) — do not conflate with the existing
      `FADE_DURATION = 5` default
- [x] 3.4 Replace all 22 inline `0.01` occurrences used as the
      `setTargetAtTime` ramp time-constant with `PARAM_RAMP_TIME_CONSTANT_S`
- [x] 3.5 Replace the reverb `preDelay` upper-clamp `500` literal with
      `REVERB_PREDELAY_MAX_MS`
- [x] 3.6 Replace the fade-duration upper-clamp `10` literal(s) with
      `FADE_DURATION_MAX_S`
- [x] 3.7 Grep `src/renderer/audio/AudioEngine.ts` for stray inline `0.01`
      ramp literals and confirm none remain outside the const declaration

## Phase 4: Parity Gate and Verification

- [x] 4.1 Run the full existing test suite (`vitest run`) and confirm all
      tests pass with no behavior change (same clamped values: 500 ms
      preDelay, 10 s fade, identical gain-ramp targets)
- [x] 4.2 Confirm no other files reference `AudioEngine.ts`'s internal
      `outputLevel` name (cross-layer files — `audioContextInstance.ts`,
      `AudioContext.tsx`, dialog hooks — already use `output` and stay
      untouched per scope)
- [x] 4.3 Type-check the project (`tsc --noEmit` or project's equivalent
      script) to confirm no leftover `outputLevel` references break
      compilation
