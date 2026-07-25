# Proposal: Standardize Internal Naming and Extract Magic Numbers in AudioEngine

## Intent

`doc/TODO.md`:272 / `doc/FUTURE-IMPROVEMENTS.md` §3 flag naming drift and magic numbers in the effects code. After the merged `reduce-effect-duplication` change, the public/context/UI layers already use the canonical `output` name — but `AudioEngine.ts` still uses `outputLevel` in its 4 internal per-track node interfaces and setters. This internal/external mismatch is a real maintenance trap: a future edit could silently read/write the wrong field. Extracting 3 repeated magic numbers into named constants (matching the file's existing pattern) improves readability and prevents divergent literal edits. Pure internal refactor, zero behavior change.

## Scope

### In Scope (one combined slice, ~60-70 lines)
- Rename `outputLevel` -> `output` in `AudioEngine.ts`'s 4 internal node interfaces (`FilterNodes`, `DistortionNodes`, `DelayNodes`, `ReverbNodes`), their construction sites, setter assignments, and gain-ramp reads (~24 occurrences).
- Update the 9 white-box `.outputLevel` assertions in `AudioEngine.test.ts` atomically with the rename (Strict TDD: RED then GREEN).
- Add 3 named constants to the existing const block: `PARAM_RAMP_TIME_CONSTANT_S = 0.01` (22 `setTargetAtTime` sites), `REVERB_PREDELAY_MAX_MS = 500`, `FADE_DURATION_MAX_S = 10` (3 fade clamps).

### Out of Scope / Non-Goals
- Item #2 from the TODO (`mix` parameter position) — ALREADY RESOLVED by `reduce-effect-duplication`; do NOT re-implement. All 4 setters take a single named settings object.
- UI-facing "Output" labels/copy — untouched (this is code naming, not UX copy).
- The `effectSettings.ts` historical doc comment — not load-bearing; leave as-is.
- Any audio-processing behavior change, new feature, or public API change.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — pure internal refactor, no spec-level requirement change.

## Approach

Approach 1 from exploration: single combined "naming + constants" slice. Both sub-changes touch only `AudioEngine.ts` (+ its test), are mechanical and low-risk, and total well under the 400-line budget. Cite current line numbers at spec/apply time (file has shifted since the doc was written).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/renderer/audio/AudioEngine.ts` | Modified | Internal `outputLevel`->`output` rename (~24 occ.) + 3 named constants |
| `src/__tests__/audio/AudioEngine.test.ts` | Modified | 9 white-box assertions `.outputLevel`->`.output` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Test assertions break if rename lands without updating them | High if not atomic | Update the 9 assertions in the same commit (Strict TDD) |
| Scope creep into UI copy / doc comments | Low | Explicit non-goals above |
| Line numbers stale vs. doc | Low | Re-grep current positions at apply time |

## Rollback Plan

Single self-contained PR touching 2 files. Revert the PR; behavior parity means the existing suite catches any regression before merge.

## Dependencies

None.

## Success Criteria

- [ ] `AudioEngine.test.ts` and full suite pass after the change.
- [ ] No `outputLevel` remains in `AudioEngine.ts` internal state; `output` is the single name.
- [ ] The `0.01` ramp, `500` preDelay bound, and `10`s fade bound are named constants.
- [ ] No audio behavior change; diff stays under the 400-line budget.

## Proposal question round (interactive — for user review)

Business framing is fully supplied by the exploration; these are the only assumptions worth confirming before spec:
1. Confirm item #2 (`mix` position) stays dropped as already-resolved — no re-implementation.
2. Confirm UI-facing "Output" copy stays untouched (code-only rename).
3. Confirm one combined slice is acceptable vs. splitting rename and constants into two PRs (either fits the budget).

Assumptions if unanswered: proceed with Approach 1 (single combined slice), items above held as non-goals.
