# Design: Close Error-Handling Gaps and Test-Coverage Holes in the Audio Engine

## Technical Approach

Three independently-revertible stacked slices, each a localized robustness fix that preserves observable behavior for the happy path and adds a gating test for the failure path. Contracts stay unchanged: `addTracks` keeps `Promise<void>`; import failures surface via `console.error` only (no new UI). Slice B is the security slice (IPC allowlist + `fs` hardening) and carries `review-risk` weight. Line numbers re-confirmed against current source (docs drift ~+2 in AudioEngine.ts).

- **Slice A** = item 1 (`_stopSource` narrowing) + item 2 (per-file import isolation).
- **Slice B** = item 3 (session-scoped IPC path allowlist + `fs` try/catch).
- **Slice C** = item 4 (fake-timer infra + fade/loop coverage).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| A1 `_stopSource` narrowing | `catch (error) { if (error instanceof DOMException && error.name === 'InvalidStateError') return; console.error(...); }` — swallow only the spec'd double-stop throw, log everything else distinctly | Keep blanket `console.warn`; rethrow unexpected | `stop()`'s only spec'd throw is `InvalidStateError` (node never started / already stopped) — benign. Any other error was a genuine failure previously hidden; `console.error` makes it visible without crashing the fade/remove path that calls `_stopSource`. Still `disconnect()` + null after either branch (unconditional cleanup unchanged) |
| A2 import isolation | Wrap each file's `decodeAudioData`+`addTrack`+state build in a per-iteration `try/catch` inside the existing `for` loop; `console.error(file.name, err)` on failure and `continue`; push successes into `newEntries` as today; call `setTracks` once after the loop with whatever succeeded | Change signature to `{succeeded,failed}`; abort batch on first failure | Contract stays `Promise<void>` (confirmed decision). Both callers (`useCanvas.ts` `onDrop`/`onOpenFiles`) already `await addTracks(files)` and ignore the return — no consumer change. A corrupt file no longer discards already-decoded tracks. No existing `AudioContext.test.tsx` test assumes all-or-nothing (all add single valid files) |
| B1 allowlist location & lifetime | Module-level `const grantedPaths = new Set<string>()` in `main.ts` (one main process; multiple `BrowserWindow`s share it harmlessly). `dialog:openAudioFiles` does `grantedPaths.clear()` then adds each `path.resolve(p)` of its own resolved `filePaths` before returning them — **REPLACE** per dialog call | Accumulate for app lifetime; per-window Maps; persist | Confirmed "reset per open-dialog" = tighter security. `useCanvas.onOpenFiles` reads every path immediately in the same loop right after the dialog resolves; `onDrop` never calls `readAudioFile` (uses `File.arrayBuffer()`). No cross-call read exists, so REPLACE cannot break a legitimate read |
| B2 `fs:readAudioFile` guard | `const resolved = path.resolve(filePath); if (!grantedPaths.has(resolved)) throw new Error('Access denied: path not granted by file dialog'); ` then `readFileSync` in try/catch | Extension/dir allowlist; silent empty return | Membership check on resolved path closes the arbitrary-read primitive. Throwing rejects the IPC promise with a clear message the renderer can log — never silently returns empty data |
| B3 `fs` write/read hardening | `dialog:saveRecording` wraps `writeFileSync` in try/catch → return `{ saved: false, error: message }` (existing shape already `{saved}`). `fs:readAudioFile` wraps `readFileSync` in try/catch → rethrow as `Error` (reject IPC) | Let exceptions escape the handler (crashes/opaque IPC error) | A throwing `writeFileSync` no longer aborts the handler opaquely; caller gets a structured non-saved result. Read failures reject with a clean message |
| C1 fake-timer scoping | New nested `describe('fade/loop scheduling')` with `beforeEach(vi.useFakeTimers)` / `afterEach(vi.useRealTimers)`; tests drive time via `vi.advanceTimersByTime(ms)`. Shared `FakeSource`/`FakeGain`/`FakeAudioContext` untouched | Global `useFakeTimers` for the file; add a fake-timer variant fixture | `FakeSource.stop()`'s real `setTimeout(0)` becomes fake-timer-driven automatically inside the scoped block and is flushed by `advanceTimersByTime`/`runAllTimers`. Scoping keeps the other ~120 real-timer tests stable — smallest safe change |

