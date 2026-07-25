# Delta: AudioEngine Internal Naming and Magic-Number Parity

## Purpose

The proposal declares Capabilities as "New: None, Modified: None" — a pure
internal refactor with zero behavior change. `AudioEngine.ts`'s four
per-track node interfaces still use `outputLevel` internally while every
other layer (`TrackState`, `audioContextInstance.ts`, `AudioContext.tsx`,
dialog hooks) already uses `output`. This delta ADDS regression-prevention
requirements so the rename and the magic-number extraction are independently
checkable; it introduces no new user-facing capability and modifies no
existing requirement text in `openspec/specs/`.

## ADDED Requirements

### Requirement: Internal Per-Track Node Interfaces Use a Single `output` Name

`AudioEngine.ts`'s four internal per-track node interfaces (`FilterNodes`,
`DistortionNodes`, `DelayNodes`, `ReverbNodes`) MUST name the post-effect
gain field `output`, matching the name already used at every other layer.
The internal name `outputLevel` MUST NOT remain anywhere in
`AudioEngine.ts` after the change.

#### Scenario: Setter assigns through the canonical field name

- GIVEN a track's effect settings are updated via `setFilterSettings`,
  `setDistortionSettings`, `setDelaySettings`, or `setReverbSettings`
- WHEN the setter writes the post-effect gain value
- THEN it reads/writes the node's `output` field, not `outputLevel`

#### Scenario: White-box tests assert on the canonical field name

- GIVEN `AudioEngine.test.ts` inspects a track's internal node bundle
- WHEN an assertion checks the post-effect gain node
- THEN it references `.output`, not `.outputLevel`

### Requirement: Renaming the Internal Field Introduces No Audio Behavior Change

Renaming `outputLevel` to `output` MUST NOT change which `AudioParam` is
targeted, which value is applied, or the gain-ramp timing used to reach it.

#### Scenario: Gain ramps to the same target after the rename

- GIVEN a track's output level is set to a given value before and after the
  rename
- WHEN the corresponding setter is called with the same input
- THEN the node's gain `AudioParam` ramps to the identical target value
  using the identical ramp mechanism as before the rename

### Requirement: Repeated Magic Numbers Are Named Constants

`AudioEngine.ts` MUST express the following repeated literals as named
constants declared in the existing const block, using the same numeric
value at every call site: the `setTargetAtTime` ramp time-constant used
across all gain/parameter ramps, the reverb `preDelay` upper clamp bound,
and the fade-duration upper clamp bound.

#### Scenario: Ramp calls use the shared time-constant

- GIVEN any `setTargetAtTime` call in `AudioEngine.ts`
- WHEN the ramp is scheduled
- THEN it uses the named ramp time-constant, not an inline `0.01` literal
- AND its resolved numeric value is unchanged from before the extraction

#### Scenario: Reverb preDelay clamps to the named bound

- GIVEN a reverb `preDelay` value above the documented maximum is set
- WHEN the value is clamped
- THEN it clamps to the named `REVERB_PREDELAY_MAX_MS`-equivalent bound
- AND the resolved numeric value is unchanged from before the extraction

#### Scenario: Fade duration clamps to the named bound

- GIVEN a fade duration above the documented maximum is set
- WHEN the value is clamped
- THEN it clamps to the named fade-duration bound
- AND the resolved numeric value is unchanged from before the extraction

## Verified No-Change (existing specs)

- `openspec/specs/track-distortion/spec.md` — all requirements remain valid
  as written; no MODIFIED block needed. It names the public field
  `distortionOutput` (`TrackState`/dialog layer), which this change does not
  touch — only `AudioEngine.ts`'s internal `outputLevel` field is renamed.
- `openspec/specs/effect-refactor-parity/spec.md` — unaffected; this change
  does not alter setter signatures, dialog hook contracts, or the shared
  `clamp()` helper it pins.
