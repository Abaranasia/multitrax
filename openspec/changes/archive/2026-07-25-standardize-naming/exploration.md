# Exploration: Standardize naming and extract magic numbers in the effects code

Source: `doc/TODO.md` line 272, detailed in `doc/FUTURE-IMPROVEMENTS.md` § 3 (lines 96-112).

## Current State (verified against real source on `ref/standardize-naming`)

The doc is **partially stale** — it predates the just-merged `reduce-effect-duplication` change
(archived at `openspec/changes/archive/2026-07-25-reduce-effect-duplication/`), which already
fixed one of its three bullets as a side effect of consolidating the effect setters onto named
`*Settings` objects (`src/renderer/audio/effectSettings.ts`).

**1. `outputLevel` vs `output` — remaining, but much smaller than the doc describes.**
`effectSettings.ts` already defines the canonical public shape with `output` for all 4 effect
interfaces, and `AudioContext.tsx`, `audioContextInstance.ts`, the 4 `use*SettingsDialog.ts` hooks,
and domain `TrackState` (`filterOutput`/`delayOutput`/`reverbOutput`/`distortionOutput`) already use
`output`/`*Output` consistently — verified by direct read, not just the doc's claim. The doc's cited
line numbers (`audioContextInstance.ts:38,46,54,61`, `AudioContext.tsx:313,344,375,400`) describe
code that has already been renamed.

What remains: `AudioEngine.ts`'s 4 **internal** per-track node interfaces (`FilterNodes`,
`DistortionNodes`, `DelayNodes`, `ReverbNodes`, lines ~64-128) still declare an `outputLevel` field,
assigned via `X.outputLevel = clamp(output, 0, 100)` in each setter and read again for the gain ramp
(`X.outputGain.gain.setTargetAtTime(X.outputLevel / 100, ...)`). Grep-confirmed: 24 occurrences in
`AudioEngine.ts` + 9 white-box assertions in `AudioEngine.test.ts`
(e.g. `expect(filter.outputLevel).toBe(0)` via `(engine as any).tracks.get(id)...`). This is now a
pure internal-consistency rename confined to one file + its own test file — not a cross-layer
problem.

**2. `mix` parameter position — already fully resolved, no work needed.**
Verified directly: all four setters (`setFilterSettings(id, s: FilterSettings)` etc.,
`AudioEngine.ts:503/531/560/591`) take a single named settings object. Every caller — the 4 dialog
hooks, `AudioContext.tsx`'s 4 wrapper callbacks (lines 308-399), and every test call — passes an
object literal with named keys. There is no positional "Nth argument" for `mix` anymore.
`effectSettings.ts`'s own doc comment states this was done specifically to close "the reorder
type-safety gap." **This bullet is dropped from scope**, not re-implemented.

**3. Magic numbers — still valid, unresolved.**
- `0.01` ramp time-constant: 22 occurrences in `AudioEngine.ts` (grep-confirmed).
- Reverb preDelay clamp: `clamp(preDelay, 0, 500)` at line 600 (doc's `:608` reference has shifted).
- Fade-duration clamps: `clamp(fadeInDuration/fadeOutDuration/seekFadeDuration, 0, 10)` at lines
  496-498 (doc's `:487-489` has shifted).
- Existing pattern to match (lines 21-53): `DAMPING_MIN_HZ`/`MAX_HZ`, `DELAY_TIME_MAX_S`/`MAX_MS`,
  `DELAY_FEEDBACK_MAX`, `FILTER_CUTOFF_MIN_HZ`/`MAX_HZ`, `FILTER_RESONANCE_MIN`/`MAX`,
  `DISTORTION_MAX_K`.

## Affected Areas
- `src/renderer/audio/AudioEngine.ts` — 4 internal node interfaces + 4 setter bodies + 4
  construction sites need `outputLevel` → `output`; 22× `0.01` + preDelay/fade-duration bounds need
  named constants added to the existing const block (~lines 21-53).
- `src/__tests__/audio/AudioEngine.test.ts` — 9 assertions reference `.outputLevel` directly; must
  change in lockstep or the suite fails to compile/pass.
- `src/renderer/audio/effectSettings.ts` — no functional change; its historical doc comment
  (lines 16-18) about the old split could optionally be trimmed, not load-bearing.
- No change needed: `audioContextInstance.ts`, `AudioContext.tsx`, the 4 dialog hooks, `TrackState`
  — already consistent (confirmed by reading, not assumed).

## Approaches

1. **Single combined slice** (rename + constants in one PR, item #2 noted as already-resolved).
   - Pros: one coherent cleanup PR, ~60-70 changed lines, well under the 400-line review budget, no
     cross-file risk.
   - Cons: bundles two conceptually distinct micro-refactors.
   - Effort: Low.

2. **Two slices** (rename, then constants) — matches the prior change's slice-per-concern pattern.
   - Pros: cleaner single-purpose diffs, easier to bisect.
   - Cons: extra process overhead for a change this small.
   - Effort: Low per slice.

3. **Defer** — leave as-is.
   - Pros: zero risk/effort. Cons: leaves the TODO unresolved.

## Recommendation

Approach 1. Both remaining items are same-file, mechanical, low-risk. Drop item #2 from the
proposal's scope (mark as already resolved by `reduce-effect-duplication`) rather than
re-implementing it. Update the 9 `AudioEngine.test.ts` assertions atomically with the rename
(Strict TDD: RED then GREEN).

## Risks

- The 9 white-box test assertions must move in the same commit as the internal rename or the suite
  breaks.
- `doc/TODO.md`/`doc/FUTURE-IMPROVEMENTS.md` are stale on item #2 (claims a problem that no longer
  exists) and on line numbers for item #3 — the proposal should cite current line numbers, not the
  doc's.
- Scope-creep risk: do not touch UI-facing "Output" labels/copy — out of scope.

## Ready for Proposal

Yes — scope narrowed and file:line references confirmed against live source; item #2 dropped as
already resolved by the merged `reduce-effect-duplication` change.
