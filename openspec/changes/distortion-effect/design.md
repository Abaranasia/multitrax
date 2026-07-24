# Design: Add Distortion Effect to TrackPlayer

## Technical Approach

Clone the Filter vertical slice (the doc-endorsed target shape) for a `WaveShaperNode`-based
Distortion insert. Persistent nodes built once in `addTrack` via a private `_createDistortionNodes()`
factory; params pushed through `setDistortionSettings` with `setTargetAtTime`; dual write
(engine call + React `TrackEntry` mirror); independent dialog component + hook + component test.
Chain (product decision): `gainNode → filter → distortion → delay → reverb → pannerNode → masterGain`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Insert shape | dry/wet split around `WaveShaperNode`, mirroring `FilterNodes` | shared effects rack | Matches doc-required pattern; per-track independence |
| Tone control | post-shaper lowpass `BiquadFilterNode` (tone% → cutoff) | pre-emphasis EQ / bit-crush | Reuses existing damping-style mapping; tames harsh harmonics cheaply |
| Curve regen | rebuild `waveShaper.curve` on drive change (not an AudioParam) | animate curve | Same instant-swap idiom as reverb `convolver.buffer` / filter `type` |
| UI hook | dedicated `useDistortionSettingsDialog` (like Filter) | drafts in `useTrackPlayer` (Delay/Reverb style) | Task mandates mirroring Filter exactly |
| Button label | `W` (WaveShaper) in `.track-effects` | `O`/`D`/`X` | F/D/R taken; `W` avoids glyph overlap with fade-out toggle (`O`); user decision |

## Data Flow

    gainNode ─┬─→ filter.dryGain ────────┐
              └─→ filter.biquadFilter ─→ filter.wetGain
                                          └─→ filter.outputGain ─┬─→ distortion.dryGain ─────────────┐
                                                                 └─→ distortion.waveShaper→toneFilter→wetGain
                                                                        distortion.outputGain ←──────┘
    distortion.outputGain ─┬─→ delay.dryGain / delay.delayNode ─→ ... → reverb → pannerNode → masterGain

UI: `TrackPlayer` → `useDistortionSettingsDialog` → context `setDistortionSettings` → `AudioEngine.setDistortionSettings` + `TrackEntry` mirror.

## Exact addTrack rewiring (AudioEngine.ts ~156-169)

- ADD `const distortion = this._createDistortionNodes();`
- KEEP untouched: `gainNode.connect(delay.dryGain/delayNode)` (lines 157-158) and `gainNode.connect(filter.dryGain/biquadFilter)` (161-162). The pre-existing Filter/Delay double-sum stays exactly as-is — NOT fixed, NOT worsened.
- CHANGE lines 164-165 from `filter.outputGain.connect(delay.dryGain/delayNode)` → `filter.outputGain.connect(distortion.dryGain)` and `filter.outputGain.connect(distortion.waveShaper)`.
- ADD `distortion.outputGain.connect(delay.dryGain)` and `distortion.outputGain.connect(delay.delayNode)`.
- Add `distortion` to the `tracks.set(id, {...})` bundle.
- `removeTrack`: add `distortion.dryGain/waveShaper/toneFilter/wetGain/outputGain.disconnect()`.

## Interfaces / Contracts

```typescript
interface DistortionNodes {
  dryGain: GainNode; waveShaper: WaveShaperNode; toneFilter: BiquadFilterNode;
  wetGain: GainNode; outputGain: GainNode;
  drive: number; tone: number; mix: number; outputLevel: number; // all 0–100
}
// factory internal wiring: waveShaper→toneFilter→wetGain; dryGain→outputGain; wetGain→outputGain
// defaults: drive 0, tone 100, mix 0, output 100; dry=1, wet=0; oversample='4x'; curve = makeCurve(0)
setDistortionSettings(id, drive, tone, mix, outputLevel): void
```

Curve helper (classic soft-clip overdrive; `k` from drive%):

