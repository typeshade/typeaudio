"use typeshade";

/** A one-pole lowpass: the output moves the fraction `k` of the way to its input each sample. */
export class OnePole {
  /** The state: the last output. */
  z: f32 = 0.;
  /** The fraction of the way the output moves each sample, in [0, 1]. */
  k: f32;

  constructor(k: f32) {
    this.k = k;
  }

  /** One sample through the filter. */
  tick(x: f32): f32 {
    this.z = this.z + this.k * (x - this.z);
    return this.z;
  }
}
