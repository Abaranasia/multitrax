# How Multitrack Works — Architecture for Humans

## What is Multitrack?

Multitrack is a desktop application that lets you load several audio files at once,
control each one independently, and record the combined result as a WAV file.
Think of it as a very lightweight version of a digital audio workstation (DAW),
focused on mixing and monitoring rather than editing.

---

## The big picture: three layers

Because it is a desktop app built with Electron, the application is actually three
separate programs talking to each other:

```
┌────────────────────────────────────┐
│  1. Main Process                   │
│     Handles files, dialogs, OS     │
└──────────────┬─────────────────────┘
               │  passes data up/down
┌──────────────▼─────────────────────┐
│  2. Preload Bridge                 │
│     A controlled door between      │
│     the OS layer and the UI        │
└──────────────┬─────────────────────┘
               │
┌──────────────▼─────────────────────┐
│  3. Renderer (the UI you see)      │
│     React interface + audio engine │
└────────────────────────────────────┘
```

### 1 — Main Process
This is a Node.js program. It can access the file system, show native OS dialogs
("Open file…", "Save as…"), and talk to the OS. It cannot draw anything on screen.

### 2 — The Bridge (Preload)
Electron enforces a strict security boundary: the UI cannot access the file system
directly. The preload script is a thin, trusted intermediary that exposes only five
specific operations to the UI:

- **Open files** — ask the OS to show a file picker and return the chosen paths
- **Read a file** — load a file's raw bytes into memory
- **Save a recording** — write the mixed audio to disk after showing a save dialog
- **Reveal a file** — open the OS file manager with a track's source file selected
- **Resolve a dropped file's path** — turn a drag-and-dropped `File` into its real
  on-disk path (Electron removed the `File.path` property in v32, so this is the
  only way the UI can learn where a dropped file actually lives)

### 3 — Renderer (the visible app)
This is a web page running inside Electron's Chromium browser. It contains the
entire user interface (built with React) and all of the audio processing (built with
the Web Audio API, which is a built-in browser technology).

---

## How the audio system works

### The audio graph

Every sound in Multitrack flows through a chain of audio "nodes" — think of them
as pieces of equipment on a mixing desk:

```
[Audio file buffer]
       │
  [Source Node]       ← one per track, recreated on every play
       │
  [Gain Node]         ← one per track, permanent; controls volume & fades
       │
  [Master Gain]       ← one for the whole app
       │
  ┌────┴────┐
  │         │
[Speakers] [Recorder tap]   ← what you hear  /  what gets captured
```

A **Source Node** is like pressing play on a tape player: once you press play, you
cannot rewind and press play again on the same tape — you need a new copy.
This is a rule of the Web Audio API, so the app creates a fresh Source Node every
single time a track starts playing.

The **Gain Node** is like the fader on a mixing desk. It stays alive permanently
for each track and is the place where all volume changes, fade-ins, and fade-outs
are applied. Because it persists, a smooth gain curve can be scheduled in advance
down to the exact audio sample.

---

## Playback modes

### Normal play
Load the audio into a Source Node, set the gain to the desired volume, start.
Simple.

### Fade in
When the track starts, the gain is at zero. A ramp is scheduled so it reaches the
target volume gradually over the configured duration (default 5 s).

### Fade out on pause or stop
The gain ramps down to zero over the configured duration. A timer fires at the end
to actually stop the audio source and restore the gain to its normal value, ready
for the next play.

### Loop with fades (the interesting one)
The Web Audio API's built-in looping plays the audio seamlessly but gives no way
to inject gain automation at the loop boundary. To fix this, the app takes control
of looping itself:

1. Play the track to the end without native looping.
2. Schedule a gain fade-out starting N seconds before the end.
3. When the track finishes, the gain is exactly at zero — no click or pop.
4. Immediately start a new source from the beginning with a fade-in.
5. Repeat forever until the user stops or disables loop.

This means every loop cycle has a fresh, smooth fade-out → fade-in transition.

### Seek with cross-fade
When "Seek Fade" is enabled and the user clicks the progress bar:

