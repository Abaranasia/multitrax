# Design: Extract Track Overlays (Fade / Delay / Reverb)

## Technical Approach

Mechanical per-dialog extraction replicating the proven `FilterSettingsDialog` /
`useFilterSettingsDialog` template. Each overlay becomes: presentational `.tsx`
(draft/setter pairs + `onApply`/`onCancel`, own `.css`), a state hook `.ts`
(owns `isOpen` + drafts, pulls one `useAudio()` setter), and a dedicated test
suite. `TrackPlayer.tsx` renders `{dialog.isOpen && <XSettingsDialog .../>}`;
`useTrackPlayer.ts` sheds the three inline blocks. Effects chain
(gainNode → filter → delay → reverb → pan → masterGain) and `AudioContext`/
`AudioEngine` are untouched — hooks consume existing setters unchanged.

## Architecture Decisions

| Decision | Alternative rejected | Rationale |
|---|---|---|
| Replicate per-dialog template | Shared generic `SettingsDialog` shell | Convention + TODO mandate per-dialog; larger blast radius, not requested |
| Hook pulls one `useAudio()` setter, seeds drafts on `open()` | Lift state to `useTrackPlayer` | Matches Filter/Distortion; shrinks the god-hook |
| Add `track-player--fade-open` + fade cancel test | Leave fade as exception | Parity across all five dialogs |
| Clean leftover Filter/Distortion duplicate tests now | Defer as debt | End state: every dialog test in one dedicated suite |

## Module Shape (contracts)

Hook return / component props per overlay (all fields `number` except `draftReverbRoom: ReverbRoom`):

- **`useFadeSettingsDialog(state)`** → `{ isOpen, open, close, apply, draftFadeIn, setDraftFadeIn, draftFadeOut, setDraftFadeOut, draftSeekFade, setDraftSeekFade }`; `apply()` → `setFadeDurations(state.id, draftFadeIn, draftFadeOut, draftSeekFade)` then close.
- **`useDelaySettingsDialog(state)`** → drafts `Time, Feedback, Mix, Damping, Output`; `apply()` → `setDelaySettings(state.id, time, feedback, mix, damping, output)`.
- **`useReverbSettingsDialog(state)`** → drafts `Room, Mix, PreDelay, Damping, Output`; `apply()` → `setReverbSettings(state.id, room, mix, preDelay, damping, output)`.

Each component prop interface = the draft/setter pairs above + `onApply: () => void` + `onCancel: () => void`. All callbacks `useCallback`-wrapped; `open()` re-seeds drafts from `state.*` (discard-on-cancel = close without apply).

## File Changes

| File | Action |
|---|---|
| `TrackPlayer/{Fade,Delay,Reverb}SettingsDialog.tsx` + `.css` | Create |
| `TrackPlayer/use{Fade,Delay,Reverb}SettingsDialog.ts` | Create |
| `__tests__/components/TrackPlayer/{Fade,Delay,Reverb}SettingsDialog.test.tsx` | Create |
| `TrackPlayer/TrackPlayer.tsx` | Modify — replace 3 inline overlays; className `dialog.isOpen`; add `--fade-open` |
| `TrackPlayer/useTrackPlayer.ts` | Modify — remove lines ~54-149 + their ~40 return keys |
| `__tests__/.../TrackPlayer.test.tsx` | Modify — relocate + de-dup all five suites |
| `doc/TODO.md` | Modify — check off 212-223 |

**`useTrackPlayer.ts` shrink**: delete the fade/delay/reverb `useState`/`open`/`apply` blocks and the `setFadeDurations/setDelaySettings/setReverbSettings` destructure; drop the ~40 fade/delay/reverb return keys (keep `setFadeIn/Out/SeekFade`, drag, progress, transport).

**`TrackPlayer.tsx` className (~147)**: `reverbSettingsOpen`/`delaySettingsOpen` → `reverbDialog.isOpen`/`delayDialog.isOpen`, add `${fadeDialog.isOpen ? ' track-player--fade-open' : ''}`.

## Data Flow — sequence

```
Apply (setter fires):
User → button.open() → hook: seed drafts, isOpen=true
     → Dialog renders → input onChange → setDraftX
     → Apply → hook.apply(): setXSettings(id, ...drafts) → AudioContext → engine → close

Cancel (setter NOT fired):
User → Apply skipped → Cancel/backdrop → onCancel → hook.close(): isOpen=false
     (drafts discarded; next open() re-seeds from state.*, no setter call)
```

## Testing Strategy (Strict TDD, `pnpm test:no-watch`)

RED-first for a refactor = **move the test first, watch it fail** against the
not-yet-created module, then extract to green.

| Layer | What | Where |
|---|---|---|
| Component | draft render, setter fires on input, Apply/Cancel fired, backdrop-vs-panel click | new `XSettingsDialog.test.tsx` (mocked `vi.fn()` props, no `AudioProvider`) |
| Integration | button opens dialog, Apply reaches engine setter, active-state class | `TrackPlayer.test.tsx` |

Cleanup: relocate Fade apply (~214) + **new** Fade cancel; Delay apply/cancel (~318-365); Reverb apply/cancel/active (~367-440). Remove leftover Filter (~243-316) and Distortion (~442-514) duplicates. `mockAudioEngine` already stubs all three setters — no mock change.

## Slicing / PR Boundaries

Three overlays are independent (disjoint fields, setters, CSS). Chain one-per-PR
(Fade → Delay → Reverb). Shared touch-points each slice edits: the
`useTrackPlayer` return object and the `TrackPlayer.tsx` className string —
keep slices conflict-minimal by editing only that overlay's key/class per PR and
rebasing children on the previous slice.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.

## Migration / Rollout

No migration. Pure refactor; each slice reverts independently via `git revert`.

## Open Questions

- None — scope decisions (fade parity, duplicate cleanup) resolved in proposal.
