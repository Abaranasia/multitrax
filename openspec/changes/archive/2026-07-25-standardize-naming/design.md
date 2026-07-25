# Design: Standardize Internal Naming and Extract Magic Numbers in AudioEngine

## Technical Approach

A single mechanical, behavior-preserving slice against one production file
(`src/renderer/audio/AudioEngine.ts`) plus its white-box test
(`src/__tests__/audio/AudioEngine.test.ts`). Two orthogonal edits ship together
because both touch only these two files and stay far under the 400-line budget:

1. **Rename** the internal `outputLevel` field → `output` across the 4 per-track
   node interfaces (FilterNodes, DistortionNodes, DelayNodes, ReverbNodes), their
   construction sites, and setter assignments (16 occurrences in the engine), so
   the infrastructure layer matches the canonical `output` already used by the
   public/context/UI layers after `reduce-effect-duplication`.
2. **Extract** 3 magic numbers into the existing top-of-file const block
   (lines 18–56), following the established `_S`/`_MS` suffix and `_MAX` bound
   convention.

No new capabilities, no public API change, no runtime behavior change. The
existing suite is the parity gate.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
| Ramp constant name | `PARAM_RAMP_TIME_CONSTANT_S = 0.01` | `RAMP_S`, `SMOOTHING_S` | The `0.01` is the `setTargetAtTime` time-constant (seconds); `_S` suffix + descriptive `PARAM_RAMP` matches `DELAY_TIME_MAX_S` style and disambiguates from a duration |
| PreDelay bound name | `REVERB_PREDELAY_MAX_MS = 500` | reuse a shared `500` const | The field comment is `// 0–500 (ms)`; `_MAX_MS` mirrors `DELAY_TIME_MAX_MS`. Must NOT alias the unrelated `DAMPING_MIN_HZ = 500` — same literal, different semantic |
| Fade bound name | `FADE_DURATION_MAX_S = 10` | fold into existing `FADE_DURATION = 5` | `FADE_DURATION = 5` is the default play/stop fade; `10` is the user-settable clamp ceiling — distinct concepts, distinct constants. `_MAX_S` matches convention |
| Field rename target | `output` | keep `outputLevel`; add alias | `output` is already canonical across `effectSettings.ts` and consumers; a lingering internal `outputLevel` is the maintenance trap the proposal targets. No alias — clean rename |
| Slice ordering | Rename + constants in one commit, RED test first | Split into 2 PRs | Both edits are mechanical, single-file, ~60–70 lines total, well under budget; splitting adds PR overhead with no reviewer benefit |

## Data Flow

No data-flow change. Rename is name-only; the gain-ramp read path is identical:

    setXSettings(id, {..., output}) ──► node.output = clamp(output,0,100)
                                              │
                                              ▼
                        outputGain.gain.setTargetAtTime(node.output/100, now, PARAM_RAMP_TIME_CONSTANT_S)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/audio/AudioEngine.ts` | Modify | Rename `outputLevel`→`output` (4 interfaces + construction + setter reads, 16 sites); add 3 constants to the const block and replace their literals (22× `0.01`, 1× `500`, 3× `10`) |
| `src/__tests__/audio/AudioEngine.test.ts` | Modify | Update 9 white-box `.outputLevel` assertions → `.output` atomically (Strict TDD RED→GREEN) |

## Interfaces / Contracts

```ts
// Added to the const block (lines 18–56), matching existing convention:
const PARAM_RAMP_TIME_CONSTANT_S = 0.01; // setTargetAtTime smoothing time-constant
const REVERB_PREDELAY_MAX_MS = 500;      // reverb pre-delay clamp ceiling
const FADE_DURATION_MAX_S = 10;          // user-settable fade clamp ceiling

// Node interfaces: `outputLevel: number` → `output: number` (comment `// 0–100 (%)` kept)
interface FilterNodes { /* … */ output: number }
interface DistortionNodes { /* … */ output: number }
interface DelayNodes { /* … */ output: number }
interface ReverbNodes { /* … */ output: number }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | 9 white-box assertions read renamed `.output`; clamp bounds still enforced (500 ms preDelay, 10 s fade) | Update `AudioEngine.test.ts` assertions in the same commit; RED (rename engine → test fails on old field) then GREEN |
| Regression | No behavior change across the engine | Full existing suite green as parity gate; no new tests needed (values, not names, are the contract) |

Note: constant extraction is a pure literal→identifier substitution with no
observable output change; the existing clamped-value assertions already cover it.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.

## Migration / Rollout

No migration. Single self-contained PR touching 2 files; revert the PR to roll
back. Re-grep exact line numbers at apply time (proposal risk: stale line refs).

## Open Questions

- None. Naming choices and single-slice ordering confirmed by proposal + user.
