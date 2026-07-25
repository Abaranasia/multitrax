# Delta: Effect Dialog/Engine Refactor — Behavior Parity Pin

## Purpose

The proposal declares Capabilities as "New: None, Modified: None" — pure internal
refactor. Verification confirms no new user-facing capability. Two of the six
slices (generic hook, setter-signature consolidation) do touch mechanisms that
were previously implicit or documented only for one effect
(`openspec/specs/track-distortion/spec.md`), not stated project-wide across
all five dialogs and the AudioEngine. This delta ADDS cross-cutting
regression-prevention requirements so the refactor's parity claim is
independently checkable — it introduces no new capability and modifies no
existing requirement text.

## ADDED Requirements

### Requirement: Effect Setter Consolidation Preserves Per-Track Values and Clamping

Consolidating the four effect-setter signatures (`setFilterSettings`,
`setDistortionSettings`, `setDelaySettings`, `setReverbSettings`) into one
shared shape MUST NOT change which value is applied to which parameter, nor
which min/max bounds each parameter is clamped to.

#### Scenario: Duplicating a track preserves every effect's settings

- GIVEN a track has non-default filter, distortion, delay, and reverb settings
- WHEN the track is duplicated
- THEN the new track's engine entry receives the exact same per-effect values
  as the source track
- AND out-of-range values clamp to the same bounds as before the refactor

#### Scenario: Positional values are not silently swapped

- GIVEN the consolidated setter is called with the same logical arguments as
  before (e.g. mix, outputLevel)
- WHEN the call reaches the AudioEngine
- THEN each value lands on the same audio parameter it did under the prior
  per-effect signature

### Requirement: Effect Dialog Hook Contract Stays Identical Across All Five Dialogs

Replacing the five per-effect dialog hooks with a generic
`useSettingsDialog<TDraft>` MUST preserve the external contract every hook
currently exposes: `isOpen`, `open()`, `close()`, `apply()`, and per-field
draft values with their setters.

#### Scenario: Open seeds drafts from current track state

- GIVEN a dialog is closed with drafts differing from committed track state
- WHEN `open()` is called
- THEN each draft value resets to the corresponding current `TrackState`
  value before the dialog becomes visible

#### Scenario: Apply commits drafts and closes

- GIVEN a dialog is open with edited draft values
- WHEN `apply()` is called
- THEN the corresponding engine setter is invoked with the current draft
  values
- AND `isOpen` becomes false

#### Scenario: Cancel/backdrop discards drafts without committing

- GIVEN a dialog is open with edited draft values
- WHEN the dialog is closed without calling `apply()`
- THEN no engine setter is invoked
- AND the previously committed track state is unchanged

### Requirement: Extracted clamp() Helper Preserves Existing Per-Parameter Bounds

Extracting the repeated `Math.max(min, Math.min(max, value))` pattern (24
call sites) into a shared `clamp()` helper MUST use the same min/max bounds
at every call site.

#### Scenario: Each parameter clamps to its pre-refactor range

- GIVEN a parameter with a documented range (e.g. mix 0–100, delay time
  1–2000ms, feedback 0–90)
- WHEN a value outside that range is set via its dialog
- THEN the engine clamps it to the same bounds as before the `clamp()`
  extraction

## Verified No-Change (existing specs)

- `openspec/specs/track-distortion/spec.md` — all requirements remain valid
  as written; no MODIFIED block needed. Its "no standalone hook-isolation
  test" and "duplicate copies settings via `setDistortionSettings`"
  requirements hold regardless of the generic hook's or consolidated
  setter's internal shape, since the setter name and duplication behavior
  are unchanged.
