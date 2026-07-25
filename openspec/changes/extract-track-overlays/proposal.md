# Proposal: Extract Track Overlays (Fade / Delay / Reverb)

## Intent

Pay down tech debt and enforce the standing **"Dialogs and overlays"** convention
(`doc/ARCHITECTURE.md` 219-238, `doc/TODO.md` 212-223): every per-track effect
dialog must be its own component + paired state/logic hook + own test suite, not
inline in the card. Filter and Distortion are already extracted and serve as the
proven template; Fade, Delay, and Reverb remain inline in `TrackPlayer.tsx` /
`useTrackPlayer.ts`. This is a pure structural refactor — behavior preserved.

## Scope

### In Scope
- Extract 3 overlays to the Filter template: `Fade|Delay|Reverb SettingsDialog.tsx`
  + `useFade|Delay|ReverbSettingsDialog.ts` + co-located `.css` + own test suite.
- Rewire `TrackPlayer.tsx` card className to `reverbDialog.isOpen` / `delayDialog.isOpen`
  (was raw booleans, line ~147).
- **Full test cleanup**: relocate Fade/Delay/Reverb tests into dedicated suites AND
  remove leftover duplicate Filter/Distortion tests from `TrackPlayer.test.tsx`
  (prior extractions left them duplicated). End state: all five dialogs' component
  tests live in dedicated suites.
- **Fade parity**: add the missing Fade discard/cancel-draft test and introduce a
  `track-player--fade-open` card state class, matching the other four.

### Out of Scope
- No shared/generic `SettingsDialog` abstraction — replicate the per-dialog template.
- No changes to `AudioContext.tsx` / `AudioEngine` setters (already correct).
- No new audio behavior.

## Capabilities

### New Capabilities
- None (pure structural refactor; behavior preserved).

### Modified Capabilities
- None (no spec-level requirement changes).

## Approach

Mechanical per-dialog extraction mirroring `FilterSettingsDialog`: hook owns
`isOpen` + draft `useState` seeded on `open()`, pulls one `useAudio()` setter,
`apply()` calls `setXSettings(state.id, ...drafts)` then closes; component is pure
presentational (draft/setter pairs + `onApply`/`onCancel`, own `.css`). The three
overlays are **independent** (disjoint fields, setters, CSS classes) → cleanly
sliceable, one overlay per PR.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `TrackPlayer/{Fade,Delay,Reverb}SettingsDialog.tsx` + `.css` + hooks | New | Extracted components/hooks |
| `TrackPlayer/TrackPlayer.tsx` | Modified | Replace inline markup; className uses `dialog.isOpen`; add `--fade-open` |
| `TrackPlayer/useTrackPlayer.ts` | Modified | Remove 3 inline blocks (~54-149) + return surface |
| `__tests__/.../TrackPlayer.test.tsx` | Modified | Relocate + de-duplicate all five suites |
| `doc/TODO.md` | Modified | Check off lines 212-223 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fade parity gap (no cancel test, no state class) | Med | Explicitly add both this change |
| Miss className rewire (`--reverb/delay-open`) far from JSX | Med | Checklist item; verify card renders open-state class |
| Combined diff exceeds 400-line budget | Med | Forecast in `sdd-tasks`; chain PRs one overlay per slice |
| Strict TDD move-first discipline | Low | RED = move test first, watch fail vs not-yet-created component |

## Rollback Plan

Pure refactor confined to the `TrackPlayer` folder + its test file (plus `doc/TODO.md`).
Revert by dropping the new files and restoring the inline blocks — `git revert` of
the slice commit(s). No data, schema, or engine migration; no persisted state
touched, so revert is safe at any point. If chained, each overlay slice reverts
independently.

## Dependencies

- None. `AudioContext`/`AudioEngine` setters and `mockAudioEngine` stubs already exist.

## Success Criteria

- [ ] Fade, Delay, Reverb each have their own component + hook + `.css` + test suite.
- [ ] No dialog markup/draft state remains inline in `TrackPlayer.tsx` / `useTrackPlayer.ts`.
- [ ] `TrackPlayer.test.tsx` contains no duplicated Filter/Distortion/Fade/Delay/Reverb component tests.
- [ ] Fade has a cancel-draft test and `track-player--fade-open` class.
- [ ] `pnpm test:no-watch`, `pnpm typecheck`, `pnpm lint` green; behavior unchanged.
