"use typeshade";

// The amplitude envelope. It has no branch: the rise and the fall are each a one-pole step, and the
// level is their product, so every lane of a bank runs the same instructions whatever its stage.

/**
 * An attack-decay amplitude envelope: a rise from 0 toward 1, times a fall from 1 toward the
 * sustain level, each moving a fixed fraction of its way every sample. Neither part reaches a
 * subnormal: the rise settles at 1 and the fall at the sustain level.
 */
export class Envelope {
  /** The rising part, from 0 toward 1. */
  rise: f32 = 0.;
  /** The falling part, from 1 toward `sustain`. */
  fall: f32 = 1.;
  /** The fraction of its way the rise moves each sample, in (0, 1]. */
  attack: f32 = 1.;
  /** The fraction of its way the fall moves each sample, in (0, 1]. */
  decay: f32 = 1.;
  /** The level the fall settles at, linear. */
  sustain: f32 = 1.;

  /**
   * Sets the time constants at the sample rate `sr`: the rise covers 63 % of its way in `attack`
   * seconds and the fall in `decay` seconds, toward the level `sustain`. Returns the envelope.
   */
  times(attack: f32, decay: f32, sustain: f32, sr: f32): this {
    this.attack = 1. - exp(-1. / (attack * sr));
    this.decay = 1. - exp(-1. / (decay * sr));
    this.sustain = sustain;
    return this;
  }

  /** One sample: the level, the rise times the fall, then both move on by one step. */
  tick(): f32 {
    const y = this.rise * this.fall;
    this.rise = this.rise + this.attack * (1. - this.rise);
    this.fall = this.fall + this.decay * (this.sustain - this.fall);
    return y;
  }
}
