# Exploration: Fix known error-handling gaps and close test-coverage holes in the audio engine

Source: `doc/TODO.md` line 260, detailed in `doc/FUTURE-IMPROVEMENTS.md` § 2 "Correctness /
robustness" (lines 73-94).

## Current State (verified against real source on `ref/error-handling-gaps`)

All four sub-items confirmed present; only `AudioEngine.ts` line numbers had drifted (consistently
+2 from the doc's citations — `912→914`, `936→938`, `993→995`). `AudioContext.tsx:22` and
`main.ts:82-86` citations were exact.

**1. `_stopSource` swallows ALL errors — `src/renderer/audio/AudioEngine.ts:914-923`**
```ts
private _stopSource(track: TrackNodes): void {
  if (track.sourceNode) {
    try {
      track.sourceNode.stop();
    } catch (error) {
      console.warn('Error: ', error)
    }
    track.sourceNode.disconnect();
    track.sourceNode = null;
  }
}
```
`AudioBufferSourceNode.stop()` only throws `InvalidStateError` ("already stopped/never started") —
the one expected case. Any other error is caught by the same generic block and reduced to
`console.warn`. Traced via codegraph: every stop/pause/seek/loop path funnels through this private
method — `stop()` (:344), `pause()` (:328), `seek()` (:377, 3 sites), `removeTrack()` (:244),
`_startFadeOut` (:995), `_cancelFadeOut` (:1010).

**2. Batch `decodeAudioData` import loop — `src/renderer/context/AudioContext.tsx:22-98`
(`addTracks`)**
No per-file try/catch around `decodeAudioData` (line 28). Worse than the doc implies:
`setTracks(...)` only runs **after** the whole loop completes, so a corrupt file N doesn't just
abort files N+1..end — it discards every already-decoded file 0..N-1 too, since `newEntries` never
reaches state. Both callers have zero error handling: `src/renderer/components/Canvas/useCanvas.ts:38`
(`onDrop`) and `:55` (`onOpenFiles`) — neither awaits inside a try/catch, so a rejection becomes an
unhandled promise rejection with no user feedback about which file failed.

**3. `fs:readAudioFile` IPC handler — `src/main/main.ts:82-86` (security-relevant, confirmed with
real weight)**
```ts
ipcMain.handle('fs:readAudioFile', (_event, filePath: string) => {
  const resolved = path.resolve(filePath);
  const data = fs.readFileSync(resolved);
  return data.buffer;
});
```
Cross-checked against `src/main/preload.ts:6-7`:
```ts
readAudioFile: (filePath: string): Promise<ArrayBuffer> =>
  ipcRenderer.invoke('fs:readAudioFile', filePath),
```
exposed via `contextBridge.exposeInMainWorld('electronAPI', {...})`. **Confirmed zero validation
exists today**: no check that `filePath` was ever returned by `dialog:openAudioFiles`, no directory
allowlist, no extension check, no traversal guard, no size cap. `window.electronAPI.readAudioFile(anyString)`
is callable by any renderer-side JS. The only "legitimate" caller (`useCanvas.ts:50`, looping `paths`
from `openAudioFiles()`) is convention only — main.ts enforces nothing. `webPreferences` correctly
sets `contextIsolation: true` / `nodeIntegration: false` (main.ts:16-20) — that boundary is fine; the
gap is the exposed API's missing validation, a genuine arbitrary-file-read primitive if the renderer
is ever compromised. Also confirmed: `main.ts:76` (`fs.writeFileSync` in `dialog:saveRecording`) and
`main.ts:84` (`fs.readFileSync`) have **no try/catch** — existing tests
(`src/__tests__/main/main.test.ts`, `preload.test.ts`) only cover the happy path.

**4. Untested fade/loop scheduling — exact current lines confirmed:**
- `_playLoopWithFade` — `AudioEngine.ts:938-992` (~55 lines, recursive re-invocation via
  `source.onended`)
- `_startFadeOut` — `AudioEngine.ts:995-1007`
- `_cancelFadeOut` — `AudioEngine.ts:1010-1018`
- `setLoop` (:474-479), `setFadeIn` (:483-486), `setFadeOut` (:488-491), `setSeekFade` (:493-496),
  `setFadeDurations` (:498-509), `getRecordingStream` (:186-188)

Grep-confirmed in `src/__tests__/audio/AudioEngine.test.ts`: only `setFadeDurations` (clamp-only) and
`setSeekFade` (used as unrelated test setup) appear at all — matches codegraph's blast-radius output
exactly. `setLoop`, `setFadeIn`, `setFadeOut`, `getRecordingStream`, `_playLoopWithFade`,
`_startFadeOut`, `_cancelFadeOut`, `_stopSource` have **zero** direct coverage. Gotcha:
`_startFadeOut`/`_cancelFadeOut`/seek's cross-fade branch use real `setTimeout`, and the existing
test file never uses `vi.useFakeTimers()` — testing these requires introducing fake-timer
infrastructure, not just new cases.

## Affected Areas
- `src/renderer/audio/AudioEngine.ts` — narrower `_stopSource` catch (:914-923); new tests needed
  for :938-1018 and the 6 setters/`getRecordingStream` (likely test-only, no impl change)
- `src/renderer/context/AudioContext.tsx` — `addTracks` (:22-98) needs per-file try/catch + a
  partial-failure result shape
- `src/renderer/components/Canvas/useCanvas.ts` — `onDrop` (:24-41), `onOpenFiles` (:43-56) need to
  surface per-file failures (no toast/notification mechanism currently exists anywhere in the
  codebase — confirm before designing UI surface)
- `src/main/main.ts` — `fs:readAudioFile` (:82-86) needs path validation + try/catch;
  `dialog:saveRecording`'s `fs.writeFileSync` (:76) needs try/catch
- `src/__tests__/audio/AudioEngine.test.ts` — needs `vi.useFakeTimers()` + 8 new test blocks
- `src/__tests__/main/main.test.ts` — needs rejected-path and thrown-fs-call cases

## Approaches (item 3 — treated with security weight per instructions)

1. **Session-scoped path allowlist** — `dialog:openAudioFiles` populates a `Set<string>` of resolved
   paths; `fs:readAudioFile` rejects anything not in it.
   - Pros: closes the primitive completely; additive; no new IPC channel.
   - Cons: new main-process state needs a bound/reset policy.
   - Effort: Low-Medium.

2. **Extension/directory allowlist only, no state**
   - Pros: stateless.
   - Cons: does NOT close the primitive — a compromised renderer can still read any file with an
     audio extension anywhere on disk. Weaker than the actual threat model.
   - Effort: Low.

3. **Combine both** (allowlist + try/catch hardening)
   - Pros: most robust, each layer covers a different failure mode.
   - Cons: marginally more code.
   - Effort: Medium.

## Recommendation

Approach 3 for item 3 — extension-only checks don't close the actual arbitrary-read primitive, and
the task explicitly calls for real security weight here. Items 1, 2, 4 are straightforward,
low-effort, same-file fixes. Given four independently-scoped sub-items with different effort
profiles, a stacked-slices delivery (mirroring `reduce-effect-duplication`'s pattern) is likely
appropriate at `sdd-tasks` time — item 3 (with tests) and item 4 (8 tests + fake-timer infra) are
substantial enough to be their own slice(s); items 1 and 2 can combine or stand alone.

## Risks

- `FUTURE-IMPROVEMENTS.md` § 2's `AudioEngine.ts` citations are off by exactly +2 lines across all
  four sub-items — re-confirm at spec/tasks time.
- Item 3's allowlist design introduces new main-process state with no prior precedent — needs an
  explicit bound/reset policy decided at design time.
- Item 2 changes `addTracks`'s external contract (today: all-or-nothing `Promise<void>`) to
  partial-success semantics — both `useCanvas.ts` callers must be updated; no existing toast/
  notification mechanism found anywhere in the codebase to surface per-file failures, so the design
  must either introduce a minimal one or accept `console.error`-only for this slice.
- Item 4 is test-only but non-trivial: introducing `vi.useFakeTimers()` is new shared test
  infrastructure and must interact correctly with `FakeSource.stop()`'s existing real
  `setTimeout(..., 0)` scheduling.
- Unlike the prior two mechanical changes on this branch lineage (naming, duplication), this touches
  security-relevant IPC surface (item 3) — per review-lens rules this is at minimum `review-risk`
  tier, not `review-readability`/`review-reliability`.

## Ready for Proposal

Yes — all four sub-items verified against live source with exact current line numbers and traced
callers. Recommend confirming the allowlist-state design and `addTracks` partial-failure contract
shape during `sdd-design`, and flagging at least `review-risk` for post-apply review given the
IPC/security surface.
