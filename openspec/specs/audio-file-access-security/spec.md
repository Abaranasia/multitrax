# Audio File Access Security Specification

## Purpose

`fs:readAudioFile` (`main.ts`) reads any path the renderer sends, with no
validation — an arbitrary-file-read primitive reachable from a compromised
renderer. NEW capability: restrict `fs:readAudioFile` to paths granted via
the native open-file dialog; file I/O handlers MUST NOT crash on
filesystem errors.

## Requirements

### Requirement: Session-Scoped Path Allowlist Gates File Reads

The system MUST maintain a path allowlist populated exclusively with the
resolved file paths returned by a `dialog:openAudioFiles` invocation. Each
new `dialog:openAudioFiles` invocation MUST reset the allowlist to only the
paths resolved by that call (not accumulated or persisted across calls or
app lifetime). `fs:readAudioFile` MUST reject any path not currently present
in the allowlist.

#### Scenario: A dialog-selected path is readable

- GIVEN a user opens the file dialog and selects one or more audio files
- WHEN the renderer requests `fs:readAudioFile` for one of the resolved
  dialog paths
- THEN the main process reads and returns that file's contents

#### Scenario: An ungranted path is rejected

- GIVEN a path was never returned by a `dialog:openAudioFiles` call
- WHEN the renderer requests `fs:readAudioFile` for that path
- THEN the handler rejects the request without reading the file

#### Scenario: A new dialog invocation resets prior grants

- GIVEN paths were granted by a previous `dialog:openAudioFiles` call
- WHEN `dialog:openAudioFiles` is invoked again with a different selection
- THEN only the newly resolved paths are readable
- AND paths granted by the prior invocation are rejected unless re-selected

### Requirement: File I/O Handlers Do Not Crash on Filesystem Errors

The `fs.writeFileSync` call in `dialog:saveRecording` and the
`fs.readFileSync` call in `fs:readAudioFile` MUST be wrapped so a filesystem
error (permission denied, missing file, etc.) is caught and reported to the
renderer rather than crashing the main process or leaving the IPC call
unresolved.

#### Scenario: A read failure is reported, not fatal

- GIVEN `fs:readAudioFile` is called for an allowlisted path whose
  underlying read throws
- WHEN the error occurs
- THEN the main process catches it and returns a handled rejection
- AND the main process does not crash

#### Scenario: A write failure is reported, not fatal

- GIVEN `dialog:saveRecording` targets a path whose `writeFileSync` throws
- WHEN the error occurs
- THEN the main process catches it and returns a handled failure result
- AND the main process does not crash
