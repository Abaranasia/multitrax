# Exploration: extract-track-overlays

> Persisted by the orchestrator. Engram was unavailable this session (no `mem_save`
> connected), so `hybrid` degraded to OpenSpec-only persistence for this artifact.

## Change

Extract per-track overlays/dialogs into independent components (fade-duration,
delay, reverb) following the already-established `FilterSettingsDialog` /
`useFilterSettingsDialog` template. Source: `doc/TODO.md` "Coding improvements"
(lines 212-223); satisfies the "Dialogs and overlays" convention in
`doc/ARCHITECTURE.md`.

## Current State

Two of the four per-track effect dialogs are **already extracted** and serve as a
proven template; the three named in the TODO remain inline.

**Already extracted (the template):**
- `src/renderer/components/TrackPlayer/FilterSettingsDialog.tsx` + `useFilterSettingsDialog.ts`
- `src/renderer/components/TrackPlayer/DistortionSettingsDialog.tsx` + `useDistortionSettingsDialog.ts`

**Template pattern:**
- **Hook** (`useFilterSettingsDialog.ts`): takes `state: TrackState`, calls
  `useAudio()` to pull exactly one setter. Owns `isOpen` plus one `useState` per
  draft field, seeded from `state.*` on `open()`. Exposes
  `{ isOpen, open, close, apply, draftX, setDraftX, ... }`. `apply()` calls the
  setter with `(state.id, ...drafts)` then closes. All callbacks `useCallback`-wrapped.
- **Component** (`FilterSettingsDialog.tsx`): pure presentational; receives only
  `draftX`/`setDraftX` pairs + `onApply`/`onCancel` (no `state`, no `useAudio`).
  Renders `.xxx-settings-overlay` (backdrop `onClick={onCancel}`, `onMouseDown`
  stops propagation) wrapping `.xxx-settings-panel`, with one
  `.xxx-settings-field` per control and an `.xxx-settings-actions` footer
  (Apply/Cancel). Imports its own `.css`.
- **Wiring in `TrackPlayer.tsx`**: `const filterDialog = useFilterSettingsDialog(state);`
  then `{filterDialog.isOpen && <FilterSettingsDialog {...} />}`. The card's
  top-level className also folds in `track-player--filter-open`.
- **AudioContext → AudioEngine**: `useAudio()` exposes one setter per effect
  (`setFilterSettings`, `setDelaySettings`, `setReverbSettings`,
  `setFadeDurations`, `setDistortionSettings`); each calls
  `engine.setXSettings(id, ...)` then updates the `tracks` array immutably by id.
- **Testing**: `src/__tests__/components/TrackPlayer/FilterSettingsDialog.test.tsx`
  tests the component in isolation with mocked prop callbacks (`vi.fn()`), no
  `AudioProvider` — draft render, setters fire on input change, Apply/Cancel fire,
  backdrop-vs-panel click behavior.

## Affected Areas

- `src/renderer/components/TrackPlayer/useTrackPlayer.ts` — the three inline blocks:
  - **Fade** (~lines 54-69): `settingsOpen`, `draftFadeIn/Out/SeekFade`,
    `openSettings`, `applySettings` → `setFadeDurations(state.id, ...)`.
  - **Delay** (~lines 71-106): `delaySettingsOpen`, 5 draft fields,
    `openDelaySettings`, `applyDelaySettings` → `setDelaySettings(state.id, ...)`.
  - **Reverb** (~lines 108-149): `reverbSettingsOpen`, 5 draft fields,
    `openReverbSettings`, `applyReverbSettings` → `setReverbSettings(state.id, ...)`.
  - All three surface through the large hook return object (~lines 189-248).
- `src/renderer/components/TrackPlayer/TrackPlayer.tsx`:
  - Line ~147: card className reads `reverbSettingsOpen` / `delaySettingsOpen`
    directly (`track-player--reverb-open`, `track-player--delay-open`) → must
    become `reverbDialog.isOpen` / `delayDialog.isOpen`.
  - ~352-411: inline fade-settings-overlay markup.
  - ~413-500: inline delay-settings-overlay markup.
  - ~502-593: inline reverb-settings-overlay markup.
  - ~596-627: already-extracted Filter/Distortion renders (target shape).
