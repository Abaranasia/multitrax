---
name: run-multitrax
description: Build, run, and drive the multitrax Electron desktop app (multi-track audio player/mixer). Use when asked to start the app, launch multitrax, take a screenshot of it, load a track, switch to mixer view, or interact with its UI.
---

multitrax is an Electron + React + TypeScript desktop app (Web Audio API
multi-track player/mixer). It always runs in dev mode when launched
unpackaged (see Gotchas), so driving it means: Vite dev server + built
main process + Electron, automated via `playwright-core`'s `_electron`
API. The driver is `.claude/skills/run-multitrax/driver.mjs` — pipe it a
script of commands over stdin.

All paths below are relative to the repo root (`multitrax/`).

## Prerequisites

Node + pnpm (already required by the project). `playwright-core` is a
devDependency (`pnpm add -D playwright-core` — already in
`package.json`). No browser download needed: the driver launches the
project's own `node_modules/electron`, not a Playwright-managed browser.

Verified on Windows. Not tried on Linux/macOS — `xvfb-run` would be
needed on headless Linux (Electron opens a real window); the driver's
`electronBin` path already branches per `process.platform`, but that
branch is unverified.

## Build

```bash
pnpm install
pnpm build          # vite build (renderer) + tsc (main + preload)
```

The driver's `launch` command also starts the Vite dev server itself if
one isn't already up on port 5173 — see Gotchas for why that's required
even though `pnpm build` produced a `dist/renderer/`.

## Run (agent path)

Pipe a newline-separated command script into the driver in one shot —
no tmux needed, this works as a single call:

```bash
node .claude/skills/run-multitrax/driver.mjs <<'EOF'
launch
open .claude/skills/run-multitrax/fixtures/tone.wav
mixer
click .btn-mute
click .btn-solo
ss demo
quit
EOF
```

Screenshots land in `%TEMP%\multitrax-shots\` (override with
`SCREENSHOT_DIR`). The Vite dev server log (when the driver starts one
itself) lands in `<screenshot-dir>/vite.log`.

It also works as a live interactive REPL (run it with no heredoc, type
commands, `Ctrl-D` or `quit` to exit) — the queueing in the driver
exists specifically so both modes work correctly.

### Commands

| command | what it does |
|---|---|
| `launch` | ensures the Vite dev server is up, launches Electron, finds the real window (filters out the auto-opened DevTools window) |
| `open <path>` | loads an audio file — patches the *main-process* native file-picker so it "returns" `<path>` (relative to repo root unless absolute), clicks **+ Open Files**, waits for the track to appear |
| `mixer` | clicks **☰ View** → **Switch to Mixer View**, waits for `.mixer-strip` |
| `ss [name]` | screenshot → `<SCREENSHOT_DIR>/<name>.png` |
| `click <css-sel>` | click element via `document.querySelector(sel).click()` |
| `click-text <text>` | click a button/link/`[role=button]` whose text matches/contains `<text>` |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait up to 10s for a selector |
| `eval <js>` | evaluate JS in the renderer, print the JSON result |
| `text [css-sel]` | print `innerText` of the selector (or `document.body`) |
| `windows` | list all Electron window URLs |
| `quit` | close the app (and the Vite server, if this driver started it) |

A ready-made 1s 440Hz mono WAV fixture lives at
`.claude/skills/run-multitrax/fixtures/tone.wav` (regenerate with
`node .claude/skills/run-multitrax/fixtures/gen-tone.mjs <out-path>`) —
use it with `open` instead of hunting for a real audio file.

## Run (human path)

```bash
pnpm dev     # vite dev server + electron, opens a real window. Ctrl-C to quit.
```

or, after `pnpm build`, `pnpm start` — but note `pnpm start` (`electron .`
unpackaged) hits the same always-dev-mode behavior described in Gotchas,
so it also needs the Vite dev server running at `localhost:5173` or the
window loads nothing.

## Test

```bash
pnpm typecheck     # tsc --noEmit × 3 tsconfigs
pnpm lint          # eslint .
pnpm test:no-watch # vitest run — 36 files / 304 tests as of this writing
```

## Gotchas

- **`pnpm start` / any unpackaged launch is ALWAYS dev mode, never the
  built `dist/renderer/index.html`.** `main.ts` computes
  `isDev = NODE_ENV === 'development' || !app.isPackaged`. Since
  `electron .` (unpackaged) always has `app.isPackaged === false`, that
  `OR` makes `isDev` `true` regardless of `NODE_ENV` — there is no way to
  get the "production" `loadFile` branch without actually packaging via
  `electron-builder`. The driver's `launch` command works around this by
  making sure the Vite dev server is running on `:5173` before launching
  Electron, same as the project's own `pnpm dev` script does.

- **The native "Open Files" dialog can't be automated — patch
  `dialog.showOpenDialog` in the *main* process, not the renderer's
  `window.electronAPI.openAudioFiles`.** The obvious-looking fix (stub
  the renderer wrapper to return a fixed path) breaks the app's real
  security model: `main.ts`'s `dialog:openAudioFiles` IPC handler is what
  populates a `grantedPaths` allowlist, and `fs:readAudioFile` rejects
  any path not in that allowlist with "Access denied". Stubbing only the
  renderer side means the allowlist never gets populated, so the file
  read silently fails and the track never appears (no error surfaces in
  the UI — `AudioContext.tsx`'s `addTracks` just `console.error`s and
  skips it). The driver's `open` command instead does
  `app.evaluate(({dialog}, path) => { dialog.showOpenDialog = async () => ({canceled:false, filePaths:[path]}) }, path)`
  — same `dialog` singleton the real IPC handler calls, so the real
  handler still runs and still grants the path.

- **Electron auto-opens a second "window" for DevTools** (because
  `isDev` is always true — see above — and `main.ts` calls
  `webContents.openDevTools()`). `app.windows()` returns both; grab the
  one whose `.url()` doesn't start with `devtools://`, or you'll try to
  screenshot/click a 0-width DevTools frame (`Cannot take screenshot
  with 0 width`).

