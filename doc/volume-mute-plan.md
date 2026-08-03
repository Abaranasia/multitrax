# Mute by clicking the volume icon

## Context

`doc/TODO.md:193-195` asks for the volume icon (🔊) in each track card to toggle mute/unmute when clicked, reusing the existing per-track volume state and setter flow rather than introducing new state.

Investigated via `codegraph_explore`:
- `VolumeControl` ([VolumeControl.tsx](../src/renderer/components/TrackPlayer/components/volumeControl/VolumeControl.tsx)) is a pure presentational component: a `.volume-icon` span, a range input, and a percentage label.
- `useVolumeControl` ([useVolumeControl.ts](../src/renderer/components/TrackPlayer/components/volumeControl/useVolumeControl.ts)) computes `volume`/`percentage`/`style`/`title`/`onChange` from `TrackState` + the `setVolume(id, value)` setter it's handed.
- `setVolume` threads: `useVolumeControl` → `useTrackPlayer` → `AudioContext.tsx`'s `setVolume` (calls `engine.setVolume` then mirrors `state.volume` in React state) → `AudioEngine.setVolume` (clamps, ramps the gain node).
- `TrackPlayer` is keyed by `t.state.id` in [Canvas.tsx](../src/renderer/components/Canvas/Canvas.tsx) (line 33), so it (and any hook state inside it) persists across re-renders for the life of that track — a `useRef` in `useVolumeControl` is safe to rely on.
- No `muted` concept exists anywhere in `TrackState`, `AudioEngine`, or `AudioContext`.

**Decision (confirmed with user):** don't add a new `muted` field to `TrackState`/`AudioEngine`. Derive "muted" from `volume === 0`, and remember the last non-zero volume in a ref so the icon can restore it. This keeps the change entirely in the `VolumeControl`/`useVolumeControl` pair and reuses the existing `setVolume` setter untouched — no changes to `AudioEngine`, `AudioContext`, or `TrackState`.

## Implementation

### `useVolumeControl.ts`
- Add `const lastVolumeRef = useRef(state.volume > 0 ? state.volume : 1);`
- On every call, if `state.volume > 0`, update `lastVolumeRef.current = state.volume` (keeps it in sync with manual slider drags, not just mute toggles).
- Add `isMuted = state.volume === 0`.
- Add `onToggleMute = () => setVolume(state.id, isMuted ? lastVolumeRef.current : 0)`.
- Return `isMuted` and `onToggleMute` alongside the existing fields.
- Update `title` when muted (e.g. `Unmute` vs current `Volume: {percentage}%`) so the tooltip on the whole control stays meaningful — keep the slider `title` as-is, add a separate title for the icon (see below).

### `VolumeControl.tsx`
- Change the `.volume-icon` `<span>` to a `<button type="button" className="volume-icon">`, matching the existing `.btn-close` pattern (real button, not a styled span) for keyboard/AT accessibility.
- Add `isMuted: boolean` and `onToggleMute: () => void` to `VolumeControlProps`, wire `onClick={onToggleMute}`.
- Icon glyph: `🔇` when `isMuted`, `🔊` otherwise. `aria-label`/`title`: `Unmute` / `Mute`.

### `TrackPlayer.css`
- `.volume-icon` currently has no interactive styling (`font-size: 14px` only). Since it becomes a `<button>`, reset default button chrome (border, background, padding) to match the plain-glyph look it has today, and add `cursor: pointer`, mirroring how `.btn-close` (TrackPlayer.css:80-91) resets its own button.

## Tests

- `src/__tests__/components/TrackPlayer/VolumeControl.test.tsx`: extend `baseProps` with `isMuted: false` and `onToggleMute: vi.fn()`. Add cases:
  - clicking the icon calls `onToggleMute`.
  - renders `🔇` and "Unmute" affordance when `isMuted` is true, `🔊`/"Mute" otherwise.
- New `useVolumeControl.test.ts` (none exists yet, flagged by codegraph as untested) covering:
  - `onToggleMute` calls `setVolume(id, 0)` when volume > 0.
  - `onToggleMute` calls `setVolume(id, <remembered value>)` when volume is 0, after a prior non-zero volume was seen.
  - `isMuted` reflects `volume === 0`.

## Verification

- `npm test -- VolumeControl` (and the new `useVolumeControl` test) to confirm unit coverage.
- Manual: run the app (`npm run dev` / project's run skill), load a track, click the volume icon — audio should mute immediately and the slider should visually stay wherever it was (icon flips to 🔇); click again — audio resumes at the previous volume and slider reflects it. Also verify dragging the slider to 0 manually flips the icon to muted, and dragging back up unmutes.
