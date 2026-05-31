# Multitrack — Architecture Reference

## 1. Overview

Multitrack is a desktop multi-track audio mixing and recording app built with **Electron 42 + React 19 + Web Audio API**.  
It lets users load any number of audio files, control each one independently (play, pause, stop, seek, volume, loop, fades), and record the final mixed output as a WAV file.

---

## 2. Process Model

Electron runs two OS processes that communicate over IPC.

```
┌─────────────────────────────────────────────────────────┐
│  Main process  (Node.js)                                 │
│  src/main/main.ts                                        │
│                                                          │
│  • BrowserWindow lifecycle                               │
│  • Native dialogs  (open files, save recording)          │
│  • File-system reads / writes  (fs.readFileSync, etc.)   │
│  • IPC handlers  (ipcMain.handle)                        │
└───────────────────────┬─────────────────────────────────┘
                        │  IPC  (ipcRenderer.invoke)
                        │  serialised as ArrayBuffer / plain objects
┌───────────────────────▼─────────────────────────────────┐
│  Preload script  (sandboxed Node context)                │
│  src/main/preload.ts                                     │
│                                                          │
│  • Exposes window.electronAPI via contextBridge          │
│  • Typed in src/renderer/types/electron.d.ts             │
└───────────────────────┬─────────────────────────────────┘
                        │  window.electronAPI
┌───────────────────────▼─────────────────────────────────┐
│  Renderer process  (Chromium)                            │
│  src/renderer/                                           │
│                                                          │
│  • React 19 UI                                           │
│  • Web Audio API — all DSP happens here                  │
│  • MediaRecorder — captures the mixed output stream      │
└─────────────────────────────────────────────────────────┘
```

### IPC surface (`window.electronAPI`)

| Method | Direction | Purpose |
|---|---|---|
| `openAudioFiles()` | renderer → main | Shows native open-file dialog, returns `string[]` paths |
| `readAudioFile(path)` | renderer → main | Reads a file from disk, returns `ArrayBuffer` |
| `saveRecording(buffer, name)` | renderer → main | Shows native save dialog, writes WAV bytes to disk |

---

## 3. Renderer Architecture

### Component tree

```
AudioProvider  (context/AudioContext.tsx)
└── Canvas  (components/Canvas.tsx)
    ├── TrackPlayer × N  (components/TrackPlayer.tsx)
    └── RecorderBar  (components/RecorderBar.tsx)
```

### `Canvas`
- Full-screen drop target for OS drag-and-drop of audio files.
- Hosts the **+ Open Files** button (triggers `electronAPI.openAudioFiles`).
- Runs a `setInterval` every 100 ms to call `tickCurrentTimes`, keeping the
  progress bars and time displays in sync with the audio engine.
- Renders one `TrackPlayer` card per loaded track.

### `TrackPlayer`
- Draggable card positioned absolutely (`left/top` from `TrackEntry.x/y`).
- Drag is handled with raw `mousemove/mouseup` listeners — not a library.
- The progress bar click converts the click X ratio to seconds and calls `seek()`.
- Controls row (one flex row):
  - **▶ / ⏸** play–pause, **⏹** stop
  - **L** loop toggle (purple when on)
  - **I** fade-in toggle (cyan when on)
  - **O** fade-out toggle (orange when on)
  - **S** seek-fade toggle (green when on)
- Volume slider below the controls row.

### `RecorderBar`
- Uses `MediaRecorder` on the stream from `AudioEngine.getRecordingStream()`.
- Collects chunks every 250 ms while recording.
- On stop: decodes the compressed blob with `AudioContext.decodeAudioData`, then
  encodes it as 16-bit PCM WAV via `utils/encodeWav.ts`, and saves it via
  `electronAPI.saveRecording`.
- Displays a live elapsed-time counter while recording.

---

## 4. State Management

There is **no external state library**. State is split between two parallel but separate representations:

### React state (`AudioContext.tsx`)
Holds `TrackEntry[]` in `useState`.

```typescript
interface TrackEntry {
  state: TrackState;   // pure data, serialisable
  filePath: string;
  x: number;           // card position on canvas
  y: number;
}

interface TrackState {
  id: string;
  title: string;
  duration: number;    // seconds (read-only after load)
  currentTime: number; // updated by tickCurrentTimes @ 100 ms
  volume: number;      // 0–1
  loop: boolean;
  playing: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
}
```

