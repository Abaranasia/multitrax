# Design: Reduce Effect Dialog / Engine / Test Duplication

## Technical Approach

Six stacked, independently-revertible slices, each collapsing one duplication
point behind a single source of truth while preserving byte-for-byte runtime
behavior. Every slice keeps the existing suite (`TrackPlayer.test.tsx`,
5 per-dialog tests, `AudioContext.test.tsx`, `AudioEngine.test.ts`) green as its
parity gate. Slice boundaries are chosen so each slice's public seam is stable
for the next: the dialog **component prop API** is frozen at slice 3 so slice 4
can swap hooks underneath without re-touching JSX; the **setter call shape** is
frozen until slice 6, which changes it everywhere at once.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Slice 4 hook | Generic core `useSettingsDialog<TDraft>` + 5 thin named wrappers that preserve today's flat `draftX/setDraftX` return shape | Inline hooks into `TrackPlayer` / return a `{draft,setDraft}` object | Preserving the wrapper return shape means slice-3 components and `TrackPlayer` prop-passing do NOT change again in slice 4 → smallest diff, parity-safe |
| Slice 3 seam | `<EffectDialog>` owns chrome (overlay/panel/title/actions); `<SettingsField>` is a discriminated `slider \| select` row; the 5 dialogs keep their existing flat props | `fields[]` descriptor array assembled in `TrackPlayer` | Keeps per-effect field specifics (min/max/step/suffix) local; the `kind` discriminator absorbs Filter/Reverb `<select>` with zero per-effect conditionals |
| Slice 6 SoT | Named per-effect settings interfaces in a new `src/renderer/audio/effectSettings.ts`; setters take `(id, s: XSettings)` | Shared positional function-type alias imported by 3 sites | Only a named object closes the reorder type-safety gap the exploration flagged; positional aliases dedup text but leave same-typed `number` args reorderable. Folds `outputLevel`/`output` drift into one canonical field `output` |
| Slice 2 mechanism | Shared `effect-dialog.css` holds all structural rules once via grouped selectors keyed on the 5 existing class prefixes; per-effect files shrink to `--effect-accent` + apply-button vars | Rename classes in slice 2 | Keeps slice 2 CSS-only (zero `.tsx` churn, matches affected-areas table). Slice 3 later supersedes grouped selectors with one shared class emitted by `<EffectDialog>` |

## Interfaces / Contracts

```ts
// Slice 4 — generic core (seed thunk re-reads live state on each open(), matching current re-sync)
function useSettingsDialog<TDraft extends object>(
  seed: () => TDraft,
  onApply: (draft: TDraft) => void,
): {
  isOpen: boolean;
  draft: TDraft;
  setField: <K extends keyof TDraft>(key: K, value: TDraft[K]) => void;
  open: () => void;   // setDraft(seed()); setIsOpen(true)
  close: () => void;  // setIsOpen(false)
  apply: () => void;  // onApply(draft); setIsOpen(false)
};
// Wrapper example: seed maps state.filterCutoff→cutoff; onApply calls the setter; wrapper
// re-exposes {draftCutoff, setDraftCutoff:(v)=>setField('cutoff',v), ...} → unchanged public API.

// Slice 3
interface EffectDialogProps { effect: string; title: string; onApply(): void; onCancel(): void; children: ReactNode; }
type SettingsField =
  | { kind:'slider'; label:string; min:number; max:number; step:number; value:number; onChange:(v:number)=>void; format:(v:number)=>string; mix?:boolean }
  | { kind:'select'; label:string; value:string; onChange:(v:string)=>void; options:{value:string;label:string}[] };

// Slice 5 — module-level pure helper (replaces 24 inline Math.max/min); factory covers only the shared triple
const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v));
private _createDryWetOutput(): { dryGain: GainNode; wetGain: GainNode; outputGain: GainNode };
// creates 3 gains, dry→out & wet→out, sets dry=1/wet=0/out=1. Each builder makes its own middle
// nodes and does `<lastMiddle>.connect(wetGain)`. Factory takes NO params → builder-specific
// fields/params (reverb convolver, filter biquad) never touch it.

// Slice 6
interface FilterSettings { type:FilterType; cutoff:number; resonance:number; mix:number; output:number }
interface DelaySettings { delayTime:number; feedback:number; mix:number; damping:number; output:number }
interface ReverbSettings { room:ReverbRoom; mix:number; preDelay:number; damping:number; output:number }
interface DistortionSettings { drive:number; tone:number; mix:number; output:number }
// setXSettings(id: string, s: XSettings): void — one shape imported by AudioEngine.ts,
// audioContextInstance.ts, AudioContext.tsx (useCallback + duplicateTrack), 5 wrapper apply()s, tests.
```

