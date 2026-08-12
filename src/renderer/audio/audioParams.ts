/**
 * Clamps `v` into the inclusive `[min, max]` range. `±Infinity` are already
 * clamped correctly by Math.max/min; NaN is not (it propagates through both),
 * so it's special-cased here to fall back to `min` rather than reaching a Web
 * Audio call and throwing a TypeError.
 */
export const clamp = (v: number, min: number, max: number): number =>
  Number.isNaN(v) ? min : Math.max(min, Math.min(max, v));

// setTargetAtTime smoothing time-constant (seconds) shared by every
// gain/parameter ramp in this file.
export const PARAM_RAMP_TIME_CONSTANT_S = 0.01;
