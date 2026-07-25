# Proposal: Reduce Effect Dialog / Engine / Test Duplication

## Intent

Six confirmed duplication points (`doc/FUTURE-IMPROVEMENTS.md` §1 / `doc/TODO.md`:239) inflate maintenance cost across 5 effect dialogs, the audio engine, and 8 test files. A change to one dialog/setter must be hand-mirrored across 4–8 sites; positional setter args are not type-checker-safe against reordering. Goal: remove the duplication with **behavior parity** (no functional change), delivered as chained/stacked-to-main slices under the 400-line budget.

## Scope

### In Scope (6 chained slices, in order)
1. **test-utils**: extract the verbatim `mockAudioEngine` stub into `src/__tests__/test-utils/`; import in all 8 test files. Lowest risk, de-risks later diffs. ~150 lines.
2. **shared CSS**: shared dialog stylesheet + `--effect-accent` var; per-effect files keep only accent + apply-button colors (Fade included = 5 files). ~250 lines.
3. **shared JSX**: `<EffectDialog>` / `<SettingsField>` wrapping overlay/panel/title/field/actions; 5 components + `TrackPlayer.tsx` JSX (327-393). ~350 lines.
4. **generic hook**: `useSettingsDialog<TDraft>` replacing the 5 near-identical hooks; update `TrackPlayer.tsx:111-115` + `components/index.ts` barrel. ~300 lines.
5. **AudioEngine clamp/wiring**: `clamp()` helper (24 sites) + `_createDryWetOutput()` factory for the 4 node builders. ~250 lines.
6. **setter-signature consolidation** (last, most call sites): single source of truth for the 4 effect-setter shapes across `AudioEngine.ts`, `audioContextInstance.ts`, `AudioContext.tsx` (useCallback + `duplicateTrack`), 5 hook `apply()` calls, `AudioEngine.test.ts`; fold `outputLevel`/`output` naming drift into this. ~350 lines.

### Out of Scope
- Any audio-processing behavior change, new feature, or new isolated hook tests (hooks stay covered via `TrackPlayer.test.tsx` per project convention).
- `_stopSource` error-swallowing and other `doc/FUTURE-IMPROVEMENTS.md` §2+ items.
- Fake Web Audio classes in `AudioEngine.test.ts` (tracked separately).
- Treating `outputLevel`/`output` drift as a standalone bug fix — it is cosmetic, folded into slice 6.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — pure internal refactor, no spec-level requirement change.

## Approach

Approach 2 from exploration: one deliverable slice per duplication point, stacked to main, each independently reviewable and revertible. test-utils lands first so every later slice's test diff is small.

## Affected Areas

| Area | Impact | Slice |
|------|--------|-------|
| `src/__tests__/` (8 test files) | Modified | 1 |
| `.../*SettingsDialog.css` (5) | Modified | 2 |
| `.../*SettingsDialog.tsx` (5) + `TrackPlayer.tsx` | Modified | 3 |
| 5 hooks + `TrackPlayer.tsx` + `components/index.ts` | Modified | 4 |
| `src/renderer/audio/AudioEngine.ts` | Modified | 5, 6 |
| `audioContextInstance.ts`, `AudioContext.tsx` | Modified | 6 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hook consolidation regression (no isolated tests) | Med | Keep `TrackPlayer.test.tsx` green as gate each slice |
| `TrackPlayer.tsx` / barrel high fan-in rename | Med | Update both in same slice |
| Slice exceeds 400 lines | Med | tasks phase forecasts per-slice counts; split if needed |
| Positional-arg reorder not type-safe | Low | Slice 6 consolidates to one shape |

## Rollback Plan

Each slice is an independent PR stacked to main; revert the offending slice's PR without touching the others. Behavior parity means any regression is caught by the existing suite before merge.

## Dependencies

Tracker/feature branch to chain the 6 stacked PRs against.

## Success Criteria

- [ ] All existing tests (`TrackPlayer.test.tsx`, per-dialog, `AudioContext.test.tsx`, `AudioEngine.test.ts`) pass after each slice.
- [ ] Each duplication point has a single source of truth.
- [ ] No audio behavior change; no new user-facing behavior.
- [ ] Each slice PR stays within the 400-line review budget.
