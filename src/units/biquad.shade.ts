"use typeshade";

// The second-order filters. The state and the sample step, direct form II transposed, are shared,
// so they live in the abstract base; a class that extends it supplies `design`, its coefficients
// for a cutoff and a quality (the formulas of R. Bristow-Johnson's Audio EQ Cookbook).

/** One full turn, in radians. */
const TAU: f32 = 6.283185307179586;

/** A biquad filter in direct form II transposed. A class that extends it designs the coefficients. */
export abstract class Biquad {
  protected b0: f32 = 1.;
  protected b1: f32 = 0.;
  protected b2: f32 = 0.;
  protected a1: f32 = 0.;
  protected a2: f32 = 0.;
  protected z1: f32 = 0.;
  protected z2: f32 = 0.;

  /** Designs the filter for the cutoff `f` in hertz and the quality `q` at the sample rate `sr`. */
  set(f: f32, q: f32, sr: f32): this {
    this.design((TAU * f) / sr, q);
    return this;
  }

  /** One sample through the filter. */
  tick(x: f32): f32 {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  /** Sets the coefficients for the cutoff `w`, in radians per sample, and the quality `q`. */
  protected abstract design(w: f32, q: f32): void;
}

/** A second-order lowpass. */
export class Lowpass extends Biquad {
  protected design(w: f32, q: f32): void {
    const cw = cos(w);
    const alpha = sin(w) / (2. * q);
    const a0 = 1. + alpha;
    const b1 = (1. - cw) / a0;
    this.b0 = b1 * 0.5;
    this.b1 = b1;
    this.b2 = b1 * 0.5;
    this.a1 = (-2. * cw) / a0;
    this.a2 = (1. - alpha) / a0;
  }
}
