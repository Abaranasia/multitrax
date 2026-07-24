# Proposal: Add Distortion Effect to TrackPlayer

## Intent

TrackPlayer's per-track effects row (Filter/Delay/Reverb) is explicitly built to grow, and `doc/TODO.md` already scopes Distortion/Saturation as a `WaveShaperNode` insert. Users currently have no way to add drive/overdrive/soft-clip character per track. This change adds Distortion as the 4th insert effect, following the established Filter pattern end to end.

## Scope

### In Scope
- New Distortion insert in the per-track audio graph (`WaveShaperNode`-based, dry/wet + output trim), mirroring the Filter insert shape.
- New `DistortionSettingsDialog` component + CSS + `useDistortionSettingsDialog` hook + component test, mirroring Filter.
- Distortion toggle button in the `.track-effects` row with active-state styling.
- `TrackState` distortion fields, `AudioContext` setter/defaults/duplicate passthrough, `AudioEngine.setDistortionSettings` + node factory + curve helper.
- New/updated test fakes (`FakeWaveShaper`/`createWaveShaper` on `FakeAudioContext`).

### Out of Scope
- **Pre-existing Filter→Delay gain-staging wiring bug** in `AudioEngine.addTrack` (Delay double-sums raw + filtered signal). User decided to track it as a separate future bug-fix. Do NOT fix or copy it here; the new insert must not replicate the double-connection.
- Shared effects-rack / patchbay re-architecture (TODO already rejects this for now).
- Bit-crush / advanced waveshaping modes beyond the agreed first parameter set.

## Capabilities

### New Capabilities
- `track-distortion`: per-track distortion/saturation insert effect (params, audio-graph placement, UI dialog + toggle, persistence/duplication behavior).

### Modified Capabilities
- None (no existing spec files under `openspec/specs/`).

## Approach

Copy the Filter insert vertical slice (the doc-endorsed "target shape"): persistent Web Audio nodes created once in `addTrack`, params pushed via `setTargetAtTime`, dual write (engine call + React `TrackEntry` mirror), independent dialog component/hook, single-letter toggle button. Add a WaveShaper curve-generation helper analogous to reverb's impulse-response builder. Two decisions require product input before design (see below): chain position and curve/parameter set.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `AudioEngine.ts` | Modified | `DistortionNodes`, `_createDistortionNodes`, curve helper, wiring in add/removeTrack, `setDistortionSettings` |
| `AudioContext.tsx` / `audioContextInstance.ts` | Modified | setter callback, defaults, duplicate passthrough, interface method |
| `TrackState.ts` | Modified | distortion param fields |
| `TrackPlayer.tsx` | Modified | toggle button + dialog render block + open-class variant |
| `DistortionSettingsDialog.{tsx,css}`, `useDistortionSettingsDialog.ts` | New | UI slice |
| test files | New/Modified | dialog test, engine test, WaveShaper fake |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong chain position (undoing later work) | Med | Resolve in proposal question round + design before apply |
| Waveshaping curve is real DSP, not just mapping | Med | Agree parameter set up front; keep first slice to soft-clip/overdrive |
| Missing WaveShaper test fake blocks TDD | Low | Add `FakeWaveShaper` as first apply task |
| Accidentally copying Filter→Delay wiring bug | Low | Explicitly out of scope; new insert wired clean |

## Rollback Plan

Single feature branch. Revert the commit(s); all changes are additive (new files + new fields/methods) with no migration, so removal restores prior behavior. Existing tracks tolerate absent distortion fields as defaults.

## Dependencies

- None external. Builds on existing Web Audio insert pattern.

## Success Criteria

- [ ] Distortion button appears in `.track-effects`, opens its dialog, shows active state when mix > 0.
- [ ] `setDistortionSettings` updates the insert without recreating nodes or throwing.
- [ ] Distortion persists across track duplication and matches Filter's UX conventions.
- [ ] `pnpm test:no-watch`, `pnpm lint`, `pnpm typecheck` pass.

## Proposal Question Round

Interactive asking is unavailable in this executor context; these product decisions need user input before `sdd-design`:

1. **Chain position** — where does Distortion sit? Audio-engineering convention favors distortion *before* Filter/Delay/Reverb (right after `gainNode`); `doc/TODO.md` lists it after them. Which ordering do we commit to?
2. **Parameter set / curve** — confirm the first-slice knobs. Proposed default (matching Filter/Delay/Reverb precedent of mix+output+effect-specific): `drive` (amount), optional `tone`, `mix`, `output`, with a soft-clip/overdrive curve. Is bit-crush deferred?
3. **Button label** — Filter/Delay/Reverb use single letters F/D/R. What letter for Distortion? (`D` collides with Delay and `O` collides with the fade-out toggle already on the track card; candidates: `W` for WaveShaper, `X`, or a short "Dist" label.)

Assumptions if unanswered: distortion placed after `gainNode` and before Filter; params `drive/tone/mix/output` with soft-clip curve, bit-crush deferred; button label `W` (WaveShaper) to avoid the `D` collision with Delay and the `O` collision with the fade-out toggle.