- **The Mute/Solo buttons' visible text is just "M"/"S", not
  "Mute"/"Solo".** `click-text Mute` returns `NOT_FOUND` — those words
  only exist in the `title` attribute. Use `click .btn-mute` /
  `click .btn-solo` instead.

- **Piped/heredoc stdin races the driver's own async commands** if you
  naively run one command per `readline` `'line'` event: `readline`
  fires every buffered line (and then `'close'` on EOF) essentially all
  at once, well before a slow command like `launch` (multi-second) has
  resolved — every command after the first would see `app` still `null`
  and fail with `launch first`, and the process could exit before
  `launch` even finishes. The driver queues incoming lines and drains
  them one at a time, and its `'close'` handler waits for the queue to
  fully drain before calling `quit`/`process.exit`. If you fork this
  driver for another project, keep that queuing — it's not optional for
  the piped/batch usage this skill relies on.

- **`quit` didn't actually stop the Vite server it started, on
  Windows.** `child.kill()` only signals the immediate child process; with
  `shell: true` that child is `cmd.exe`, and Windows does not propagate
  the kill to `cmd.exe`'s own child (`pnpm.cmd`) or grandchild (the real
  `vite`/node process) — port 5173 stays bound after the driver exits.
  Fixed by tree-killing via `taskkill /pid <pid> /f /t` on `win32`
  instead of `child.kill()`.

## Troubleshooting

- **`ERR_MODULE_NOT_FOUND: playwright-core`**: run the driver from
  somewhere under this repo (module resolution needs the repo's
  `node_modules`) — don't copy it out to a scratch/tmp directory.
- **`page.screenshot`: `Cannot take screenshot with 0 width`**: you
  grabbed the DevTools window instead of the app window — see Gotchas.
- **A track click ("+ Open Files") does nothing and no track appears**:
  you probably stubbed the wrong side of the file-open flow — see
  Gotchas (main-process `dialog.showOpenDialog`, not the renderer API).
- **Driver hangs / dies with no output after `launch`**: check
  `<SCREENSHOT_DIR>/vite.log` — the dev server may have failed to start
  (port 5173 already in use by a *different* process is fine, the
  driver reuses it; a genuinely broken Vite config is not).