### Engine state (`AudioEngine.ts`)
The `AudioEngine` class holds `Map<string, TrackNodes>` as private mutable state.  
`TrackNodes` mirrors `TrackState` but also carries live Web Audio objects.

```typescript
interface TrackNodes {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode | null;  // re-created on every play()
  buffer: AudioBuffer;
  startOffset: number;      // where to resume (seconds)
  startedAt: number;        // ctx.currentTime when last play() was called
  loop: boolean;
  playing: boolean;
  volume: number;
  fadeIn: boolean;
  fadeOut: boolean;
  seekFade: boolean;
  fadeOutTimer: ReturnType<typeof setTimeout> | null;
}
```

### Sync strategy

| Trigger | How sync happens |
|---|---|
| User action (play, pause, seek…) | `AudioContext.tsx` callback calls the engine imperatively, then updates React state immediately |
| Audio ends naturally | `source.onended` updates `TrackNodes`; next `tickCurrentTimes` tick propagates to React |
| Time display / progress bar | `Canvas` calls `tickCurrentTimes` every 100 ms; queries `engine.getCurrentTime` + `engine.isPlaying` for all tracks |

---

## 5. Audio Engine (`AudioEngine.ts`)

### Web Audio graph

```
AudioBufferSourceNode(s)
        │
   GainNode  (per track)
        │
   masterGain  (GainNode)
        ├──► AudioContext.destination  (speakers)
        └──► MediaStreamDestinationNode  (recorder tap)
```

### Key constants

| Name | Value | Purpose |
|---|---|---|
| `FADE_DURATION` | 5 s | Duration of play/stop/loop fade in and fade out |
| `SEEK_FADE_DURATION` | 2 s | Duration of seek cross-fade |

### Playback modes

#### Normal play (no loop, or loop without fades)
- Creates an `AudioBufferSourceNode` with `source.loop = track.loop`.
- `source.onended` clears `playing` / `startOffset`.

#### Play with loop + fades (`_playLoopWithFade`)
Activated automatically when `track.loop && (track.fadeIn || track.fadeOut)`.

- `source.loop` is forced to **false** — looping is managed manually so that
  gain automations can be re-applied on every cycle.
- Gain automation schedule per iteration:

  | State | Gain curve |
  |---|---|
  | fadeIn + fadeOut | `0 → volume` over 5 s, hold, `volume → 0` over last 5 s |
  | fadeIn only | `0 → volume` over 5 s, hold at volume |
  | fadeOut only | hold at volume, `volume → 0` over last 5 s |
  
- For buffers shorter than 10 s, the two ramps meet at the midpoint (V-shape).
- `source.onended` restarts the cycle by calling `_playLoopWithFade` again
  (if `track.loop && track.playing` is still true).

#### Seek with fade (`seekFade`)
- Starts a 2 s `linearRampToValueAtTime(0)` on the gain node.
- A `setTimeout` fires after 2 s: stops the old source, moves `startOffset`,
  then starts a new source (routing to `_playLoopWithFade` if loop+fade is active,
  otherwise a plain source with a 2 s fade-in).

#### Fade out on pause / stop
- Uses a `setTimeout`-based `_startFadeOut` helper (not Web Audio scheduling)
  so it can run a JS callback after the fade.
- `_cancelFadeOut` clears the timer, stops the source, and restores gain.

### `getCurrentTime`
```typescript
getCurrentTime(id): number {
  // If paused: returns startOffset
  // If playing: startOffset + (ctx.currentTime - startedAt)
  // If loop:    wrapped with % buffer.duration
}
```

---

## 6. Recording Pipeline

```
AudioEngine.getRecordingStream()
        │
        │  MediaStream (tap on masterGain)
        ▼
MediaRecorder  (webm/opus or webm or ogg — browser-dependent)
        │  250 ms chunks  (Blob[])
        ▼
Blob → ArrayBuffer  (blob.arrayBuffer())
        │
        ▼
AudioContext.decodeAudioData()  →  AudioBuffer  (raw PCM)
        │
        ▼
encodeWav(audioBuffer)  →  ArrayBuffer  (RIFF/WAVE, 16-bit PCM, interleaved)
        │
        ▼
electronAPI.saveRecording(buffer, "session-YYYY-MM-DDTHH-MM-SS.wav")
        │
        ▼
fs.writeFileSync  (main process, after native save dialog)
```

