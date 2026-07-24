# Verification Report — distortion-effect (PR 1 of 3, Engine layer only)

**Scope**: Phase 1 (Engine) only. Phase 2 (State/Context) and Phase 3 (UI) are intentionally not implemented and out of scope for this pass.

## Completeness (tasks.md Phase 1)
All 8/8 Phase 1 tasks (1.1-1.8) verified complete and matching actual code in `src/renderer/audio/AudioEngine.ts` / `src/__tests__/audio/AudioEngine.test.ts`. Phase 2 (2.1-2.4) and Phase 3 (3.1-3.6) correctly unchecked and untouched — grep confirms zero "distortion" occurrences outside `AudioEngine.ts` under `src/renderer`.

## Test/build evidence (run live for this verification pass)
- `pnpm test:no-watch` -> 13 files, **75/75 tests passed** (exit 0).
- `pnpm exec tsc --noEmit` -> clean (exit 0).
- `pnpm exec eslint src/renderer/audio/AudioEngine.ts src/__tests__/audio/AudioEngine.test.ts` -> clean (exit 0).

## Spec compliance matrix (AudioEngine-scope requirements only)

| Requirement/Scenario | Status | Evidence |
|---|---|---|
| Chain order gainNode -> filter -> distortion -> delay -> reverb -> pannerNode -> masterGain | PASS | AudioEngine.ts:189-198; wiring test at test line 299 passes |
| filter.outputGain -> distortion.dryGain/waveShaper; distortion.outputGain -> delay.dryGain/delayNode | PASS | Lines 189-193, covered by dedicated wiring test |
| Pre-existing Filter/Delay double-sum bug (gainNode -> delay directly, bypassing filter/distortion) | PASS (left untouched) | Lines 182-187 preserve the exact pre-existing structure per design's explicit "KEEP untouched" instruction — not fixed, not worsened |
| setDistortionSettings updates existing nodes without recreate/reconnect | PASS | Test at line 312 asserts same object reference reused after update |
| Mix=0 dry-only / Mix=100 fully-wet | PASS (by code inspection); WARNING (not numerically asserted) | dryGain/wetGain gain math (lines 547-549) is correct and mirrors the same untested-by-assertion pattern already accepted for Filter/Delay/Reverb — consistent precedent, not a new regression |
| removeTrack disconnects all 5 distortion nodes | PASS | Lines 235-239 disconnect dryGain/waveShaper/toneFilter/wetGain/outputGain; test spies on outputGain.disconnect (line 352) |
| **Drive=0 is near-identity pass-through** | **CRITICAL - FAIL** | See finding below |

## CRITICAL Finding: drive=0 is NOT near-identity — it is a fixed ~1/3 (-9.5 dB) gain scaling

`_makeDistortionCurve(drive)` (AudioEngine.ts:762-772) implements
`curve[i] = ((3+k)*x*20*deg) / (pi + k*|x|)` with `deg = pi/180`. At `drive=0` -> `k=0`,
this reduces algebraically to `curve(x) = x/3` for all x — **not** `curve(x) ~= x`.