- `src/renderer/context/AudioContext.tsx` — `setFadeDurations`, `setDelaySettings`,
  `setReverbSettings` already exist and are the exact setters the new hooks
  consume. **No changes needed here.**
- `src/renderer/domain/TrackState.ts` — field/type definitions consumed by the new
  hooks. No changes expected.
- `src/__tests__/components/TrackPlayer/TrackPlayer.test.tsx` — see Test Surface.
- `doc/TODO.md` lines 212-223 — check off once done.
- `doc/ARCHITECTURE.md` lines 219-238 — the standing convention this satisfies.

## Test Surface (`TrackPlayer.test.tsx`)

Tests to relocate for the three in-scope overlays:
- **Fade**: `'opens settings, updates draft values and applies them to engine'`
  (~214-241) — only one test; **no fade cancel test exists today** (parity gap).
- **Delay**: apply test (~318-346) and cancel test (~348-365).
- **Reverb**: apply test (~367-403), cancel test (~405-422), and
  `'shows the reverb button as active only when reverbMix is above 0'` (~424-440).

Relocation target: mirror `FilterSettingsDialog.test.tsx` (pure component tests,
mocked prop callbacks, no `AudioProvider`). Engine-integration assertions can move
into new `useXSettingsDialog` tests or stay at the `TrackPlayer.test.tsx`
integration level (matching how Filter/Distortion currently behave).

**Existing gap found:** Filter and Distortion were extracted, but their
open/apply/cancel/active tests were **not removed** from `TrackPlayer.test.tsx`
(~lines 243-316 filter, 442-514 distortion) — they still duplicate the dedicated
suites. The "relocate tests" step was not fully done for the prior two
extractions. **Scope decision needed** for `sdd-propose`: (a) treat as prior debt,
out of scope, or (b) also clean up the leftover duplicates here.

`mockAudioEngine` (~lines 6-33) already stubs `setFadeDurations`,
`setDelaySettings`, `setReverbSettings` — no engine-mock changes needed.

## Architecture convention (`doc/ARCHITECTURE.md` 219-238)

Every dialog or overlay must be its own component — own file, own markup, own
state/logic hook — not inline in the track card, and must ship with its own test
suite. The proposed extraction is the literal continuation of what Filter and
Distortion already did, and directly satisfies the rule.

## Recommended Approach

**Mechanical extraction following the Filter/Distortion template exactly.**
Create `FadeSettingsDialog`/`useFadeSettingsDialog`,
`DelaySettingsDialog`/`useDelaySettingsDialog`,
`ReverbSettingsDialog`/`useReverbSettingsDialog`, replicating the exact template
(props contract, draft/Apply/Cancel flow, `useAudio()` single-setter wiring, own
`.css`, own test file). Relocate the identified fade/delay/reverb tests into new
dedicated suites. `AudioContext`/`AudioEngine` need zero changes.

The three overlays are **independent** (disjoint fields, setters, CSS classes),
so they are cleanly sliceable into separate PRs if the combined diff risks
exceeding the 400-line review budget — forecast this in `sdd-tasks`.

Rejected: a single shared generic `SettingsDialog` shell — contradicts the
literal instruction to replicate the per-dialog template and has a larger blast
radius; not requested.

## Risks / Open Decisions

1. **Fade cancel-test parity** — no existing "discard fade draft" test to
   relocate; the new suite should probably add one to match the pattern.
2. **CSS state class update** — `track-player--reverb-open` / `--delay-open` read
   local booleans in the card className (line ~147, far from the overlay JSX);
   easy to miss when switching to `dialog.isOpen`.
3. **No `track-player--fade-open` class today** — decide whether to add one for
   consistency or leave fade as the exception.
4. **Prior Filter/Distortion test duplication** — needs an explicit scope decision
   (clean up here vs. leave as future work).
5. **Engram unavailable this session** — persistence is OpenSpec-only.
6. **Strict TDD active** (`pnpm test:no-watch`) — since the tests already exist
   inline, the RED step for this refactor is "move the test first, watch it fail
   against the not-yet-created component/hook."

## Next Recommended

`sdd-propose` — flag the Filter/Distortion test-duplication scope question to the
user first.
