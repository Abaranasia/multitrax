# Tasks: Add Distortion Effect to TrackPlayer

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 Engine -> PR 2 State/Context -> PR 3 UI |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Note: chain strategy not yet selected — ask the user (stacked-to-main vs feature-branch-chain vs size:exception) before `sdd-apply`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Engine: `DistortionNodes`, factory, curve, addTrack/removeTrack wiring, `setDistortionSettings` | PR 1 | `pnpm test:no-watch -- AudioEngine` | N/A — engine unit test via `FakeAudioContext` is the harness | Revert `AudioEngine.ts`/`AudioEngine.test.ts` only |
| 2 | State/context: `TrackState` fields, `AudioContextValue`, provider defaults/duplicate | PR 2 | `pnpm test:no-watch -- AudioContext TrackState` | N/A — covered by PR 3 component tests | Revert `TrackState.ts`, `audioContextInstance.ts`, `AudioContext.tsx`; PR 1 intact |
| 3 | UI: `DistortionSettingsDialog`, `useDistortionSettingsDialog`, `TrackPlayer` wiring | PR 3 | `pnpm test:no-watch -- DistortionSettingsDialog TrackPlayer` | Manual: `pnpm dev`, open a track, click "W", drag sliders, Apply/Cancel | Revert new dialog/hook files + `TrackPlayer.tsx`/`.test.tsx`; PR 1/2 intact |

## Phase 1: Engine — Distortion Node Graph (PR 1)

- [x] 1.1 RED: add `FakeWaveShaper` + `createWaveShaper()` to `src/__tests__/audio/AudioEngine.test.ts`; failing test asserting `addTrack` wires `filter.outputGain -> distortion.dryGain/waveShaper -> distortion.outputGain -> delay.dryGain/delayNode`.
- [x] 1.2 RED: failing test — `setDistortionSettings(id, drive, tone, mix, output)` updates existing nodes without throwing/recreating.
- [x] 1.3 GREEN: add `DistortionNodes` interface + constants to `src/renderer/audio/AudioEngine.ts`.
- [x] 1.4 GREEN: implement `_createDistortionNodes()` and `_makeDistortionCurve(drive)` (soft-clip curve, tone->cutoff mapping).
- [x] 1.5 GREEN: rewire `addTrack` (~lines 156-169): insert distortion between filter and delay per design; leave the pre-existing gainNode double-connect untouched (out of scope).
- [x] 1.6 GREEN: add distortion node disconnects to `removeTrack`.
- [x] 1.7 GREEN: implement `setDistortionSettings` (setTargetAtTime + curve rebuild on drive change).
- [x] 1.8 REFACTOR: `pnpm test:no-watch -- AudioEngine` green; tidy naming/constants.

**Post-verify fix (still task 1.4, same PR 1 scope)**: sdd-verify caught that `_makeDistortionCurve`'s
`20*deg` coefficient reduced to `curve(x)=x/3` at drive=0 (not near-identity, per spec). Corrected to
`60*deg` (normalizes k=0 to `curve(x)=x`); RED test added first, then fixed. See `verify-report.md`
"Post-fix note" and `design.md`'s curve helper section for details. `pnpm test:no-watch` → 76/76 green.

## Phase 2: State & Context Wiring (PR 2)

- [x] 2.1 Add `distortionDrive/Tone/Mix/Output` fields (default `0/100/0/100`) to `src/renderer/domain/TrackState.ts`.
- [x] 2.2 Add `setDistortionSettings` to `AudioContextValue` in `src/renderer/context/audioContextInstance.ts`.
- [x] 2.3 Add provider callback, new-track defaults, and duplicate passthrough (`engine.setDistortionSettings`) in `src/renderer/context/AudioContext.tsx`.
- [x] 2.4 Verify/extend existing context tests for defaults + duplicate-copies-distortion behavior.

## Phase 3: UI — Dialog & TrackPlayer (PR 3)

- [ ] 3.1 RED: create `src/__tests__/components/TrackPlayer/DistortionSettingsDialog.test.tsx` (mirror Filter test) — 4 ranges render drafts, setters fire on change, Apply/Cancel/backdrop close.
- [ ] 3.2 GREEN: create `DistortionSettingsDialog.tsx` + `.css` in `src/renderer/components/TrackPlayer/` (drive/tone/mix/output ranges, mirror Filter dialog).
- [ ] 3.3 GREEN: create `useDistortionSettingsDialog.ts` (open/close/apply + 4 drafts, mirror `useFilterSettingsDialog`); no standalone hook test per doc/TESTING.md.
- [ ] 3.4 RED: extend `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` — "W" button renders, opens dialog, `--active` class when `distortionMix > 0`.
- [ ] 3.5 GREEN: wire "W" button + dialog render block + `track-player--distortion-open` class into `TrackPlayer.tsx`.
- [ ] 3.6 REFACTOR: run full `pnpm test:no-watch`; confirm Filter/Delay/Reverb tests unaffected.
