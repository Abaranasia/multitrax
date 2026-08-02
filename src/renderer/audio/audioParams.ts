/** Clamps `v` into the inclusive `[min, max]` range. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

// setTargetAtTime smoothing time-constant (seconds) shared by every
// gain/parameter ramp in this file.
export const PARAM_RAMP_TIME_CONSTANT_S = 0.01;
