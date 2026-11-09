'use typeshade';

// A state-variable filter (Chamberlin). It stays stable while its cutoff moves every sample, which
// the sweeps of the kinds need, and it gives the lowpass and the bandpass of one input at once.

/** Half a turn, in radians. */
const PI: f32 = 3.141592653589793;

/**
 * The frequency coefficient of `Svf.step` for the cutoff `fc` hertz at the sample rate `sr`:
 * `2 sin(pi fc / sr)`, held to 1.2, above which the filter is not stable.
 */
export function svfCoef(fc: f32, sr: f32): f32 {
  return min(2 * sin((PI * fc) / sr), 1.2);
}

/** A state-variable filter: `low` and `band` are the lowpass and the bandpass of the last input. */
export class Svf {
  /** The lowpass output. */
  low: f32 = 0;
  /** The bandpass output. */
  band: f32 = 0;
  /** The damping, one over the quality: a small value rings. */
  damp: f32 = 1;

  /** Sets the damping and returns the filter. */
  damping(damp: f32): this {
    this.damp = damp;
    return this;
  }

  /** One sample at the coefficient `f` (`svfCoef`): the bandpass output; `low` holds the lowpass. */
  step(x: f32, f: f32): f32 {
    this.low = this.low + f * this.band;
    const high = x - this.low - this.damp * this.band;
    this.band = this.band + f * high;
    return this.band;
  }
}