## Data Flow

```
Slice B (security):
  renderer onOpenFiles ─► IPC dialog:openAudioFiles ─► showOpenDialog
                                    │ grantedPaths.clear(); add resolve(filePaths)
                                    ▼ returns filePaths
  renderer readAudioFile(p) ─► IPC fs:readAudioFile ─► resolve(p) ∈ grantedPaths?
                                    ├─ yes ─► readFileSync (try/catch) ─► ArrayBuffer
                                    └─ no  ─► throw 'Access denied' (reject)
```

## File Changes

| File | Action | Slice |
|------|--------|-------|
| `src/renderer/audio/AudioEngine.ts` (`_stopSource` ~914-923) | Modify | A |
| `src/renderer/context/AudioContext.tsx` (`addTracks` loop 22-98) | Modify | A |
| `src/__tests__/context/AudioContext.test.tsx` (add partial-failure test) | Modify | A |
| `src/main/main.ts` (allowlist + `fs` try/catch, 52-86) | Modify | B |
| `src/__tests__/main/main.test.ts` (seed allowlist via dialog; add deny + throw tests; update existing `fs:readAudioFile` test to read a granted path) | Modify | B |
| `src/__tests__/audio/AudioEngine.test.ts` (fake-timer describe + fade/loop/setter blocks) | Modify | C |

## Interfaces / Contracts

```ts
// main.ts — no exported API change; internal module state
const grantedPaths = new Set<string>(); // resolved absolute paths, replaced each dialog
// addTracks stays: (files) => Promise<void>  (log-only on per-file failure)
```

## Testing Strategy

| Slice | RED → GREEN |
|-------|-------------|
| A | `_stopSource`: InvalidStateError swallowed, other error → `console.error` (spy). `addTracks`: 2 files, first `decodeAudioData` rejects → 1 track retained + `console.error` called |
| B | `fs:readAudioFile` on non-granted path throws; on granted path (after `openAudioFiles`) returns buffer; `readFileSync`/`writeFileSync` throwing → handled result/reject |
| C | Fake timers drive `_startFadeOut`/`_cancelFadeOut`/`_playLoopWithFade`, `setLoop/setFadeIn/setFadeOut/setSeekFade/setFadeDurations`, `getRecordingStream` |

## Threat Matrix

Applicable — process/IPC boundary (Slice B). `fs:readAudioFile` is an arbitrary-file-read primitive callable from a compromised renderer.

| Row | Status | Safe behavior | RED test |
|-----|--------|---------------|----------|
| Untrusted path → host FS read | Applicable | Reject any path not granted by the dialog in this session | Non-granted path throws `Access denied` |
| Path traversal / symlink normalization | Applicable | `path.resolve` before membership check; only exact resolved dialog paths pass | Read of `../` sibling not in set throws |
| FS exception (missing/locked file) | Applicable | try/catch → structured reject, no handler crash | `readFileSync`/`writeFileSync` throw → clean IPC error / `{saved:false}` |
| Shell / subprocess / routing / PR automation | N/A | No shell, subprocess, or VCS automation in scope | — |

## Migration / Rollout

No data migration. Stacked PRs A→B→C, each revertible alone. Slice B changes observable IPC behavior (previously-allowed arbitrary reads now rejected) and updates the existing `main.test.ts` read test to seed the allowlist first — expected, gated by tests.

## Open Questions

- [ ] Confirm each slice stays under the 400-line budget at `sdd-tasks` (Slice C adds ~8 test blocks + fixture wiring — highest line count; split fade vs. setter blocks if it exceeds).
