# Archive Report: error-handling-gaps Change

**Status**: `done` (ARCHIVED WITH EXPLICIT RISK ACCEPTANCE)

**Archived to**: `openspec/changes/archive/2026-07-26-error-handling-gaps/`

**Date**: 2026-07-26

## Executive Summary

The `error-handling-gaps` change has been **archived and closed WITHOUT a native review-gate "allow" result**, by explicit and informed user decision. All 27 tasks are complete, all tests pass (146/146), and the change has been independently re-verified. However, a second review-resilience pass (distinct from `sdd-verify`) discovered a CRITICAL race condition in the overlapping-batch-import flow (`Canvas.tsx`/`useCanvas.ts`), which was fixed, validated to work (148/148 tests), but then **deliberately reverted** because the fix required editing files outside the originally-reviewed diff scope. The user, after being shown the exact tradeoff, explicitly accepted this known risk and archived the change as-is. The fix is tracked as a separate follow-up change with its own clean review scope.

## Completion Status

**All work complete**:
- Slices A, B, C fully implemented and verified (27/27 tasks)
- 146/146 tests passing (re-verified post-B.11 fix)
- Full suite typecheck clean, lint clean
- All 3 delta specs merged into main specs (`openspec/specs/`)
- Change folder moved to archive location with date prefix

