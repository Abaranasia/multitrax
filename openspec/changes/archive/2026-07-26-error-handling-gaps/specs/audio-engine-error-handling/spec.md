# Audio Engine Error Handling Specification

## Purpose

Regression-prevention requirement for the audio engine's error handling. No
new user-facing capability. `_stopSource` (`AudioEngine.ts:914`) swallows
every `sourceNode.stop()` error as `console.warn`. This spec ensures that
expected errors (e.g., double-stop) are handled silently while unexpected
errors surface distinctly for debugging.

## Requirements

### Requirement: `_stopSource` Distinguishes Expected From Unexpected Stop Errors

`_stopSource` MUST catch only the expected `InvalidStateError` case (source
already stopped) silently. Any other error thrown by `sourceNode.stop()`
MUST be surfaced distinctly (rethrown or logged as an error, not folded
into the same generic `console.warn` swallow).

#### Scenario: Stopping an already-stopped source is silent

- GIVEN a track's source node has already stopped
- WHEN `_stopSource` calls `sourceNode.stop()` again
- THEN the resulting `InvalidStateError` is caught and swallowed
- AND no error is surfaced to the caller

#### Scenario: An unexpected stop error is not silently swallowed

- GIVEN `sourceNode.stop()` throws an error other than the expected
  already-stopped `InvalidStateError`
- WHEN `_stopSource` runs
- THEN the error is surfaced distinctly (rethrown or logged as an error)
  rather than swallowed as a generic warning