1. The current audio fades out over the configured duration (default 2 s).
2. Playback is silently jumped to the new position.
3. The audio fades back in from that position.

This avoids the jarring click you hear when audio jumps mid-wave.

---

## The UI

The interface is a free-form canvas. Each loaded track appears as a card that can
be dragged anywhere on the canvas. Cards do not snap to a grid — they are
completely free-floating.

### Inside a track card

```
┌──────────────────────────────────────┐
│  Track title                      ✕ │  ← drag this area to move the card
├──────────────────────────────────────┤
│  0:04                          3:24  │  ← current time / total duration
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← click anywhere to seek
├──────────────────────────────────────┤
│  ▶  ⏹   L  I  O  S  ⚙            │  ← controls row
│  🔊 ──────────────────────── 80%    │  ← volume
└──────────────────────────────────────┘
```

**Controls row:**
- ▶ / ⏸ — play or pause
- ⏹ — stop and return to the beginning
- **L** — loop (purple when on)
- **I** — fade in (cyan when on)
- **O** — fade out (orange when on)
- **S** — seek fade (green when on)
- **⚙** — opens the fade duration settings panel

### The settings panel
Clicking ⚙ overlays the card with three sliders (0–10 seconds each):
- Fade In duration
- Fade Out duration
- Seek Fade duration

Changes only take effect when you press **Apply**. Closing with **Cancel** or
clicking outside the panel discards the draft.

---

## State: two copies of the truth

React, the UI library, needs all data to flow in one direction to work correctly.
The Web Audio API, on the other hand, is imperative and mutable — you call methods
on nodes, not update data models.

These two worlds are bridged by keeping two parallel representations of each track:

| Where | What is stored |
|---|---|
| React (UI) | Simple data: title, duration, volume, which toggles are on, current playback position |
| AudioEngine | Live audio objects: GainNode, the active SourceNode, the raw audio buffer, precise timing numbers |

Every user action (play, pause, seek, change volume…) first updates the audio engine
directly, then immediately updates the React data to match. The progress bars are
special: they update 10 times per second via a timer that asks the engine for the
exact current position.

---

## Recording

The recorder captures whatever comes out of the master gain node — the full mix,
exactly as it sounds through the speakers. It uses the browser's built-in
`MediaRecorder` API, which records in a compressed format (WebM/Opus) because that
is the only format browsers can write in real time.

When you stop recording, the app:
1. Takes the compressed data
2. Decodes it back to raw audio samples (using the Web Audio API's decoder)
3. Re-encodes those samples as an uncompressed 16-bit WAV file
4. Shows a "Save as…" dialog so you can choose where to put it

The result is a standard WAV file that any audio software can open.

---

## Loading audio files

Files can be brought in two ways:

1. **Drag and drop** — drop one or more audio files directly onto the canvas
2. **Open Files button** — click "+ Open Files" to use the native OS file picker

The app supports: MP3, WAV, OGG, FLAC, AAC, M4A, Opus, WebM.

When a file is loaded, it is fully decoded into raw audio samples and held in
memory for the entire session. This means seek and loop are instantaneous — there
is no streaming or disk access after the initial load.

---

## Convention: dialogs and overlays are independent components

Every dialog or overlay (e.g. the fade-duration settings panel, the reverb
options panel) must be built as its own component — its own file, its own
markup, and its own state/logic hook — rather than inline inside the track
card component. Each such component must ship with its own test suite.

**Why:** keeping overlay markup and logic inline in `TrackPlayer.tsx` /
`useTrackPlayer.ts` makes that pair grow unbounded as more effects gain their
own settings panel, and forces their tests to live mixed in with the track
card's own tests. Independent components stay small, are individually
testable, and can be reused (e.g. the same dialog shell for future effects)
without touching the track card at all.

**How to apply:** when adding a new per-track settings panel or any other
overlay, create a dedicated component (and paired hook, if it owns non-trivial
state or logic) under its own file, wire it into the track card as a child,
and add its tests to a dedicated test file rather than the track card's.
See `doc/TODO.md` ("Coding improvements") for the pending extraction of the
existing fade and reverb panels into this shape.
