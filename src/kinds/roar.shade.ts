'use typeshade';

// The kind `roar`: a blast that rolls through a hall, or a torrent of energy. It is turbulence: four
// bands of noise, each with a level that wanders by itself with no period, so the parts do not move
// together. The top bands wander most. It rises fast, swells to its full level, holds, and falls over
// the last part of its length. `brightness` sets the level of the top bands, `motion` how far the
// levels wander, `swell` how far under its full level it starts.

import { Svf } from '../units/svf.shade.ts';
import { noise, smooth } from './noise.shade.ts';

/** One band of the roar: noise through two bandpasses, at a level that wanders. */
export class RoarBand {
  svf: Svf = new Svf();
  svf2: Svf = new Svf();
  /** The frequency coefficient of the bandpasses (`svfCoef`). */
  coef: f32 = 0.1;
  gain: f32 = 1;
  /** How far the level wanders, as a natural log of the gain. */
  depth: f32 = 0;
  /** The rate of the wandering, in steps a frame. */
  rate: f32 = 0.0001;

  /** Sets the band and returns it. */
  set(coef: f32, damp: f32, gain: f32, depth: f32, rate: f32): this {
    this.coef = coef;
    this.svf.damping(damp);
    this.svf2.damping(damp);
    this.gain = gain;
    this.depth = depth;
    this.rate = rate;
    return this;
  }

  /** One sample of the band at the frame `age`, which is `a` as an `f32`, from `key`. */
  tick(key: u32, age: u32, a: f32): f32 {
    const walk = exp(this.depth * smooth(key ^ 977, a * this.rate));
    return this.svf2.step(this.svf.step(noise(key, age), this.coef), this.coef) * this.gain * walk;
  }
}

export class Roar {
  age: u32 = 0;
  key: u32 = 1;
  /** The length in frames. */
  len: f32 = 1;
  /** The frames of the rise. */
  att: f32 = 1200;
  /** The level at the start of the swell, against the full level. */
  low: f32 = 0.6;
  /** The part of the length at which the swell is full and after which the roar falls. */
  hold: f32 = 0.65;
  gain: f32 = 1;
  b0: RoarBand = new RoarBand();
  b1: RoarBand = new RoarBand();
  b2: RoarBand = new RoarBand();
  b3: RoarBand = new RoarBand();

  /** Sets the sound and returns it; the host sets the four bands. */
  shape(key: u32, len: f32, att: f32, low: f32, hold: f32, gain: f32): this {
    this.key = key;
    this.len = len;
    this.att = att;
    this.low = low;
    this.hold = hold;
    this.gain = gain;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    const u = min(a / this.len, 1);
    const y0 = this.b0.tick(this.key ^ 201, age, a);
    const y1 = this.b1.tick(this.key ^ 202, age, a);
    const y2 = this.b2.tick(this.key ^ 203, age, a);
    const y3 = this.b3.tick(this.key ^ 204, age, a);
    const swell = this.low + (1 - this.low) * min(u / this.hold, 1);
    const t = max((1 - u) / (1 - this.hold), 0);
    const tail = min(t * t, 1);
    const env = min(a / this.att, 1) * swell * tail;
    return (y0 + y1 + y2 + y3) * env * this.gain;
  }
}
