# Filter Effect — Implementation

## Context

`doc/TODO.md` now lists a **Filter** item (added last turn): a single sweepable `BiquadFilterNode` per track — lowpass/highpass/bandpass type switch, cutoff frequency, resonance (Q), output level. The user has asked to implement it now, with three explicit directives:

1. **UI structure** — mirror the existing Delay and Reverb settings panels (same toggle-button + overlay-dialog shape), placed in the effects section at the top of the track card (the row that currently holds the "D" and "R" buttons).
2. **Signal chain** — insert the filter **before** delay: `gainNode → filter insert → delay insert → reverb insert → masterGain`.
3. **Follow `doc/ARCHITECTURE.md`** — specifically its "dialogs and overlays are independent components" convention. The existing Delay/Reverb panels are inline in `TrackPlayer.tsx`/`useTrackPlayer.ts` (a known, already-flagged debt in `doc/TODO.md`'s "Coding improvements"), so the new Filter panel should be built as its own component + hook from the start, not added to that inline pile.

## Design (mirrors Delay/Reverb exactly, per the user's request)

Filter gets the same 5-field shape as Reverb (a type dropdown + 3 shaping params + mix + output), reusing the proven dry/wet-insert pattern:

- **Type** — dropdown: `lowpass` / `highpass` / `bandpass` (new `FilterType` union, same shape as `ReverbRoom`).
- **Cutoff** — 20–20000 Hz, default 1000.
- **Resonance (Q)** — 0.1–20, default 1 (Web Audio's own default Q).
- **Mix** — 0–100%, default 0 (fully dry until opted in — same convention as delay/reverb; this is also what makes the button's "active" indicator reuse the exact same `mix > 0` check already used for Delay/Reverb).
- **Output** — 0–100%, default 100.

No feedback loop is needed (unlike delay), so the node topology is the simple dry/wet split already used by reverb:
```
dryGain ─────────────────────────┐
biquadFilter → wetGain ┴→ outputGain → (feeds into delay's entry points)
```

### 1. `src/renderer/domain/TrackState.ts`
- Add `export type FilterType = 'lowpass' | 'highpass' | 'bandpass';`
- Add `filterType`, `filterCutoff`, `filterResonance`, `filterMix`, `filterOutput` fields to `TrackState`, following the exact naming convention of the `delay*`/`reverb*` groups.

### 2. `src/renderer/audio/AudioEngine.ts`
- New `FilterNodes` interface (`dryGain`, `biquadFilter`, `wetGain`, `outputGain`, `type`, `cutoff`, `resonance`, `mix`, `outputLevel`), mirroring `ReverbNodes`.
- Add `filter: FilterNodes` to `TrackNodes`.
- New `private _createFilterNodes(): FilterNodes`, mirroring `_createReverbNodes()` (`AudioEngine.ts:573-614`): wires `biquadFilter → wetGain`, `dryGain`/`wetGain → outputGain`, sets `biquadFilter.type`/`frequency`/`Q` from the defaults, leaves `outputGain` unconnected (caller wires it onward, same comment convention as `_createDelayNodes`).
- New `setFilterSettings(id, type, cutoff, resonance, mix, outputLevel)`, mirroring `setReverbSettings` (`AudioEngine.ts:439-471`) — clamps each value, assigns `biquadFilter.type` directly (not an `AudioParam`, so no ramp — same as reverb's instant `convolver.buffer` swap), ramps `frequency`/`Q`/dry-wet/output via `setTargetAtTime`.
- Update `addTrack` (`AudioEngine.ts:122-152`): build `filter` before `delay`; rewire the chain to `gainNode → filter.dryGain`/`filter.biquadFilter`, then `filter.outputGain → delay.dryGain`/`delay.delayNode` (replacing the current direct `gainNode → delay` wiring), then the existing `delay.outputGain → reverb` wiring unchanged. Update the "Chain order" comment.
- Update `removeTrack` (`AudioEngine.ts:154-173`): disconnect the 4 new filter nodes alongside the existing delay/reverb disconnects.

### 3. `src/renderer/context/AudioContext.tsx`
- Add `setFilterSettings` to `AudioContextValue` and as a `useCallback` mirroring `setReverbSettings` (`AudioContext.tsx:291-313`) — calls `engine.setFilterSettings(...)` then mirrors the 5 fields into the matching `TrackEntry`'s `state` via `setTracks`.
- In `addTracks`, seed the 5 new fields with their defaults on every new `TrackState` (`AudioContext.tsx:79-103`).
- **In the existing `duplicateTrack`** (added for the clone-track feature): add `engine.setFilterSettings(newId, source.state.filterType, source.state.filterCutoff, source.state.filterResonance, source.state.filterMix, source.state.filterOutput)` alongside the existing delay/reverb re-apply calls — otherwise clones would silently lose their filter settings.

### 4. New component: Filter settings dialog (independent, per ARCHITECTURE.md)
- `src/renderer/components/TrackPlayer/useFilterSettingsDialog.ts` — a self-contained hook taking the track's `TrackState`, calling `useAudio()` itself for `setFilterSettings`. Owns `isOpen` + 5 draft values + `open`/`close`/`apply`, mirroring the existing reverb draft logic in `useTrackPlayer.ts` (`openReverbSettings`/`applyReverbSettings`) but self-contained rather than folded into that shared hook — this is the concrete difference from how Delay/Reverb were built, per the user's ask to follow the ARCHITECTURE convention this time.
- `src/renderer/components/TrackPlayer/FilterSettingsDialog.tsx` — presentational overlay, controlled entirely by props from the hook (type dropdown, 3 sliders, mix, Apply/Cancel), structurally identical to the reverb panel markup in `TrackPlayer.tsx` today.
- `src/renderer/components/TrackPlayer/FilterSettingsDialog.css` — own stylesheet, same visual language (dark backdrop overlay, panel, Apply/Cancel button styling) as the existing overlays, with a distinct accent color (blue — unused by any existing effect/toggle) for the slider thumbs and Apply button.
- Own test file: `src/__tests__/components/TrackPlayer/FilterSettingsDialog.test.tsx`.

### 5. Wire into `TrackPlayer.tsx` (untouched: `useTrackPlayer.ts`)
- Call `const filterDialog = useFilterSettingsDialog(state);` directly inside `TrackPlayer.tsx` — a second, independent hook call alongside the existing `useTrackPlayer(...)`, so `useTrackPlayer.ts` needs no changes at all for this feature.
- Add a "Filter settings" button (`btn-filter`, label `F`, active when `state.filterMix > 0`) to the `.track-effects` row in `TrackPlayer.tsx`, positioned **before** the existing Delay button (`F`, `D`, `R` — matching signal-chain order).
- Render `<FilterSettingsDialog ... />` conditionally on `filterDialog.isOpen`, alongside the existing fade/delay/reverb overlays.
- Add `track-player--filter-open` to the card's className when `filterDialog.isOpen` (same `min-height: 225px` treatment as `--reverb-open`/`--delay-open`, since the field count matches reverb's).
- `TrackPlayer.css`: extend the shared `.btn-delay, .btn-reverb { ... }` / `--active` selectors to include `.btn-filter`, and add the `.track-player--filter-open` modifier.

### 6. Tests
- `AudioEngine.test.ts`: add a `setFilterSettings` smoke test mirroring the existing delay/reverb smoke tests. No new fake node class needed — `createBiquadFilter` is already faked (reused by delay/reverb's damping filters).
- `AudioContext.test.tsx`: add `setFilterSettings: vi.fn()` to the mock; extend the existing `duplicateTrack` test to assert it's called with the source's filter settings; add a seed-defaults assertion in the `addTracks` test if convenient.
- `TrackPlayer.test.tsx`: add `setFilterSettings: vi.fn()` to the mock engine; add Apply/Cancel tests for the filter panel mirroring the existing delay/reverb Apply/Cancel tests (open via the `F` button, change the dropdown + sliders, Apply calls `engine.setFilterSettings` with the right args, Cancel calls nothing).
- New `FilterSettingsDialog.test.tsx`: unit tests for the presentational component in isolation (renders draft values, calls `onApply`/`onCancel`), following `TrackContextMenu.test.tsx`'s shape.

### 7. Docs
- `doc/TODO.md`: mark the **Filter** item `[x]` **Implemented**, referencing the new files (same style as the existing Delay/Reverb entries).
- `doc/DEVLOG.md`: append a new dated entry once implemented, following the file's established format (files touched, what changed and why, any snags hit, verification performed) — same as the last two entries (Delay, Clone track).

## Verification

- Run the full test suite (`./node_modules/.bin/vitest run` — `npx` is broken in this environment, use the local binary directly) and confirm everything passes, including the new/extended tests above.
- Typecheck with `./node_modules/.bin/tsc --noEmit -p tsconfig.json` and confirm no new errors (pre-existing `main.test.ts` spread-type errors are unrelated and expected).
- Manually verify in the browser preview (`preview_start` with the `renderer` launch config, or navigate to the already-running `localhost:5173` if occupied): drop a synthetic WAV (as done for the clone-track feature), open the new Filter panel via the `F` button, switch type/cutoff/resonance/mix/output, Apply, and confirm the button lights up and the audio pipeline runs without console errors. Also verify the chain order by checking `addTrack` connects filter before delay (e.g. instrumenting `AudioContext.prototype` factory methods as done for the reverb/delay verification in prior DEVLOG entries), and verify a duplicated track carries its filter settings over.