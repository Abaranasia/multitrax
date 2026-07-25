# Tasks: Extract Track Overlays (Fade / Delay / Reverb)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300-1500 total; Fade ~350-400, Delay ~480-560 (incl. Filter dedup), Reverb ~500-580 (incl. Distortion dedup) |
| 400-line budget risk | High combined; Medium-High per individual overlay slice |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Fade → PR2 Delay (+Filter dedup) → PR3 Reverb (+Distortion dedup, final verification) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — ask user: stacked-to-main vs feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Shared touch-points each slice edits: `useTrackPlayer.ts` return object and `TrackPlayer.tsx` className string (~147). Keep diffs clean by touching only that overlay's key/class per PR and rebasing each slice on the previous one.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Extract Fade dialog + parity (cancel test, `--fade-open` class) | PR1 | `pnpm test:no-watch -- Fade` | N/A — no e2e harness; covered by component + integration tests | `git revert` PR1: drop Fade files, restore inline fade block |
| 2 | Extract Delay dialog; remove leftover Filter dup tests | PR2 (base=PR1 branch) | `pnpm test:no-watch -- Delay TrackPlayer` | N/A — same reason | `git revert` PR2: drop Delay files, restore inline delay block + Filter dup tests |
| 3 | Extract Reverb dialog; remove Distortion dup tests; final verification | PR3 (base=PR2 branch) | `pnpm test:no-watch` | N/A — same reason | `git revert` PR3: drop Reverb files, restore inline reverb block + Distortion dup tests |

## Phase 1: Fade Extraction

- [x] 1.1 Move fade apply test (`TrackPlayer.test.tsx` ~214-241) into new `FadeSettingsDialog.test.tsx`; add cancel-draft test. Run `pnpm test:no-watch` — expect RED (module missing).
- [x] 1.2 Create `useFadeSettingsDialog.ts`: `isOpen/open/close/apply`, `draftFadeIn/Out/SeekFade`; `apply()` → `setFadeDurations(state.id, ...)`.
- [x] 1.3 Create `FadeSettingsDialog.tsx` + `.css` (Filter template: overlay/panel/field/actions).
- [x] 1.4 Wire `TrackPlayer.tsx`: `fadeDialog = useFadeSettingsDialog(state)`; render dialog; add `track-player--fade-open` to card className (~147).
- [x] 1.5 Remove fade block from `useTrackPlayer.ts` (~54-69) + return keys; remove inline fade markup (~352-411) and old test block. Run `pnpm test:no-watch` — expect GREEN.

## Phase 2: Delay Extraction + Filter Dedup

- [x] 2.1 Move delay apply/cancel tests (~318-365) into `DelaySettingsDialog.test.tsx`. RED.
- [x] 2.2 Create `useDelaySettingsDialog.ts`: drafts Time/Feedback/Mix/Damping/Output; `apply()` → `setDelaySettings(...)`.
- [x] 2.3 Create `DelaySettingsDialog.tsx` + `.css`.
- [x] 2.4 Wire `TrackPlayer.tsx`: className `delayDialog.isOpen` (was `delaySettingsOpen`); render dialog.
- [x] 2.5 Remove delay block from `useTrackPlayer.ts` (~71-106) + keys; remove inline markup (~413-500), old test block, and leftover Filter dup tests (~243-316). GREEN.

## Phase 3: Reverb Extraction + Distortion Dedup

- [x] 3.1 Move reverb apply/cancel/active tests (~367-440) into `ReverbSettingsDialog.test.tsx`. RED.
- [x] 3.2 Create `useReverbSettingsDialog.ts`: drafts Room/Mix/PreDelay/Damping/Output; `apply()` → `setReverbSettings(...)`.
- [x] 3.3 Create `ReverbSettingsDialog.tsx` + `.css`.
- [x] 3.4 Wire `TrackPlayer.tsx`: className `reverbDialog.isOpen` (was `reverbSettingsOpen`); active-button class when `reverbMix > 0`.
- [x] 3.5 Remove reverb block from `useTrackPlayer.ts` (~108-149) + keys; remove inline markup (~502-593), old test block, and leftover Distortion dup tests (~442-514). GREEN.

## Phase 4: Final Verification

- [x] 4.1 Run `pnpm test:no-watch` — all suites green; no duplicate dialog tests remain in `TrackPlayer.test.tsx`.
- [x] 4.2 Run `pnpm typecheck`.
- [x] 4.3 Run `pnpm lint`.
- [x] 4.4 Check off `doc/TODO.md` lines 212-223.
