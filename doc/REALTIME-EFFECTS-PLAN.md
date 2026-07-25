# Real-Time Effect Preview + Floating Dialog — Plan & Considerations

Convert the Filter/Distortion/Delay/Reverb settings dialogs from "draft state,
Apply/Cancel" full-bleed overlays into a live-preview floating panel positioned
beside the `TrackPlayer` card instead of covering it — so tweaking a knob is heard
immediately, and the waveform/transport controls stay visible while adjusting.

## Current behavior (confirmed, not assumed)

- All four `use<Effect>SettingsDialog.ts` hooks
  (`src/renderer/components/TrackPlayer/components/effects/<effect>/`) share an
  identical pattern: `open()` seeds local draft `useState` values from
  `state.<param>`; sliders' `onChange` only update draft state; `apply()` calls the
  matching `useAudio()` setter (`setFilterSettings` / `setDistortionSettings` /
  `setDelaySettings` / `setReverbSettings`) and closes; `close()`/Cancel just
  discards drafts with no commit.
- The four `AudioEngine.ts` setters only ramp existing `AudioParam`s via
  `setTargetAtTime` — no node recreation/reconnect — so they're cheap enough to
  call on every drag event, **except** `setDistortionSettings`, which reassigns
  `waveShaper.curve` via `_makeDistortionCurve(drive)` on every call, reallocating
  a 44100-sample `Float32Array` each time.
- Each `<effect>-settings-overlay` is `position: absolute; inset: 0` inside
  `.track-player` (itself `overflow: hidden`), fully covering the card. Opening one
  adds a `track-player--<effect>-open` modifier that forces
  `min-height: 225px` on `.track-player` so the overlay's content doesn't clip.

## Proposed approach

1. **Live updates** — call the matching `useAudio()` setter from each `setDraftX`
   on every `onChange`, instead of only from `apply()`.
2. **Cancel/revert semantics** — snapshot the pre-open values in a ref inside
   `open()` (already computed as the draft seed values). Cancel re-applies that
   snapshot via the setter before closing, instead of a no-op discard, since
   changes are now already audible. "Apply" collapses into a single "Done"/close
   action; "Cancel" becomes the only other button.
3. **Distortion curve cost** — keep drive/tone/mix/output ramping live on every
   `input` event (cheap), but debounce the curve regeneration itself — e.g. commit
   it on `pointerup`/`change`, or coalesce via `requestAnimationFrame` — so it
   isn't reallocated on every drag tick.
4. **Positioning** — replace the `inset: 0` full-bleed overlay with a shared
   `FloatingSettingsPanel` rendered as a sibling anchored beside the card (e.g.
   below or to the right), dropping the `track-player--<effect>-open` /
   `min-height: 225px` hack. A simple fixed-side anchor is enough given this is a
   desktop app with a large canvas — no viewport-flipping logic needed.
5. **Shared abstraction** — since all four hooks/CSS overlays are near-identical
   in shape, extract a common `useEffectDialog` hook (parameterized by draft
   fields + the `useAudio` setter) and a shared `FloatingSettingsPanel`
   component/CSS, replacing the four duplicated implementations.

## Affected files (when picked up)

- All four `use<Effect>SettingsDialog.ts` hooks and `<Effect>SettingsDialog.tsx` /
  `.css` files under `src/renderer/components/TrackPlayer/components/effects/`.
- `TrackPlayer.tsx` — drop the `--<effect>-open` modifier classes.
- `TrackPlayer.css` — drop the `min-height` open-state rules.
- New shared files: `effects/shared/useEffectDialog.ts` and
  `FloatingSettingsPanel.tsx` / `.css`.

## Status

Not started — captured here as a future improvement. See `TODO.md` → "Track / UI
features (non-effects)" for the tracked checklist entry.
