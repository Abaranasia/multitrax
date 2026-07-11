# Multitrax — Quick Overview

A quick-reference summary of the app. For full detail see [ARCHITECTURE.md](ARCHITECTURE.md);
for planned features see [TODO-effects.md](TODO-effects.md); for change history see [DEVLOG.md](DEVLOG.md).

Multitrax is an Electron + React + TypeScript desktop app — a lightweight multi-track
audio mixer/recorder built on the Web Audio API.

## Architecture

3-layer Electron architecture:
- **Main process** — file/OS access, native dialogs.
- **Preload bridge** — exposes only open files, read file, save recording to the UI.
- **Renderer** — React UI + Web Audio engine, running as a web page inside Electron.

## Audio graph

Per-track `AudioBufferSourceNode` → `GainNode` → master `GainNode` → speakers + recorder tap.

## Playback features

- Play/pause/stop, seek, per-track volume.
- Loop — manual per-cycle fade in/out (native looping can't hook gain automation).
- Fade-in / fade-out, seek cross-fade.
- All fade durations are per-track and configurable (0–10s) via a settings panel.

## State management

Dual representation: React holds UI-facing state, `AudioEngine` holds live Web Audio
nodes; the two are bridged manually on every user action.

## Recording

`MediaRecorder` captures the master gain output (WebM/Opus), then on stop it's decoded
and re-encoded to a lossless 16-bit WAV file.

## File loading

Drag-and-drop or file picker. Supports MP3, WAV, OGG, FLAC, AAC, M4A, Opus, WebM.
Files are fully decoded into memory (no streaming).

## Conventions

- Strict TypeScript, immutable entities.
- CSS co-located with components, BEM naming, no inline styles.
- Tests target components (not hooks), except reusable cross-feature hooks.

## Roadmap

`doc/TODO-effects.md` lists unimplemented audio effects (EQ, compressor, pan, reverb,
delay, distortion, pitch/time-stretch, tremolo, etc.) planned to slot into the chain
between each track's `GainNode` and the master gain.
