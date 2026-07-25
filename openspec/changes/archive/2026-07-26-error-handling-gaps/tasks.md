# Tasks: Close Error-Handling Gaps and Test-Coverage Holes in the Audio Engine

Strict TDD mode is ACTIVE — every production task is preceded by an explicit RED task.

## Overall Review Workload Forecast

| Slice | PR | Est. changed lines | 400-line risk | Notes |
|---|---|---|---|---|
| A — stop-source + import isolation | PR A | 55–90 | Low | 2 small production edits + 2 new tests |
| B — IPC path allowlist + fs hardening | PR B | 50–75 | Low (size) / review-risk weighted (security surface) | 1 existing test must be updated (expected, not a surprise) |
| C — fade/loop/setter test coverage | PR C (C1→C2) | 190–310, could tip to 390+ | Medium–High | Test-only; pre-split into fade-tests (C1) vs setter-tests (C2) per design's own flag |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

Rationale: `Decision needed before apply: No` because `delivery_strategy=auto-chain` resolves the chain automatically. `Chain strategy: stacked-to-main` matches the design's own "stacked PRs A→B→C, each revertible alone" — no feature-tracker branch requested. The overall `400-line budget risk` line is set to the worst-case slice (`C`) so downstream guards do not under-forecast; A and B individually stay Low (see per-slice forecasts below). If Slice C's actual diff lands under 400 lines as one unit, ship it as a single PR C; otherwise split at the C1/C2 boundary already established in the task list.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| A | Narrow `_stopSource`; isolate per-file import failures | PR A | `vitest run src/__tests__/audio/AudioEngine.test.ts src/__tests__/context/AudioContext.test.tsx` | Manual: drag a corrupt + valid file together into the canvas, confirm the valid one still appears | Revert PR A only — no dependency on B/C |
| B | Session-scoped IPC allowlist + fs try/catch | PR B | `vitest run src/__tests__/main/main.test.ts` | Manual: open dialog, load a file, then attempt reading an un-granted path via devtools IPC call — confirm rejection | Revert PR B only — independent of A/C |
| C1 | Fade/loop fake-timer coverage | PR C1 (or C-first-half) | `vitest run src/__tests__/audio/AudioEngine.test.ts -t "fade/loop scheduling"` | N/A — test-only, no production behavior change | Revert C1 only — new describe block, zero prod diff |
| C2 | Setter + `getRecordingStream` coverage | PR C2 (or C-second-half) | `vitest run src/__tests__/audio/AudioEngine.test.ts` | N/A — test-only, no production behavior change | Revert C2 only — additive tests, zero prod diff |

---

## Slice A: `_stopSource` Narrowing + Batch Import Isolation (PR A)

Spec: `batch-import-resilience` (Per-File Decode Isolation; addTracks Signature Unchanged), `audio-engine-error-handling` (`_stopSource` Distinguishes Expected From Unexpected Stop Errors).

### Review Workload Forecast — Slice A

| Field | Value |
|-------|-------|
| Estimated changed lines | 55–90 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (position 1 of 3) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low
```

- [x] A.1 RED: `src/__tests__/audio/AudioEngine.test.ts` — add test: `sourceNode.stop()` throwing a non-`InvalidStateError` must trigger `console.error` (spy), not be swallowed as the current blanket `console.warn` (fails against current code)
- [x] A.2 RED: `src/__tests__/audio/AudioEngine.test.ts` — add/confirm test: `sourceNode.stop()` throwing `DOMException('InvalidStateError')` is caught silently, no `console.error`/`console.warn` call
- [x] A.3 RED: `src/__tests__/context/AudioContext.test.tsx` — add test: batch of 2 files where the first `engine.audioContext.decodeAudioData` rejects; expect exactly 1 track added (the second file) + `console.error(file.name, err)` called; `addTracks` promise still resolves (fails — current loop aborts, discards the second file)
- [x] A.4 GREEN: `src/renderer/audio/AudioEngine.ts` `_stopSource` (~914-923) — `catch (error) { if (error instanceof DOMException && error.name === 'InvalidStateError') return; console.error(...); }`; keep unconditional `disconnect()` + null after either branch
- [x] A.5 GREEN: `src/renderer/context/AudioContext.tsx` `addTracks` loop (22-98) — wrap per-iteration body (`decodeAudioData` + `engine.addTrack` + waveform/state build) in try/catch; on catch `console.error(file.name, err); continue;`; push successes into `newEntries` as today; single `setTracks` call after the loop; `Promise<void>` signature unchanged
- [x] A.6 Parity gate: full suite green — confirm `useCanvas.ts` callers (`onDrop`/`onOpenFiles`) unaffected (no signature/consumer change)

---

## Slice B: Audio File Access Security (PR B)

Spec: `audio-file-access-security` (Session-Scoped Path Allowlist Gates File Reads; File I/O Handlers Do Not Crash on Filesystem Errors).

### Review Workload Forecast — Slice B

| Field | Value |
|-------|-------|
| Estimated changed lines | 50–75 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (position 2 of 3, review-risk weighted) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low
```

