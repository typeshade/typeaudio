// The filters' coefficients of a block, designed on the host in JavaScript doubles: the workaround
// of ask D (docs/compiler-asks.md), which the `host` variant writes to the device each block. The
// cutoff and the angle are the `f32` values the device computes (`PartialBase.swept`, `Biquad.set`),
// and the rest is in doubles, rounded to `f32` once per coefficient: the formulas of `Lowpass`. The
// reference designs the `f64` variant's coefficients with the same function. It imports no shader
// module.

import { SR, type PartialSpec } from './options.ts';

const f = Math.fround;
const TAU = f(6.283185307179586);

/** The cutoff of a partial at `sweep`, below 0.45 of the sample rate, in `f32` as the device computes it. */
export const sweptCutoff = (cutoff: number, sweep: number, sr: number = SR): number =>
  f(Math.min(f(f(cutoff) * f(sweep)), f(f(0.45) * f(sr))));

/**
 * The five coefficients `b0, b1, b2, a1, a2` of a lowpass at the cutoff `cutoff` (an `f32`) and the
 * quality `q`: the angle in `f32`, then the design in doubles.
 */
export function design64(cutoff: number, q: number, sr: number = SR): [number, number, number, number, number] {
  const w = f(f(TAU * f(cutoff)) / f(sr));
  const cw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * f(q));
  const a0 = 1 + alpha;
  const b1 = (1 - cw) / a0;
  return [f(b1 * 0.5), f(b1), f(b1 * 0.5), f((-2 * cw) / a0), f((1 - alpha) / a0)];
}

/** Writes the coefficients of every partial at `sweep` into `into`, five per partial, in lane order. */
export function hostCoefficients(specs: readonly PartialSpec[], sweep: number, into: Float32Array): Float32Array {
  specs.forEach((s, v) => {
    into.set(design64(sweptCutoff(s.cutoff, sweep), s.q), v * 5);
  });
  return into;
}
