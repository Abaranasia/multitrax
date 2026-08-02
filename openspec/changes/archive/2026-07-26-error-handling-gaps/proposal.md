# Proposal: Close Error-Handling Gaps and Test-Coverage Holes in the Audio Engine

## Intent

`doc/TODO.md`:260 / `doc/FUTURE-IMPROVEMENTS.md` §2 flag four robustness gaps, all verified against live source on `ref/error-handling-gaps`. The highest-weight is a real **security gap**: `fs:readAudioFile` (`main.ts:82-86`) is a generic arbitrary-file-read primitive — a compromised renderer can read any host path (`/etc/passwd`, `id_rsa`) with zero validation. The others are silent-failure traps: `_stopSource` swallows all errors as `console.warn`; a single corrupt file in a batch import discards the whole batch with no user feedback; and the fade/loop scheduling paths have zero test coverage. Goal: close these gaps with real security weight on the IPC boundary, minimal UX to surface import failures, and Strict-TDD coverage for the untested paths.

## Scope

### In Scope (stacked slices; final split decided at sdd-tasks)
1. **`_stopSource` narrowing** — catch only the expected `InvalidStateError` (already-stopped); re-throw/log genuinely unexpected errors instead of hiding them (`AudioEngine.ts:914-923`).
2. **Batch-import resilience** — per-file `try/catch` in `addTracks` so successful files are retained when one fails; a partial-failure return contract both `useCanvas.ts` callers consume; minimal failure surfacing (`console.error` + return value, no new toast system unless requested).
3. **IPC file-access hardening (security)** — session-scoped path allowlist populated by `dialog:openAudioFiles`, enforced by `fs:readAudioFile`; `try/catch` on `readFileSync`/`writeFileSync` (`main.ts:76,82-86`).
4. **Fade/loop test coverage** — introduce `vi.useFakeTimers()` infra + tests for `_playLoopWithFade`, `_startFadeOut`, `_cancelFadeOut`, `setLoop/setFadeIn/setFadeOut/setSeekFade/setFadeDurations`, `getRecordingStream`.

### Out of Scope / Non-Goals
- Any new toast/notification framework beyond the minimum to report per-file import failures.
- Directory/extension-only validation for item 3 (does NOT close the primitive — rejected in favor of the allowlist).
- Re-scoping anything from the archived `reduce-effect-duplication` / `standardize-naming` changes; behavior of unrelated engine paths unchanged.
- New audio features or public API changes.

## Capabilities

### New Capabilities
- `audio-file-access-security`: renderer file reads restricted to paths granted via the open dialog; IPC fs handlers hardened against thrown errors (item 3).
- `batch-import-resilience`: per-file decode failures isolated; successful files retained; failures reported (item 2).

### Modified Capabilities
None. Items 1 (error narrowing) and 4 (test coverage) are internal robustness / test-only — no spec-level requirement change.

## Approach

Exploration Approach 3 for item 3 (allowlist + `try/catch` defense-in-depth). Items 1, 2, 4 are localized fixes in already-identified files. Deliver as stacked slices mirroring `reduce-effect-duplication`: item 3 (with security tests) and item 4 (8 test blocks + fake-timer infra) are each substantial enough to stand alone; items 1 and 2 can combine or stand alone. Re-confirm exact line numbers at spec/apply time (doc citations drift ~+2 in `AudioEngine.ts`).

## Affected Areas

| Area | Impact | Item |
|------|--------|------|
| `src/renderer/audio/AudioEngine.ts` | Modified | 1 (narrow catch) |
| `src/renderer/context/AudioContext.tsx` | Modified | 2 (`addTracks` contract) |
| `src/renderer/components/Canvas/useCanvas.ts` | Modified | 2 (both callers) |
| `src/main/main.ts` | Modified | 3 (allowlist + try/catch) |
| `src/__tests__/main/main.test.ts` | Modified | 3 (rejected path, thrown fs) |
| `src/__tests__/audio/AudioEngine.test.ts` | Modified | 4 (fake timers + 8 blocks) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Allowlist introduces unbounded main-process state | Low | Decide reset/bound policy at design (reset per dialog vs. app-lifetime) |
| `addTracks` partial-success is an interface change both callers must handle | Med | Design explicit return shape before apply; update both `useCanvas.ts` sites atomically |
| Fake-timer infra conflicts with `FakeSource.stop()`'s real `setTimeout(0)` | Med | Introduce `vi.useFakeTimers()` consistently across the file |
| Security fix incomplete (extension-only) | High if wrong approach | Use allowlist, not extension check |
| Slice exceeds 400-line budget | Med | tasks phase forecasts per-slice; split if needed |

## Rollback Plan

Each slice is an independent stacked PR; revert the offending slice without touching others. Items 1 and 4 are behavior-parity/test-only (existing suite gates regressions); items 2 and 3 change observable behavior and each ships with new tests that gate the revert boundary.

## Dependencies

Tracker/feature branch to chain the stacked PRs against. No new IPC channel or npm dependency required.

## Success Criteria

- [ ] `fs:readAudioFile` rejects any path not granted via `dialog:openAudioFiles`; test proves an out-of-allowlist path is refused.
- [ ] `readFileSync`/`writeFileSync` throwing no longer crashes the handler; test covers it.
- [ ] A corrupt file in a batch no longer discards successfully-decoded files; the failing file is reported.
- [ ] `_stopSource` no longer hides non-`InvalidStateError` failures.
- [ ] Fade/loop paths + the 6 setters have direct test coverage via fake timers.
- [ ] Each slice PR stays within the 400-line review budget; Strict TDD (RED→GREEN) for all new tests.

## Proposal question round (interactive — for user review)

Business framing is well-supplied by the exploration; these are the product/scope decisions worth confirming before spec:

1. **Import-failure UX**: is a minimal `console.error` + per-file return contract acceptable for now, or do you want even a lightweight in-app notice when a file fails to import? (No toast system exists today.)
2. **Allowlist lifetime**: should granted paths reset on each new open-dialog, or accumulate for the app's lifetime? (Security vs. re-open-a-recent-file convenience tradeoff.)
3. **`addTracks` contract shape**: OK to change `Promise<void>` to a partial-success result (e.g. `{ succeeded, failed }`), or would you rather keep the signature and only log failures?
4. **Slice count**: 4 stacked slices (one per item) vs. combining items 1+2 into one — either fits the budget.

Assumptions if unanswered: minimal `console.error` + return-value reporting (no new toast); allowlist resets per open-dialog; `addTracks` adopts a `{ succeeded, failed }` partial-success shape; items 1 and 2 may combine, items 3 and 4 stand alone.