Threat matrix (all applicable, IPC boundary): untrusted path → host FS read; path traversal/symlink normalization; FS exception on read/write. Each maps to an explicit RED task below.

- [x] B.1 RED: `src/__tests__/main/main.test.ts` — add test: `fs:readAudioFile` called with a path never returned by `dialog:openAudioFiles` rejects with an "Access denied" error (fails — no allowlist check exists yet) — covers threat-matrix row "untrusted path → host FS read"
- [x] B.2 RED: `src/__tests__/main/main.test.ts` — add test: after `dialog:openAudioFiles` resolves (mock `filePaths: ['foo.wav']`), `fs:readAudioFile` for `path.resolve('foo.wav')` succeeds and returns the buffer — covers "path traversal/symlink normalization" (resolved-path membership only)
- [x] B.3 RED: `src/__tests__/main/main.test.ts` — add test: `readFileSync` throwing on a granted path rejects the IPC call cleanly (no unhandled crash); `writeFileSync` throwing in `dialog:saveRecording` returns `{ saved: false, error }` instead of throwing — covers "FS exception on read/write"
- [x] B.4 GREEN: `src/main/main.ts` — add module-level `const grantedPaths = new Set<string>();`
- [x] B.5 GREEN: `src/main/main.ts` `dialog:openAudioFiles` handler — `grantedPaths.clear()` then add `path.resolve(p)` for each `result.filePaths` entry before returning (REPLACE semantics per call, never accumulate)
- [x] B.6 GREEN: `src/main/main.ts` `fs:readAudioFile` handler — `const resolved = path.resolve(filePath); if (!grantedPaths.has(resolved)) throw new Error('Access denied: path not granted by file dialog');` then wrap `readFileSync` in try/catch, rethrow as a clean `Error` on failure
- [x] B.7 GREEN: `src/main/main.ts` `dialog:saveRecording` handler — wrap `fs.writeFileSync` in try/catch, return `{ saved: false, error: message }` on throw instead of letting it escape
- [x] B.8 UPDATE (explicit, expected regression per design): `src/__tests__/main/main.test.ts` — the existing `fs:readAudioFile returns ArrayBuffer from fs.readFileSync` test currently reads `/some/path`, which is never dialog-granted and will now be rejected. Update it to call `dialog:openAudioFiles` first (seeding the allowlist with the mock's resolved `foo.wav` path) and read that granted path instead
- [x] B.9 Parity gate: full suite green — confirm `onDrop` (uses `File.arrayBuffer()`, never calls `fs:readAudioFile`) is unaffected
- [x] B.10 (post-verify CRITICAL fix) RED/GREEN: `src/__tests__/main/main.test.ts` — add regression test proving `grantedPaths` REPLACE-vs-accumulate semantics: grant `/path/a.wav` via `dialog:openAudioFiles`, confirm `fs:readAudioFile` succeeds; invoke `dialog:openAudioFiles` again with a different path `/path/b.wav`; assert `/path/a.wav` now rejects with "Access denied" (old grant replaced) and `/path/b.wav` succeeds (new grant active). Confirmed RED by temporarily commenting out `grantedPaths.clear()` in `main.ts` (test failed for the right reason — promise resolved instead of rejecting), then restored `.clear()` and confirmed GREEN (145/145 full suite)
- [x] B.11 (post-review-resilience CRITICAL fix, adversarial code-review pass — not `sdd-verify`) RED/GREEN: silent-data-loss regression at `dialog:saveRecording`/`useRecorder.ts` — B.7's `{ saved: false, error }` return was never inspected by the only caller, so a failed save silently resolved to the same idle/"Record" UI as a success, discarding the recorded buffer with no user-visible or logged trace. Fix: `src/main/preload.ts` and `src/renderer/types/electron.d.ts` — widen `saveRecording`'s return type to `Promise<{ saved: boolean; filePath?: string; error?: string }>` (matches what the handler already returns); `src/renderer/components/Recorder/useRecorder.ts` — inspect the IPC result in `recorder.onstop`: on `saved === false`, `console.error('Failed to save recording', result.error)` and transition to a new distinct `'error'` status (added to `RecorderStatus`) instead of silently reusing the success-path `'idle'`; `src/renderer/components/Recorder/RecorderBar.tsx` — render `'Save failed'` for the new `isError` state so a failed save is visibly distinguishable from a successful one. RED: added a test to `src/__tests__/components/Recorder/RecorderBar.test.tsx` (`saveRecording` mock resolving `{ saved: false, error: 'ENOSPC: no space left on device' }`) asserting both `console.error` was called with the error detail AND the UI shows "Save failed" (not "Record") — confirmed failing against pre-fix code (0 console.error calls, UI showed "Record" as if it had succeeded). GREEN: 146/146 full suite passing (145 baseline + 1 new test), `pnpm typecheck` and `pnpm lint` clean
- [ ] B.12 **REVERTED — deferred to a follow-up change** (post-review-resilience CRITICAL finding, corroborated by refuter — not `sdd-verify`): overlapping-batch-import race in `useCanvas.ts`'s `onOpenFiles` — `dialog:openAudioFiles` REPLACEs (not accumulates) `main.ts`'s `grantedPaths` allowlist per invocation (correct, already covered by B.10). The gap: `onOpenFiles` has no in-flight guard and no try/catch around its per-file `readAudioFile` loop, and the "+ Open Files" button has no disabled state. A second click while a first batch's reads are still pending wipes the first batch's allowlist grants mid-flight, causing the first batch's still-pending `readAudioFile` calls to reject with "Access denied"; the unguarded loop throws before `addTracks(files)` is ever called, silently discarding every already-read file in that batch (unhandled promise rejection, zero UI feedback). This is a real, corroborated regression introduced by Slice B's allowlist (previously two concurrent opens were merely wasteful, not data-lossy).
  A fix was implemented and independently validated (busy-guard in `useCanvas.ts` + disabled state in `Canvas.tsx`, 148/148 tests passing) but was **reverted** because it required editing `Canvas.tsx`/`useCanvas.ts`/`Canvas.test.tsx` — files outside this change's originally-reviewed scope — and the native bounded-review tool's correction mechanism only accepts edits within the originally-frozen file set. Widening the review scope mid-correction requires explicit maintainer authorization that was not granted for this change.
  **Decision (explicit, maintainer-confirmed)**: accept this known risk and archive `error-handling-gaps` without this fix. Track the fix (busy-guard on `onOpenFiles` + disabled Open-Files button while a batch is in flight, exact approach already prototyped and verified working) as a separate follow-up change with its own clean review scope.

---

## Slice C: Fade/Loop/Setter Test Coverage (PR C, test-only)

No spec requirement (test-only, zero production behavior change per design). Highest line-count slice — pre-split into two task-groups (fade-tests vs. setter-tests) so it can ship as one PR or two, depending on actual diff size at apply time.

### Review Workload Forecast — Slice C

| Field | Value |
|-------|-------|
| Estimated changed lines | 190–310 (fade-tests ~110–170, setter-tests ~75–130), could tip to 390+ |
| 400-line budget risk | Medium–High |
| Chained PRs recommended | Yes — pre-split at C1/C2 boundary |
| Suggested split | C1 (fade-tests: `_playLoopWithFade`, `_startFadeOut`, `_cancelFadeOut`) → C2 (setter-tests: `setLoop`, `setFadeIn`, `setFadeOut`, `setSeekFade`, `setFadeDurations`, `getRecordingStream`) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (position 3 of 3; C2 stacks on C1) |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

- [x] C.1 GREEN: `src/__tests__/audio/AudioEngine.test.ts` — add nested `describe('fade/loop scheduling')` with `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())`; reuse existing `FakeSource`/`FakeGain`/`FakeAudioContext` fixtures unmodified — scoped so the ~120 existing real-timer tests stay stable

### C1 — Fade-tests group (measure diff here; split to its own PR if >400 alone)

- [x] C.2 Test `_playLoopWithFade` — loop+fade track: verify the gain automation schedule (fadeIn/fadeOut anchors) and that `source.onended` re-invokes `_playLoopWithFade` for the next cycle when `track.loop` is true, driven via `vi.advanceTimersByTime` (plus a triangulation case: `track.loop=false` — `onended` stops instead of re-invoking)
- [x] C.3 Test `_startFadeOut` — verify gain ramps to 0 over `track.fadeOutDuration`, then `_stopSource` fires and the `afterStop` callback runs once the fake timer elapses
- [x] C.4 Test `_cancelFadeOut` — verify a pending fade-out timer is cleared, source stopped, and gain restored to `track.volume` when canceled mid-fade

### C2 — Setter-tests group (measure diff here; ship as its own PR if C1+C2 combined >400)

- [x] C.5 Test `setLoop` — toggles `track.loop` and propagates to an active `sourceNode.loop` when one exists
- [x] C.6 Test `setFadeIn` / `setFadeOut` / `setSeekFade` — each toggles its respective boolean flag on the track's internal state
- [x] C.7 Test `setFadeDurations` — verify all three durations are clamped to `[0, FADE_DURATION_MAX_S]` (already covered by the pre-existing `setFadeDurations clamps each duration independently to [0,10]` test — confirmed sufficient per design, no new test added)
- [x] C.8 Test `getRecordingStream` — verify it returns the engine's `recorderDest.stream` (identity check against the mocked node)

### Verify

- [x] C.9 Full suite green — confirm the ~120 pre-existing real-timer tests are unaffected (no fake-timer leakage outside the nested `describe`) — 144/144 passing, 19 files
- [x] C.10 Measure actual diff after C.2–C.8: combined Slice C diff measured at 189 authored lines (C1 ≈ 124, C2 ≈ 64) — well under the 400-line budget, so shipped as a single PR C; no split needed