This is exactly the formula design.md specifies verbatim (design.md lines 57-63) — the
implementation faithfully matches the design. But the design's chosen formula does not
satisfy the OpenSpec scenario "Drive at 0 is near-transparent"
(specs/track-distortion/spec.md lines 115-120: "the shaped signal is a near-identity
pass-through of the input"). A linear-but-1/3-scaled signal is audibly quieter, not
near-identity.

The covering test (AudioEngine.test.ts:328-350, "_makeDistortionCurve is linear at
drive=0...") only asserts the *ratio* curve(x)/x stays constant across sampled x values
(linearity / no compression) — it never asserts the ratio is close to 1. The test
therefore passes while the actual scenario ("near-identity") is violated: at mix>0 and
drive=0, the wet path contributes a signal at 1/3 the dry amplitude — an audible level
drop, not transparency.

Root cause: this is the classic "makeDistortionCurve" formula from the well-known
WebAudio demo (Chris Wilson / HTML5Rocks), which has this documented quirk (amount=0 is
linear but not unity-gain). It was carried faithfully from design.md into code — this is
a design-vs-spec gap that slipped through spec review, not an apply-phase deviation from
design.

Impact: blocks a clean PASS for Phase 1 — the spec's explicit drive=0 scenario is not
actually satisfied, and no existing test catches it because the test's assertion is
weaker than the literal requirement.

## Design coherence
No deviations found versus design.md's exact rewiring plan, interfaces, or curve
formula — implementation is a faithful match of the documented plan (including
preservation of the double-sum bug). The one CRITICAL issue above is a design-vs-spec
gap, not an apply-vs-design gap.

## Issues
- **CRITICAL**: drive=0 produces curve(x)=x/3 (not near-identity); spec scenario "Drive
  at 0 is near-transparent" is not satisfied; existing test doesn't cover the actual
  near-identity requirement.
- **WARNING**: Mix=0/Mix=100 dry/wet gain values are not numerically asserted in engine
  tests (only "no throw" + field values checked) — consistent with existing
  Filter/Delay/Reverb precedent, not a new regression, but a pre-existing coverage gap.
- **SUGGESTION**: Consider documenting the known 1/3-gain quirk of this curve formula,
  or rescaling the curve (e.g., normalize so drive=0 yields curve(x)=x exactly) so
  drive=0 becomes truly unity-gain before Phase 2/3 build UI expectations on top of it.

## Verdict: **FAIL** (Phase 1 scope)
One CRITICAL spec/design mismatch (drive=0 near-identity) blocks a clean pass; wiring,
cleanup, task completion, and test/build health are all verified PASS.

## Post-fix note (apply-phase remediation, same PR 1 scope)

The CRITICAL finding above was fixed in a follow-up apply pass:

- `_makeDistortionCurve`'s numerator coefficient was changed from `20*deg` to `60*deg`
  (`AudioEngine.ts`), normalizing `k=0` to exactly `curve(x) = x` (identity), since
  `3 * 60*deg / pi === 1`. This is a uniform scalar change — the saturation *shape* at
  every other drive level is fully preserved, only the previously-wrong 1/3 attenuation
  at drive=0 is corrected.
- RED test added first (`AudioEngine.test.ts`): asserts `ratioLow0`/`ratioHigh0` (curve/x
  at drive=0) fall within `0.98`–`1.02` — failed against the old formula
  (`0.3333333507180214`, confirming the exact defect described above) before the fix.
- A second new test asserts sign preservation and a sane absolute-amplitude bound
  (`< 2`) across a `drive ∈ {0,25,50,75,100}` × `x ∈ {0.1,...,0.9}` sweep, so the fix
  doesn't introduce runaway gain at other drive levels.
- Full suite re-run: `pnpm test:no-watch` → 76/76 passed (was 75/75; +1 new test).
  `pnpm exec tsc --noEmit` and `pnpm exec eslint` on both files → clean.
- `design.md`'s curve helper snippet and surrounding prose were updated to `60*deg` with
  an explanatory note. `specs/track-distortion/spec.md`'s "Drive at 0 is near-transparent"
  scenario required no change — it was already correct; only design.md's chosen formula
  was wrong.

This remediation stays within PR 1 (Engine) scope — no Phase 2/3 files were touched.

## Re-verification pass (independent, post-fix)

An independent sdd-verify re-check was run specifically to confirm the CRITICAL finding
above was genuinely fixed (not just reported as fixed). Findings:

- **Algebraic confirmation**: read the live `_makeDistortionCurve` (AudioEngine.ts:770-780).
  Formula is now `curve[i] = ((3+k)*x*60*deg)/(pi + k*|x|)`, `deg = pi/180`. At `k=0`
  (drive=0): `curve(x) = 3*x*60*deg/pi = 180*deg*x/pi = x` exactly (since `180*deg === pi`).
  Confirmed `curve(x) = x` at drive=0 for arbitrary x, not merely "close to 1" — exact
  identity. This matches spec.md's near-identity requirement with margin to spare.
- **Scalar-only change confirmed**: the `20*deg -> 60*deg` edit is a constant multiplier
  applied uniformly to the numerator, independent of both `k` and `x`. Manually recomputed
  ratios at drive=100 (k=100): ratio(x=0.2) ~= 4.66, ratio(x=0.9) ~= 1.16 -- confirms the
  curve is still compressive (ratio drops as |x| grows) and behaves the same relative to
  the pre-fix formula, only rescaled. Amplitude stayed bounded (`< 1.05` observed across the
  full drive x sampled-x sweep), consistent with the new sane-range test's `< 2` bound.
- **Tests re-read (not just counted)**: both new tests in `AudioEngine.test.ts` (lines
  328-359 and 361-376) call the real private method `_makeDistortionCurve` via
  `(engine as any)`, assert numeric ratios (`toBeGreaterThan(0.98)` /
  `toBeLessThan(1.02)`) at drive=0, assert `ratioHigh0/ratioLow0` closeness for linearity,
  assert `ratioHigh100 < ratioLow100` for compression, and sweep sign/amplitude across
  `drive in {0,25,50,75,100}` x `x in {0.1..0.9}`. These are real behavioral assertions
  against production code, not smoke tests or tautologies.
- **Live re-run** (this pass, not trusted from apply-progress):
  - `pnpm test:no-watch` -> 13 files, **76/76 tests passed** (exit 0).
  - `pnpm exec tsc --noEmit` -> clean (exit 0).
  - `pnpm exec eslint src/renderer/audio/AudioEngine.ts src/__tests__/audio/AudioEngine.test.ts` -> clean (exit 0).
- **Spot checks of previously-passing items** (not a full re-audit, since already verified
  once): chain wiring order intact (`AudioEngine.ts:181-198`, `filter.outputGain ->
  distortion.dryGain/waveShaper`, `distortion.outputGain -> delay.dryGain/delayNode`
  unchanged); `removeTrack` still disconnects all 5 distortion nodes (`AudioEngine.ts:235-239`);
  pre-existing Filter/Delay double-sum bug (`gainNode` connecting directly to
  `delay.dryGain`/`delay.delayNode` at lines 182-183) is still present and untouched, as
  intentionally out of scope.

### Updated Verdict: **PASS** (Phase 1 / PR 1 scope)

The previously-blocking CRITICAL issue (drive=0 not near-identity) is confirmed fixed by
independent algebraic and test-level verification, not just by trusting the apply report.
No new issues found. The one pre-existing WARNING (Mix=0/100 dry/wet gain values not
numerically asserted) and one SUGGESTION (documenting the curve formula quirk) from the
first pass still stand as non-blocking, consistent with prior precedent for Filter/Delay/Reverb.
Phase 2 and Phase 3 remain unimplemented and out of scope for this PR, as expected.
