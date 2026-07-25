# Tasks: Reduce Effect Dialog / Engine / Test Duplication

## Review Workload Forecast

| Slice | Est. changed lines | 400-line risk | Notes vs design guess |
|---|---|---|---|
| 1 test-utils | 200–260 | Low | design ~150; real (8 files × ~22-line stub delete + factory) is higher, still safe |
| 2 shared CSS | 500–650 | **High** | design ~250 too low; 5 files avg 109 lines, shrink to ~12 kept ⇒ ~460 deleted + ~110 new shared file |
| 3 shared JSX | 500–750 | **High** | design ~350 too low; 5 dialogs (99–122 lines each) rewritten, not just trimmed |
| 4 generic hook | 250–370 | Medium | design ~300 plausible; TrackPlayer.tsx/barrel churn small since props frozen |
| 5 clamp/wiring | 150–220 | Low | design ~250 conservative; clamp swap is 1-line-for-1-line |
| 6 setter consolidation | 300–400 (destructure-at-top) up to 450+ (if every ref rewritten) | **High** | matches design's own flagged risk; borderline |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

Rationale: chain strategy already resolved (force-chained/stacked-to-main from preflight), so no new chain decision is needed. But slices 2, 3, 6 independently risk exceeding 400 lines — recommend sub-splitting during apply if actual diff confirms the high end:
- 2a: `effect-dialog.css` + Filter/Distortion/Fade CSS shrink | 2b: Delay/Reverb CSS shrink
- 3a: `EffectDialog.tsx`+`SettingsField.tsx` + Filter/Distortion dialogs | 3b: Delay/Reverb/Fade dialogs
- 6a: `AudioEngine.ts`+`effectSettings.ts`+`audioContextInstance.ts`+`AudioEngine.test.ts` | 6b: `AudioContext.tsx`(4 callbacks+duplicateTrack)+4 wrapper hooks

### Suggested Work Units

| Unit | Goal | PR | Focused test | Harness | Rollback |
|---|---|---|---|---|---|
| 1 | test-utils factory | PR1 | `vitest run` 8 test files | N/A — pure test refactor | revert PR1 only |
| 2(a/b) | shared CSS | PR2(a/b) | dialog test DOM assertions | manual: open each dialog, compare visuals | revert slice, CSS-only |
| 3(a/b) | shared JSX | PR3(a/b) | 5 dialog tests + `TrackPlayer.test.tsx` | manual: open/apply/cancel each dialog | revert slice, props frozen |
| 4 | generic hook | PR4 | `TrackPlayer.test.tsx` | manual: edit+apply+cancel each dialog | revert slice, wrappers isolated |
| 5 | clamp/factory | PR5 | `AudioEngine.test.ts` | N/A — no UI change | revert slice, engine-internal |
| 6(a/b) | setter consolidation | PR6(a/b) | `AudioEngine.test.ts`+`AudioContext.test.tsx`+`TrackPlayer.test.tsx` | manual: duplicate track w/ non-default effects | revert slice, last in chain |

## Slice 1: test-utils (PR 1)
- [x] 1.1 RED: import `test-utils/mockAudioEngine` in `TrackPlayer.test.tsx` (fails, missing)
- [x] 1.2 GREEN: create `mockAudioEngine.ts` — `createMockAudioEngine()` (verbatim stub, fresh `vi.fn()`s)
- [x] 1.3 GREEN: 8 test files import factory, drop inline stub
- [x] 1.4 Parity gate: full suite green

## Slice 2: shared CSS (PR 2)
- [x] 2.1 RED: dialog test asserts shared class from `effect-dialog.css` (fails, missing) — N/A, see deviation note in apply-progress.md (CSS-only change, no jsdom CSS loading in Vitest; existing dialog tests + full-suite baseline serve as the RED/parity gate per orchestrator instruction)
- [x] 2.2 GREEN: create `effects/effect-dialog.css` (grouped selectors, 5 prefixes)
- [x] 2.3 GREEN: shrink 5 `*SettingsDialog.css` to `--effect-accent` + apply-button colors (+ `--effect-value-width` for Fade, see deviation note)
- [x] 2.4 Parity gate: full suite green, same classNames
- [x] 2.5 If diff >400: split 2a/2b per forecast — done; measured 2a alone (530 lines) still exceeds 400, see apply-progress.md

## Slice 3: shared JSX (PR 3)
- [ ] 3.1 RED: per-dialog test asserts `<EffectDialog>`/`<SettingsField>` chrome (fails)
- [ ] 3.2 GREEN: create `EffectDialog.tsx` + `SettingsField.tsx`
- [ ] 3.3 GREEN: rewrite 5 `*SettingsDialog.tsx` via shared components, same external props
- [ ] 3.4 GREEN: update `components/index.ts`
- [ ] 3.5 Parity gate: full suite green — rows/labels/values/`<select>` options unchanged
- [ ] 3.6 If diff >400: split 3a/3b per forecast

## Slice 4: generic hook (PR 4)
- [ ] 4.1 RED: `TrackPlayer.test.tsx` open/apply/cancel expects `useSettingsDialog` re-sync (fails)
- [ ] 4.2 GREEN: create `useSettingsDialog.ts` (`isOpen,draft,setField,open,close,apply`)
- [ ] 4.3 GREEN: rewrite 5 `use*SettingsDialog.ts` as thin wrappers, same flat `draftX/setDraftX` shape
- [ ] 4.4 GREEN: update `TrackPlayer.tsx:111-115` + `components/index.ts`
- [ ] 4.5 Verify ADDED "hook contract stays identical": open reseeds, apply commits+closes, cancel discards (`TrackPlayer.test.tsx` only, no isolated hook test)
- [ ] 4.6 Parity gate: full suite green

## Slice 5: AudioEngine clamp/wiring (PR 5)
- [ ] 5.1 RED: `AudioEngine.test.ts` pins one clamp boundary pre-extraction
- [ ] 5.2 GREEN: add `clamp(v,min,max)`; replace 24 inline `Math.max/min` sites
- [ ] 5.3 GREEN: add `_createDryWetOutput()`; wire into filter/delay/reverb/distortion builders
- [ ] 5.4 Parity gate: full suite green — same clamped values/wiring

## Slice 6: setter consolidation (PR 6)
- [ ] 6.1 RED: `AudioEngine.test.ts` calls use object-arg shape (fails)
- [ ] 6.2 GREEN: create `effectSettings.ts` (Filter/Delay/Reverb/DistortionSettings; canonical `output`)
- [ ] 6.3 GREEN: `AudioEngine.ts` 4 setters → `(id, s: XSettings)`, destructure at top (no per-line rewrite)
- [ ] 6.4 GREEN: `audioContextInstance.ts` + `AudioContext.tsx` (4 callbacks + `duplicateTrack`) → object shape
- [ ] 6.5 GREEN: 4 wrapper hooks' `apply()` pass settings object
- [ ] 6.6 Verify ADDED "setter consolidation preserves values/clamping": duplicate-track parity + no positional swap
- [ ] 6.7 Parity gate: full suite green
- [ ] 6.8 If diff >400: split 6a/6b per forecast