```typescript
private _makeDistortionCurve(drive: number): Float32Array {
  const k = (drive / 100) * DISTORTION_MAX_K;   // ~0..100
  const n = 44100, curve = new Float32Array(n), deg = Math.PI / 180;
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 60 * deg) / (Math.PI + k * Math.abs(x)); }
  return curve;
}
```

**Corrected during apply (sdd-verify catch)**: the commonly-copied MDN/StackOverflow
version of this formula uses a `20*deg` numerator coefficient. Taken verbatim, that
reduces to `curve(x) = x/3` at `k=0` — a fixed ~-9.5dB cut, not a near-identity
pass-through — which contradicts the spec's "Drive at 0 is near-transparent"
scenario. The coefficient is normalized to `60*deg` so `3 * 60*deg / pi === 1`,
making `k=0` exactly `curve(x) = x` (identity), while uniformly scaling — and so
fully preserving the shape of — the saturation curve at every other drive level.
Chain position and all other decisions are unchanged.

Tone: `cutoff = DAMPING_MIN_HZ + (tone/100)*(DAMPING_MAX_HZ - DAMPING_MIN_HZ)` (higher tone = brighter). Drive rebuilds curve instantly; mix sets dry/wet; output sets `outputGain`.

`TrackState`: `distortionDrive, distortionTone, distortionMix, distortionOutput` (all `number`, 0–100). Defaults in `AudioContext.addTracks`: `0/100/0/100`. Duplicate passthrough adds `engine.setDistortionSettings(newId, ...)`. `AudioContextValue` + provider callback mirror `setFilterSettings`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/renderer/audio/AudioEngine.ts` | Modify | `DistortionNodes`, `_createDistortionNodes`, `_makeDistortionCurve`, constants, addTrack/removeTrack wiring, `setDistortionSettings` |
| `src/renderer/domain/TrackState.ts` | Modify | 4 distortion fields |
| `src/renderer/context/audioContextInstance.ts` | Modify | `setDistortionSettings` on `AudioContextValue` |
| `src/renderer/context/AudioContext.tsx` | Modify | callback + defaults + duplicate passthrough + provider value |
| `src/renderer/components/TrackPlayer/DistortionSettingsDialog.tsx` + `.css` | Create | 4 sliders (Drive/Tone/Output/Mix), mirrors Filter dialog |
| `src/renderer/components/TrackPlayer/useDistortionSettingsDialog.ts` | Create | open/close/apply + 4 drafts |
| `src/renderer/components/TrackPlayer/TrackPlayer.tsx` | Modify | `W` button in `.track-effects`, dialog render block, `track-player--distortion-open` class |
| `src/__tests__/audio/AudioEngine.test.ts` | Modify | `FakeWaveShaper` + `createWaveShaper` on `FakeAudioContext`; engine RED test |
| `src/__tests__/components/TrackPlayer/DistortionSettingsDialog.test.tsx` | Create | dialog render/setters/apply/cancel/backdrop |
| `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` | Modify | button renders/opens dialog/active when `distortionMix>0` |

## Testing Strategy (strict TDD — RED first)

| Layer | What | Approach |
|---|---|---|
| Unit (engine) | `setDistortionSettings` updates chain without throwing; `addTrack` builds distortion bundle | Vitest + `FakeAudioContext`; add `FakeWaveShaper`(curve/oversample/connect/disconnect) + `createWaveShaper()` |
| Component (dialog) | 4 ranges render draft values; setters fire on change; Apply/Cancel + backdrop | render `.tsx`, `fireEvent`, query `.distortion-settings-*` (mirror Filter test) |
| Component (TrackPlayer) | `W` button present, opens dialog, `--active` when `distortionMix>0` | render + click; hook NOT tested in isolation (TESTING.md) |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Additive fields/methods; existing tracks default distortion to fully-dry (mix 0). Revert = remove commit.

## Open Questions

- [x] Resolved — button label is `W` (WaveShaper). The user chose `W` over `O` specifically to avoid any glyph overlap with the existing fade-out toggle (`O`). No remaining UX overlap.
