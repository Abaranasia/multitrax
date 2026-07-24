# Delta for Track Overlays (Fade / Delay / Reverb)

This is a structural refactor with no product-behavior change. The requirements
below are invariants the extraction MUST preserve, plus the two explicitly
approved additions (Fade cancel parity, `track-player--fade-open` class).

## ADDED Requirements

### Requirement: Fade Draft Discard on Cancel
The Fade settings dialog MUST support discarding unapplied draft changes,
matching Delay/Reverb/Filter/Distortion behavior.

#### Scenario: Cancel discards fade drafts
- GIVEN the fade dialog is open with draft fade-in/out/seek-fade values changed
  from the track's live state
- WHEN the user triggers cancel (Cancel button or backdrop click)
- THEN `setFadeDurations` MUST NOT be called
- AND the dialog MUST close
- AND the track's live fade state MUST remain unchanged

### Requirement: Fade Open-State Card Class
The track card MUST expose a `track-player--fade-open` class while the fade
dialog is open, matching the existing pattern for filter/distortion/delay/reverb.

#### Scenario: Card reflects fade dialog open state
- GIVEN a track card is rendered
- WHEN the fade dialog's `isOpen` is true
- THEN the card's className MUST include `track-player--fade-open`

#### Scenario: Card omits fade class when closed
- GIVEN a track card is rendered
- WHEN the fade dialog's `isOpen` is false
- THEN the card's className MUST NOT include `track-player--fade-open`

## MODIFIED Requirements

### Requirement: Per-Dialog Draft Seed, Apply, and Cancel Flow
Each of the Fade, Delay, and Reverb settings dialogs MUST be implemented as an
independent component + paired state/logic hook (own file, own `.css`, own test
suite), following the same contract already used by Filter and Distortion:
opening the dialog MUST seed draft values from the current live track state;
applying MUST invoke the corresponding `AudioContext` setter with the track id
and the draft values, then close the dialog; canceling (button or backdrop
click) MUST discard drafts without invoking the setter, then close the dialog.
(Previously: Fade/Delay/Reverb dialog state, drafts, and markup lived inline in
`useTrackPlayer.ts` / `TrackPlayer.tsx` rather than as extracted components.)

#### Scenario: Opening a dialog seeds drafts from live state
- GIVEN a track with existing fade/delay/reverb settings
- WHEN the corresponding dialog is opened
- THEN each draft field MUST be initialized to the track's current live value
  for that field

#### Scenario: Apply commits drafts via the AudioContext setter
- GIVEN a dialog is open with modified draft values
- WHEN the user applies
- THEN the corresponding setter (`setFadeDurations` / `setDelaySettings` /
  `setReverbSettings`) MUST be called with the track id and the draft values
- AND the dialog MUST close

#### Scenario: Cancel or backdrop click discards drafts
- GIVEN a dialog is open with modified draft values
- WHEN the user cancels or clicks the backdrop
- THEN the corresponding setter MUST NOT be called
- AND the dialog MUST close
- AND the track's live state MUST remain unchanged

#### Scenario: Reverb button reflects active mix
- GIVEN a track's `reverbMix` value
- WHEN the track card renders the reverb toggle button
- THEN the button MUST carry an active-state class if and only if
  `reverbMix > 0`

### Requirement: No Behavior Change From Extraction
The refactor MUST NOT alter observable audio behavior, engine calls, or UI
outcomes for Fade, Delay, or Reverb beyond the two additions above.
(Previously: not previously stated as an explicit requirement; implicit in the
inline implementation.)

#### Scenario: Existing apply/cancel assertions still pass
- GIVEN the pre-refactor test assertions for fade-apply, delay-apply/cancel,
  and reverb-apply/cancel/active-button
- WHEN they are relocated to the new dedicated test suites (or an equivalent
  hook/component test)
- THEN they MUST pass unchanged in outcome (same setter calls, same close
  behavior, same active-button rule)

### Requirement: No Duplicate Component Tests in TrackPlayer.test.tsx
`TrackPlayer.test.tsx` MUST NOT retain component-level open/apply/cancel/active
tests for any of the five per-track dialogs (Filter, Distortion, Fade, Delay,
Reverb) once each has its own dedicated test suite.
(Previously: Filter and Distortion tests remained duplicated in
`TrackPlayer.test.tsx` after their extraction; this requirement did not exist.)

#### Scenario: Dedicated suite is the sole owner of dialog component tests
- GIVEN all five dialogs have dedicated test suites
- WHEN `TrackPlayer.test.tsx` is inspected
- THEN it MUST NOT contain duplicate open/apply/cancel/active-button assertions
  for any of the five dialogs
