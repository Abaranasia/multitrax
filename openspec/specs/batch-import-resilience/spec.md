# Batch Import Resilience Specification

## Purpose

`addTracks` (`AudioContext.tsx`) decodes a batch of files in a loop. One
corrupt file today throws, aborting the loop and discarding all
already-decoded files. NEW capability: batch import MUST isolate per-file
decode failures, keeping successful files, reporting failures via console
only.

## Requirements

### Requirement: Per-File Decode Isolation

The system MUST catch decode/read errors independently for each file
processed by `addTracks`, so that one failing file does not prevent other
files in the same batch from being decoded and added as tracks.

#### Scenario: One corrupt file does not block the rest

- GIVEN a batch of files is submitted to `addTracks` where exactly one file
  has invalid/corrupt audio data
- WHEN `addTracks` processes the batch
- THEN every other file is successfully decoded and added as a track
- AND the corrupt file is skipped without aborting the remaining files

#### Scenario: Failure is logged, not silently dropped

- GIVEN a file in the batch fails to decode
- WHEN the failure is caught
- THEN it is reported via `console.error` identifying the failing file

### Requirement: `addTracks` Signature and Resolution Are Unchanged

`addTracks` MUST keep its existing `Promise<void>` signature. Per-file
failures MUST surface only via `console.error`; the function MUST NOT
reject, and MUST NOT return a changed shape (e.g. no `{succeeded, failed}`
result), even when one or more files in the batch fail.

#### Scenario: Batch with a failure still resolves

- GIVEN a batch import where one file fails to decode and others succeed
- WHEN `addTracks` finishes processing all files
- THEN the returned `Promise<void>` resolves (does not reject)
- AND callers observe no change to the function's return type
