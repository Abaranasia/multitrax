# Mobile Version — Plan & Considerations

An independent mobile app, not a port: a new project that reuses as much of the
existing audio logic as possible while rebuilding the UI and platform-integration
layer for touch/mobile from scratch.

## Assumptions

These are defaults chosen to unblock planning — revisit if any don't fit:

1. **Capacitor + web reuse** for the stack — wraps a mobile-redesigned React app
   in a native shell; `AudioEngine.ts` ports over nearly unchanged since
   Capacitor's WebView supports the Web Audio API.
2. **pnpm monorepo with a shared `core` package** — one source of truth for the
   audio engine/domain/utils, imported by both the desktop and mobile apps.
3. **Both iOS and Android** as eventual targets, built incrementally.
4. **Background/lock-screen audio is a should-have, not a v1 blocker** —
   foreground-only first, designed so background support can be added without a
   rewrite.

## Why Capacitor over React Native

React Native's JS engine has no Web Audio API, so `AudioEngine.ts` (fades, loop
management, delay, convolution reverb) would need a full rewrite against a native
audio library — the hardest-won code in the project would not survive. Capacitor
wraps a real WebView (WKWebView on iOS, Chrome WebView on Android), which does
support the Web Audio API, so the engine moves over almost unchanged. A plain PWA
was also considered but rejected as the primary path because of weaker
background-audio support (especially iOS Safari) and no native file-save/share
sheet.

## Target architecture

```
multitrax/ (pnpm workspace root)
├── packages/
│   ├── core/       ← NEW: AudioEngine, domain types, utils — extracted, platform-agnostic
│   ├── desktop/    ← current Electron+React app, moved here, now imports core
│   └── mobile/     ← NEW: Capacitor + React app (iOS/Android native shells)
```

## What ports over as-is (→ `packages/core`)

- `AudioEngine.ts` and its Vitest suite (fake Web Audio fixtures — this is also
  the moment to do the `TODO.md` "extract fake Web Audio classes into a
  fixtures file" item, since now *two* apps need them).
- `domain/Track.ts`, `domain/TrackState.ts`.
- `utils/encodeWav.ts`, `utils/formatTime.ts`.

## What must be rebuilt for mobile

| Desktop mechanism | Mobile replacement |
|---|---|
| Electron `dialog:openAudioFiles` + `fs.readFileSync` | Capacitor Filesystem/document-picker plugin — no arbitrary file paths on mobile |
| `dialog:saveRecording` + `fs.writeFileSync` | Capacitor Filesystem write + Share sheet (no "Save As" dialog exists on mobile) |
| Free-form draggable `Canvas` | Vertical scrollable list or fader-strip layout — free positioning is a mouse-era pattern, doesn't translate to touch/narrow screens |
| Overlay panels opened by mouse-click | Same "independent component" convention from `ARCHITECTURE.md`, but as bottom sheets/modals sized for touch |
| *(nothing — no equivalent exists)* | Background audio + lock-screen transport via Media Session API + Capacitor background-mode plugin |
| *(nothing)* | Explicit "tap to enable audio" step — mobile browsers require a user gesture before `AudioContext` can start/resume |

## Risks worth spiking early, before committing further

- **WKWebView Web Audio parity** — `ConvolverNode`, the delay feedback loop, and
  `MediaRecorder` fed from `createMediaStreamDestination` all need to be verified
  on a real iOS device; WKWebView has historically had Web Audio quirks.
- **Memory** — decoding several full-length multi-track files into memory is
  fine on a desktop but can OOM budget Android devices. May need a
  track-count/size warning.
- **CPU/battery** — a `ConvolverNode` per track is expensive; the TODO.md's
  already-flagged "shared reverb send bus" idea becomes more important on
  mobile than on desktop.
- **iOS background audio** — requires declaring a background mode entitlement
  and actually playing audio when backgrounded, or iOS suspends the app in
  ~30s.
- **Recording ≠ microphone** — the recorder taps the internal mix graph, not
  `getUserMedia`. Worth confirming this doesn't trigger a mic-permission prompt
  (would confuse users and complicate App Store review copy).

## Phased plan

1. **Spike** — minimal Capacitor app running `AudioEngine` on a real iOS device
   + Android emulator, confirming convolver/delay/recorder all work. Go/no-go
   gate before further investment.
2. **Monorepo extraction** — convert to a workspace, pull `core` out of the
   desktop app, confirm desktop tests still pass unchanged.
3. **Mobile shell, thinnest slice** — Capacitor+React scaffold; import one file
   via native picker, decode, play/pause/volume.
4. **Feature parity** — track list UI, loop/fades/seek-fade (engine reuse, no
   changes needed), delay/reverb bottom sheets, recording + share-to-save.
5. **Mobile-only concerns** — background audio, lock-screen controls,
   first-gesture audio unlock, perf tuning for larger sessions.
6. **Release prep** — icons/splash, Apple Developer + Google Play
   accounts/signing, store listings.

## Decisions still open

- iOS in phase-1 scope needs a Mac + Apple Developer Program ($99/yr) — worth
  confirming resourcing before the spike.
- List vs. fader-strip layout for the canvas replacement is a design call, not
  just an implementation detail.
- Import UX: in-app picker only, or also support "Open with Multitrax" from the
  OS Files/share sheet?
- **Ionic as a UI component layer, on top of Capacitor** — not an alternative
  to Capacitor (same team builds both), but a component library on top of it:
  prebuilt, gesture-correct bottom sheets (`IonModal`) and sliders (`IonRange`)
  for exactly the touch UI this plan flags as "must rebuild." Tradeoff: its
  Shadow DOM, platform-adaptive (iOS/Material) components sit awkwardly next
  to this project's BEM + co-located CSS convention and the desktop app's own
  custom visual identity — a second UI paradigm alongside our own. Default is
  to skip it and build plain Capacitor + custom components first; revisit only
  if the hand-rolled bottom sheets/sliders in Phase 3 turn out to be more
  gesture-work than expected.