## File Changes

| File | Action | Slice |
|------|--------|-------|
| `src/__tests__/test-utils/mockAudioEngine.ts` (`createMockAudioEngine()` factory → fresh `vi.fn()` stubs) | Create | 1 |
| 8 `*.test.tsx/ts` files (import factory into their hoist-safe `const`) | Modify | 1 |
| `.../effects/**/effect-dialog.css` (shared structural rules) | Create | 2 |
| 5 `*SettingsDialog.css` (shrink to accent vars) | Modify | 2 |
| `.../components/EffectDialog.tsx` + `SettingsField.tsx` | Create | 3 |
| 5 `*SettingsDialog.tsx` (render via shared components, same props) + `components/index.ts` | Modify | 3 |
| `.../components/useSettingsDialog.ts` (generic core) | Create | 4 |
| 5 `use*SettingsDialog.ts` (thin wrappers) + `TrackPlayer.tsx:111-115` + `components/index.ts` | Modify | 4 |
| `src/renderer/audio/AudioEngine.ts` (`clamp`, `_createDryWetOutput`) | Modify | 5 |
| `src/renderer/audio/effectSettings.ts` | Create | 6 |
| `AudioEngine.ts`, `audioContextInstance.ts`, `AudioContext.tsx` (2 sites), 5 wrappers, `AudioEngine.test.ts` | Modify | 6 |

## Data Flow

```
seed()  ──►  useSettingsDialog (draft, setField)  ──►  <EffectDialog>/<SettingsField>
  ▲                                    │ apply()
  │ live state                         ▼
TrackState ◄── AudioContext setter ◄── onApply(draft) ──► engine.setXSettings(id, XSettings)
```

## Testing Strategy

| Slice | Parity verification |
|-------|--------------------|
| 1 | All 8 suites green; factory yields identical stub surface; no cross-test bleed (fresh instance per file) |
| 2 | Visual/DOM class output unchanged; existing dialog tests assert same classNames |
| 3 | Per-dialog tests assert unchanged rendered rows/labels/values + `<select>` options; `TrackPlayer.test.tsx` open/apply/cancel flows |
| 4 | `TrackPlayer.test.tsx` (sole hook gate — no isolated hook tests, per `openspec/config.yaml`) covers open re-sync, edit, apply, cancel for all 5 |
| 5 | `AudioEngine.test.ts` unchanged assertions on clamped values + node wiring |
| 6 | `AudioEngine.test.ts` updated to object-arg calls; `AudioContext.test.tsx` + `TrackPlayer.test.tsx` confirm state + engine parity |

No slice requires duplicating a test assertion during transition; each seam is swapped atomically within its slice.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Stacked PRs in order 1→6; each targets the previous slice's branch (or the tracker branch). No data migration. Revert any single slice's PR independently. Slice N assumes N-1 landed only for the frozen seams noted above (slice 4 depends on slice 3's frozen component props; slice 6 rewrites the setter shape all wrappers reach). Slice 2 also lightly reshapes CSS that slice 3 supersedes — expected, not rework waste.

## Open Questions

- [ ] Slice 6 object-arg conversion is the highest-churn/risk slice; confirm it stays under the 400-line budget in `sdd-tasks` or split engine vs. context/consumers.
