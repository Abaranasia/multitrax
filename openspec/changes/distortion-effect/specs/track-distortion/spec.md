# Track Distortion Specification

## Purpose

Defines the per-track Distortion/Saturation insert effect: a `WaveShaperNode`-based
effect in the per-track audio graph, its toggle/dialog UI in `.track-effects`, and
its persistence across track state and duplication. Mirrors the existing Filter
insert's UX and lifecycle.

## Requirements

### Requirement: Distortion Toggle Button

The system MUST render a distortion toggle button labeled "W" inside each track's
`.track-effects` row.

#### Scenario: Button opens the settings dialog

- GIVEN a track is rendered in TrackPlayer
- WHEN the user clicks the "W" button
- THEN the DistortionSettingsDialog opens for that track

#### Scenario: Button shows active state

- GIVEN a track's `distortionMix` is greater than 0
- WHEN the track renders
- THEN the "W" button displays an active-state style
- AND WHEN `distortionMix` is 0, the button MUST NOT display the active style

### Requirement: Distortion Settings Dialog

The dialog MUST expose four numeric controls — drive, tone, mix, output — each
ranged 0–100, and MUST support Apply and Cancel actions.

#### Scenario: Dialog opens with current track values as drafts

- GIVEN a track has `distortionDrive=40, distortionTone=60, distortionMix=50, distortionOutput=80`
- WHEN the dialog opens
- THEN each control displays the corresponding draft value

#### Scenario: Apply commits draft values

- GIVEN the user changed one or more draft values in the open dialog
- WHEN the user clicks Apply
- THEN the track's distortion settings are updated via `setDistortionSettings`
- AND the dialog closes

#### Scenario: Cancel or backdrop click discards drafts

- GIVEN the user changed draft values without applying
- WHEN the user clicks Cancel or the dialog backdrop
- THEN the dialog closes
- AND the track's committed distortion settings remain unchanged

### Requirement: Distortion State Persistence

`TrackState` MUST persist `distortionDrive`, `distortionTone`, `distortionMix`,
`distortionOutput` (all numbers, range 0–100), defaulting to `0, 100, 0, 100`
respectively for newly added tracks.

#### Scenario: New track receives default distortion state

- GIVEN a new track is added
- WHEN its initial state is created
- THEN `distortionDrive=0, distortionTone=100, distortionMix=0, distortionOutput=100`

#### Scenario: Duplicating a track copies distortion settings

- GIVEN an existing track has non-default distortion settings
- WHEN the user duplicates that track
- THEN the new track's `TrackState` carries the same distortion values
- AND the new track's audio engine entry receives those same values via
  `setDistortionSettings`

#### Scenario: Multiple tracks hold independent distortion state

- GIVEN two tracks exist with different distortion settings
- WHEN one track's settings are changed via Apply
- THEN the other track's distortion settings and audio output remain unchanged

### Requirement: Distortion Audio Graph Placement

The system MUST insert the distortion `WaveShaperNode` chain between the Filter
insert and the Delay insert in the per-track graph: `gainNode → filter →
distortion → delay → reverb → pannerNode → masterGain`.

#### Scenario: Filter output feeds distortion, distortion output feeds delay

- GIVEN a track is added to the audio engine
- WHEN the graph is constructed
- THEN `filter.outputGain` connects to both `distortion.dryGain` and
  `distortion.waveShaper`
- AND `distortion.outputGain` connects to both `delay.dryGain` and
  `delay.delayNode`

### Requirement: Distortion Dry/Wet Mix Behavior

`setDistortionSettings` MUST update drive, tone, mix, and output on the existing
persistent nodes without recreating or reconnecting them.

#### Scenario: Mix at 0 yields dry-only signal

- GIVEN `distortionMix=0`
- WHEN audio passes through the distortion insert
- THEN the dry path is fully audible and the wet (shaped) path contributes
  effectively nothing to the output

#### Scenario: Mix at 100 yields fully wet signal

- GIVEN `distortionMix=100`
- WHEN audio passes through the distortion insert
- THEN the shaped (wet) path is fully audible and the dry path contributes
  effectively nothing to the output

#### Scenario: Drive at 0 is near-transparent

- GIVEN `distortionDrive=0`
- WHEN the waveshaper curve is (re)generated
- THEN the shaped signal is a near-identity pass-through of the input, so the
  effect introduces no audible saturation even if `distortionMix > 0`

#### Scenario: Settings update without throwing or rebuilding nodes

- GIVEN a track already exists in the audio engine
- WHEN `setDistortionSettings` is called with new drive/tone/mix/output values
- THEN the call completes without throwing
- AND the same `DistortionNodes` instances are reused (no new nodes created)

### Requirement: Distortion Cleanup on Track Removal

The system MUST disconnect all distortion nodes when a track is removed.

#### Scenario: Removing a track disconnects its distortion nodes

- GIVEN a track with an active distortion insert exists in the audio engine
- WHEN the track is removed
- THEN `dryGain`, `waveShaper`, `toneFilter`, `wetGain`, and `outputGain` are
  each disconnected
- AND no reference to the removed track's distortion nodes remains reachable

### Requirement: Distortion Test Coverage

Per this project's Strict TDD and component-testing conventions, distortion
behavior MUST be covered at the engine-unit and component levels, and MUST NOT
add a dedicated hook-isolation test for `useDistortionSettingsDialog`.

#### Scenario: Engine unit test verifies wiring and settings updates

- GIVEN a `FakeAudioContext` with `FakeWaveShaper` support
- WHEN a track is added and `setDistortionSettings` is called
- THEN the test asserts the distortion bundle is created and updated without
  throwing

#### Scenario: Component tests cover all user-triggerable actions

- GIVEN the DistortionSettingsDialog and TrackPlayer components
- WHEN a user can click, drag a range, Apply, Cancel, or click the backdrop
- THEN each such action has a corresponding component-level test
- AND no standalone test file exists for `useDistortionSettingsDialog`