`encodeWav` (`src/renderer/utils/encodeWav.ts`):  
Writes the standard 44-byte RIFF/WAVE header followed by interleaved 16-bit
little-endian PCM samples for all channels.

---

## 7. Build System

| Step | Tool | Output |
|---|---|---|
| Renderer | Vite 8 (root: `src/renderer/`) | `dist/renderer/` |
| Main process | `tsc -p tsconfig.main.json` | `dist/main/main.js` |
| Preload | `tsc -p tsconfig.preload.json` | `dist/main/preload.js` |
| Packaging | electron-builder | `release/` (AppImage / dmg / nsis) |

### Dev workflow

```
pnpm dev
  1. tsc compiles main + preload  →  dist/main/
  2. patch-gsettings.mjs patches GNOME GSettings schema (Linux Wayland fix)
  3. concurrently:
       vite            → http://localhost:5173  (HMR renderer)
       wait-on + electron  → loads renderer from localhost
```

### Linux / Wayland note
`scripts/patch-gsettings.mjs` copies the system `org.gnome.desktop.interface`
GSettings XML schema into `.gsettings-schemas/`, injects a stub
`font-antialiasing` key (removed in GNOME 46 but still read by Electron's GTK
layer, causing a SIGSEGV), then recompiles with `glib-compile-schemas`.  
The patched directory is passed to Electron via `GSETTINGS_SCHEMA_DIR`.

---

## 8. File Map

```
multitrack/
├── package.json               runtime + build config, pnpm scripts
├── vite.config.ts             renderer build (root: src/renderer/, out: dist/renderer/)
├── tsconfig.json              base TS config (used by the renderer via Vite)
├── tsconfig.main.json         tsc config for src/main/main.ts
├── tsconfig.preload.json      tsc config for src/main/preload.ts
├── scripts/
│   └── patch-gsettings.mjs   Linux/Wayland GNOME schema workaround
└── src/
    ├── main/
    │   ├── main.ts            Electron main process, IPC handlers, BrowserWindow
    │   └── preload.ts         contextBridge → window.electronAPI
    └── renderer/
        ├── index.html         HTML shell, mounts #root
        ├── index.css          global reset / body styles
        ├── main.tsx           React entry — wraps <Canvas> in <AudioProvider>
        ├── audio/
        │   └── AudioEngine.ts imperative Web Audio wrapper (all DSP logic)
        ├── components/
        │   ├── Canvas.tsx     drop target, card host, tickCurrentTimes interval
        │   ├── Canvas.css
        │   ├── TrackPlayer.tsx draggable card, progress bar, controls row
        │   ├── TrackPlayer.css colour-coded toggle variants, layout
        │   ├── RecorderBar.tsx MediaRecorder → WAV pipeline, elapsed timer
        │   └── RecorderBar.css
        ├── context/
        │   └── AudioContext.tsx React context, TrackEntry[] state, all action callbacks
        ├── domain/
        │   ├── Track.ts       { state: TrackState; audioBuffer: AudioBuffer }  (unused in rendering)
        │   └── TrackState.ts  pure data type for one track's UI-visible state
        ├── types/
        │   └── electron.d.ts  global Window augmentation with ElectronAPI type
        └── utils/
            ├── encodeWav.ts   RIFF/WAVE encoder (float32 PCM → 16-bit PCM)
            └── formatTime.ts  seconds → "m:ss"
```

---

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| No state library | State is simple: one flat list of tracks + positions. React context + useState is sufficient |
| Dual state structures (`TrackState` + `TrackNodes`) | Separates serialisable UI state from live audio objects; React never touches `AudioBuffer` or `GainNode` |
| `AudioBufferSourceNode` re-created on every play | Web Audio API spec: a source node can only be started once |
| Manual loop management in `_playLoopWithFade` | `source.loop=true` bypasses JS callbacks at loop boundaries, making per-cycle gain automation impossible |
| WAV export via decode-then-re-encode | `MediaRecorder` only outputs compressed formats; decoding to `AudioBuffer` and re-encoding to PCM WAV gives a lossless, universally compatible file |
| `contextIsolation: true`, `nodeIntegration: false` | Standard Electron security hardening; renderer cannot access Node APIs directly |
| `GSETTINGS_SCHEMA_DIR` + schema patch | Prevents Electron from crashing on Linux with GNOME 46+ due to a missing GSettings key |
