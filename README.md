# Multitrack

A desktop multi-track audio player built with **Electron + TypeScript + React + Web Audio API**.

## Features

- Drag & drop audio files directly onto the canvas (or use the **+ Open Files** button)
- Each track rendered as an independent, **draggable** player card
- Per-track **play/pause/stop**, **volume slider**, **loop toggle**
- Real-time **progress bar** with click-to-seek
- Track title, current time, and total duration display
- Clean architecture: audio engine fully decoupled from UI

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 42 |
| Renderer | React 19 + Vite 8 |
| Language | TypeScript 6 |
| Audio | Web Audio API (native) |
| Package manager | pnpm |

## Project Structure

```
src/
  main/
    main.ts          # Electron main process, IPC handlers
    preload.ts       # Context bridge (exposes electronAPI to renderer)
  renderer/
    audio/
      AudioEngine.ts # Web Audio API wrapper (AudioBufferSourceNode + GainNode)
    components/
      Canvas.tsx     # Full-screen canvas, drop target, hosts TrackPlayers
      TrackPlayer.tsx # Individual draggable track card
    context/
      AudioContext.tsx # React context wiring engine to UI
    domain/
      Track.ts
      TrackState.ts  # Pure data types
    utils/
      formatTime.ts
    main.tsx         # React entry point
    index.html
```

## Development

```bash
# Install deps
pnpm install

# Build main process first, then start both renderer dev server and Electron
pnpm build:main && pnpm dev
```

> In dev mode the renderer runs on `http://localhost:5173` and Electron loads it from there.

## Production Build

```bash
pnpm build     # Builds renderer (Vite) + main process (tsc)
pnpm pack      # Packages into an installer via electron-builder
```

Output: `release/` folder with platform-native installer.

## Build for macOS
This repo already has macOS packaging configured in package.json:

build.mac.target: "dmg"
On a Mac machine
Run:
```bash
pnpm install
pnpm build
pnpm pack
```
That will produce the packaged macOS app under release/, typically as a .dmg installer.

### Important
You need to run this on macOS to produce a valid Mac app.
Building a Mac executable from Windows is not supported by Electron Builder in a normal local setup.
If you want to build from Windows, use a macOS build agent / VM or a CI service that runs on macOS.

## Planned / Extension Points

- [ ] Waveform visualization using AnalyserNode + Canvas 2D
- [ ] Pitch / playback rate control
- [ ] Save/load session (JSON)
- [ ] MIDI trigger support
