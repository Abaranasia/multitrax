# Code Refactor Plan

## Goals
- Reduce the size and responsibility of src/renderer/components/TrackPlayer/TrackPlayer.tsx without changing current audio behavior.
- Separate UI layout, overlay state, and audio actions so the track card becomes easier to test and extend.
- Align future work with the architecture in ARCHITECTURE.md and the pending items in doc/TODO.md.

## Phased implementation
1. Stabilize the baseline
   - Review the current responsibilities in src/renderer/components/TrackPlayer/TrackPlayer.tsx and src/renderer/components/TrackPlayer/useTrackPlayer.ts.
   - Preserve behavior while identifying boundaries between layout, controls, overlays, and engine calls.
   - Add or tighten tests before refactoring so regressions are visible.

2. Extract presentational components
   - Split the track card into focused pieces such as a header, transport controls, volume section, and overlay host.
   - Keep each component small and prop-driven; move visual details out of the parent card.

3. Extract logic into hooks
   - Move overlay and interaction state into dedicated hooks rather than keeping it inline in the card component.
   - Keep engine-facing work close to src/renderer/context/AudioContext.tsx and src/renderer/audio/AudioEngine.ts.

4. Introduce shared UI patterns
   - Standardize toggle buttons, range inputs, and action buttons so the same controls can be reused across fade, delay, reverb, and future effect panels.
   - Create a small shared dialog shell for draft/apply/cancel flows.

5. Polish and document
   - Rename ambiguous state and handler names and split oversized hooks once the boundaries are clear.
   - Update docs and tests alongside the refactor so the structure remains obvious.

## Component extraction
- Create a dedicated header component for the title, drag affordance, and duplicate/close affordances.
- Extract a transport controls component for play, pause, stop, loop, fade, and seek-fade actions.
- Extract a volume control component so the slider logic is isolated from the rest of the card.
- Move settings overlays into independent components, following the pattern already used by src/renderer/components/TrackPlayer/FilterSettingsDialog.tsx.

## Hook extraction
- Introduce a playback-controls hook for play/pause/stop/seek orchestration.
- Introduce a settings-overlay hook for draft state, apply/cancel behavior, and overlay visibility.
- Keep the existing context-menu behavior in src/renderer/components/TrackPlayer/useTrackContextMenu.ts but make its responsibilities explicit and reusable.

## Reusable UI patterns
- Reuse a compact toggle-button primitive for loop, fade-in, fade-out, and seek-fade states.
- Reuse a range-control primitive with shared label/value formatting and keyboard support.
- Reuse a dialog-shell pattern for per-track effect panels so they follow the same open/close/apply/cancel behavior.

## Testing strategy
- Keep renderer tests focused on user-visible behavior rather than implementation details.
- Move overlay-specific tests out of src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx into dedicated component suites.
- Extract shared fake audio fixtures from src/__tests__/audio/AudioEngine.test.ts into a shared module such as src/__tests__/audio/fixtures/fakeAudioContext.ts once the refactor begins.

## Open questions
- Should the long-term effect UI live inside each track card or in a separate floating inspector panel?
- Do we want a generic overlay shell now, or should we extract only the highest-value dialogs first?
- How much of the current track-card state should remain in the context layer versus move into local hooks?
