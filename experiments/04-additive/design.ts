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

/** How far a bank's coefficients are from the lowpass designed in doubles, unrounded, for its cutoff. */
export interface CoefficientErrors {
  /** The block's sweep the coefficients were designed for. */
  readonly sweep: number;
  /** Per coefficient, `b0, b1, b2, a1, a2`: the largest relative error over the partials. */
  readonly maxRel: readonly number[];
  /** Per coefficient, the largest absolute error over the partials. */
  readonly maxAbs: readonly number[];
  /**
   * The largest relative distance of the cutoff the coefficients give from the partial's cutoff:
   * the angle `2 asin(sqrt(b1 / (1 + a2)))` over the angle of the design, less 1.
   */
  readonly maxCutoffError: number;
  /** The partial of the largest relative error of `b0`, its cutoff in hertz and that error. */
  readonly worst: { readonly partial: number; readonly cutoff: number; readonly rel: number };
  /** How many partials have a `b0` within 2^-20 of the design in doubles. */
  readonly closeB0: number;
  /** The largest distance from 1 of the filter's gain at 0 Hz, `(b0 + b1 + b2) / (1 + a1 + a2)` in doubles. */
  readonly maxDcError: number;
}

/**
 * Holds the coefficients of a bank's state (`refState`'s order: eleven values per partial, the five
 * coefficients from the fifth on) to the lowpass designed in doubles for each partial's cutoff at
 * `sweep`.
 */
export function coefficientErrors(state: Float32Array, specs: readonly PartialSpec[], sweep: number): CoefficientErrors {
  const maxRel = [0, 0, 0, 0, 0];
  const maxAbs = [0, 0, 0, 0, 0];
  let maxCutoffError = 0;
  let worst = { partial: -1, cutoff: 0, rel: -1 };
  let closeB0 = 0;
  let maxDcError = 0;
  specs.forEach((s, v) => {
    const cutoff = sweptCutoff(s.cutoff, sweep);
    const w = (2 * Math.PI * cutoff) / SR;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * f(s.q));
    const a0 = 1 + alpha;
    const b1 = (1 - cw) / a0;
    const ideal = [b1 / 2, b1, b1 / 2, (-2 * cw) / a0, (1 - alpha) / a0];
    const got = Array.from(state.subarray(v * 11 + 4, v * 11 + 9));
    got.forEach((x, k) => {
      const rel = Math.abs(x - ideal[k]!) / Math.abs(ideal[k]!);
      maxRel[k] = Math.max(maxRel[k]!, rel);
      maxAbs[k] = Math.max(maxAbs[k]!, Math.abs(x - ideal[k]!));
      if (k === 0) {
        if (rel > worst.rel) worst = { partial: v, cutoff, rel };
        if (rel <= 2 ** -20) closeB0++;
      }
    });
    const [g0, g1, g2, h1, h2] = got as [number, number, number, number, number];
    maxDcError = Math.max(maxDcError, Math.abs((g0 + g1 + g2) / (1 + h1 + h2) - 1));
    // b1 = (1 - cos w) / a0 and a0 = 2 / (1 + a2), so 1 - cos w = 2 b1 / (1 + a2).
    maxCutoffError = Math.max(maxCutoffError, Math.abs((2 * Math.asin(Math.sqrt(g1 / (1 + h2)))) / w - 1));
  });
  return { sweep, maxRel, maxAbs, maxCutoffError, worst, closeB0, maxDcError };
}