**Specs merged into openspec/specs/**:
- `batch-import-resilience/spec.md` (NEW) — per-file decode isolation
- `audio-file-access-security/spec.md` (NEW) — IPC path allowlist + fs hardening
- `audio-engine-error-handling/spec.md` (NEW) — _stopSource error narrowing

**No changes reverted from the shipped diff** (B.12 was attempted, validated, and reverted before final commit; the shipped change contains only A, B.1-B.11, and C).

## Review Gate Status: INTENTIONAL EXCEPTION

**This change was archived WITHOUT a native `gentle-ai review validate --gate post-apply` "allow" result.**

**Why**: Two native review lineages were run on this change via the `gentle-ai review` CLI (4R lens sweep: review-risk, review-resilience, review-readability, review-reliability):

1. **First lineage** (`review-20a3a1ecd786a587`): Found 1 CRITICAL (silent data-loss on failed recording save in `dialog:saveRecording`/`useRecorder.ts`). This was fixed (task B.11) and independently re-verified (sdd-verify PASS). That first lineage is now in `escalated` (terminal) state — expected behavior for bounded-review lineages when diff changes.

2. **Second lineage** (`review-659a7c62f4e78ca0`): Found 1 more CRITICAL (race condition where a second "Open Files" click while a first batch's IPC reads were in flight would wipe the session-scoped path allowlist mid-flight, silently discarding the first batch's already-read files with zero UI feedback). This was fixed (task B.12: busy-guard in `useCanvas.ts` + disabled button state in `Canvas.tsx`) and independently validated (148/148 tests passing, dedicated read-only validator confirmed the guard closes the race). **The B.12 fix was then REVERTED**, not shipped, because it required editing `Canvas.tsx`/`useCanvas.ts`/`Canvas.test.tsx` — files that were never part of this change's originally-reviewed diff (Slices A/B/C never touched the Canvas layer). The native review tool's correction mechanism only accepts edits within the originally-frozen file scope; widening scope mid-correction requires explicit maintainer-authorization binding, which was not granted.

3. **The user was explicitly asked and explicitly decided**: accept this known, corroborated race-condition risk and archive the change as-is, rather than widen review scope or block. The exact working fix (already implemented and validated once) is tracked as a separate follow-up change with its own clean review scope — it is NOT included in this change.

As a direct consequence, `gentle-ai review validate --gate post-apply` currently returns `result: invalidated`, `allowed: false` (multiple terminal review receipts for this repo state). This is expected given the above and documents the deliberate user decision, not a tooling failure.

**Related Artifacts (from Engram observation #40)**:
- First lineage: `review-20a3a1ecd786a587` (now escalated, contained by B.11 fix)
- Second lineage: `review-659a7c62f4e78ca0` (found B.12 race, reverted per user decision)

## Known Open Risk: Overlapping-Batch-Import Race (CRITICAL, accepted)

**The exact bug** (found by review-resilience lens, corroborated by refuter):
- `dialog:openAudioFiles` (in `main.ts`) correctly REPLACEs (not accumulates) the `grantedPaths` allowlist per invocation.
- The renderer's `useCanvas.ts`'s `onOpenFiles` has no in-flight guard and the "+ Open Files" button has no disabled state.
- A second click while a first batch's reads are still pending wipes the first batch's allowlist grants mid-flight.
- The first batch's still-pending `readAudioFile` IPC calls then reject with "Access denied".
- The unguarded loop throws before `addTracks(files)` is ever called.
- Every file already read in that first batch is silently discarded with zero UI feedback (unhandled promise rejection).

**Why it's a regression** (specific to Slice B): Previously, two concurrent opens were merely wasteful (both reading the same files). After Slice B's allowlist implementation, they are now data-lossy (first batch's reads get wiped mid-flight).

**The fix** (implemented, validated, then reverted):
- `src/renderer/components/Canvas/useCanvas.ts` — added an `isOpeningFilesRef` (useRef, checked synchronously before any render), so a second invocation while one is in flight is an immediate no-op; wrapped dialog+read+addTracks in try/finally to ensure flags clear.
- `src/renderer/components/Canvas/Canvas.tsx` — disables the "+ Open Files" button while a batch is in flight (`disabled={isOpeningFiles}`).
- `onDrop` confirmed unaffected (uses browser `File.arrayBuffer()`, never calls `readAudioFile`).
- RED→GREEN validated: 2 tests added to `Canvas.test.tsx` (overlapping-batch no-op guard, button disabled/re-enabled); pre-fix 11/11, post-fix 13/13 passing; full suite 148/148 after fix.
- **Reverted before archive** because the 3 files (`Canvas.tsx`, `useCanvas.ts`, `Canvas.test.tsx`) were never part of the originally-reviewed diff scope, and the native bounded-review tool's correction mechanism cannot widen scope without explicit authorization (not granted).

**User decision** (explicit, after being shown the tradeoff): Accept this known, corroborated race-condition risk and archive the change without the B.12 fix. The working fix is tracked as a separate follow-up change with its own clean review scope.

**Follow-up change**: A new TODO item has been added to `doc/TODO.md` (Coding improvements section) for the deferred fix: "**Guard against overlapping Open-Files imports.**" describing the exact bug and noting the prototyped fix for whoever picks this up next.

## Observation IDs (from Engram, for traceability)

| Artifact | Observation ID | Status |
|----------|---|---|
| Proposal | #35 | active |
| Design | #36 | active |
| Spec | #37 | active |
| Tasks | #38 | active |
| Apply-Progress | #39 | active |
| Verify-Report | #40 | active (re-verified post-B.11) |

## Change Contents

**All 3 slices shipped**:
- **Slice A**: `_stopSource` narrowing + per-file import isolation (6 tasks complete)
- **Slice B**: IPC path allowlist + fs try/catch + B.10 post-verify fix + B.11 post-review-resilience fix (11 tasks complete; B.12 reverted)
- **Slice C**: Fake-timer infra + fade/loop/setter coverage (10 tasks complete)

**Files changed** (11 files, 540 insertions + 80 deletions):
- `src/renderer/audio/AudioEngine.ts` — `_stopSource` catch narrowed
- `src/renderer/context/AudioContext.tsx` — `addTracks` per-file try/catch
- `src/main/main.ts` — allowlist + fs try/catch (B.4-B.7)
- `src/main/preload.ts` — widened `saveRecording` return type (B.11)
- `src/renderer/types/electron.d.ts` — widened `ElectronAPI.saveRecording` (B.11)
- `src/renderer/components/Recorder/useRecorder.ts` — inspects save result (B.11)
- `src/renderer/components/Recorder/RecorderBar.tsx` — renders "Save failed" state (B.11)
- `src/__tests__/audio/AudioEngine.test.ts` — 11 new tests (A.1-A.2, C.2-C.10)
- `src/__tests__/context/AudioContext.test.tsx` — 1 new test (A.3)
- `src/__tests__/main/main.test.ts` — 4 new + 1 updated test (B.1-B.3, B.8, B.10)
- `src/__tests__/components/Recorder/RecorderBar.test.tsx` — 1 new test (B.11)

## Documentation Updates

**doc/TODO.md**:
- Line 260: `[ ]` marked as `[x]` (DONE) with explicit note: "Fixed via ref/error-handling-gaps (3 stacked slices: _stopSource narrowing, per-file import isolation, IPC path allowlist + fs hardening, fake-timer test coverage). One CRITICAL finding (overlapping Open-Files batch race) was found during review-resilience lens, fixed and validated but reverted due to review-scope constraints; tracked as a separate follow-up change with explicitly accepted interim risk."

**doc/FUTURE-IMPROVEMENTS.md**:
- § 2 status updated from "**Status:** [pending]" to "**Status: [x] DONE**" with same note as above.
- New entry added to "Coding improvements" section: "**Guard against overlapping Open-Files imports.**" describing the exact race and noting the prototyped fix.

## Archive Integrity

- All original artifacts preserved in archive folder: `proposal.md`, `design.md`, `exploration.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `specs/` subdirectory with 3 spec files.
- No stale unchecked implementation tasks in archived `tasks.md` (all 27/27 checked).
- Change folder removed from `openspec/changes/error-handling-gaps/` (active).
- Date-prefixed archive folder: `2026-07-26-error-handling-gaps/` follows existing convention.

## Risks and Mitigations

**Known Risk (ACCEPTED)**: Overlapping-batch-import race condition (CRITICAL severity, but deferred by user decision).
- **Mitigation**: Documented explicitly in this report and in `doc/TODO.md`; tracked as a separate follow-up change; working fix already prototyped and validated.

**No other blockers**: All tests pass, typecheck clean, lint clean, spec compliance 10/10 scenarios, task completion 27/27. The change is functionally complete and safe to use; the deferred race is an edge case (requires rapid double-clicking "Open Files" while first batch is still reading).

## Recommendation for Next Work

1. Pick up the deferred "Guard against overlapping Open-Files imports" TODO item (new entry in `doc/TODO.md`).
2. Create a new `sdd-change` proposal for this fix with clean scope (`Canvas.tsx`/`useCanvas.ts`/`Canvas.test.tsx` only).
3. The prototyped fix from this change's B.12 attempt is the exact solution — reuse the test structure and implementation pattern.

## Summary

**Status**: ARCHIVED AND CLOSED

This change is functionally complete, fully tested (146/146), and successfully merged into the codebase. All planned work (27 tasks) is done. One CRITICAL finding from a distinct review-resilience pass was deliberately reverted and accepted as a known risk by the user, rather than widening the change's review scope. The fix is tracked for follow-up work.

The archived spec files (`batch-import-resilience`, `audio-file-access-security`, `audio-engine-error-handling`) are now the source of truth for the implemented behavior. No further action is needed for this change itself; future work continues with the identified follow-up items in `doc/TODO.md`.
