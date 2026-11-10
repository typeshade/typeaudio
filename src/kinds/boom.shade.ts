'use typeshade';

// The kind `boom`: the body of a heavy hit. A band of noise around its pitch and two damped modes in
// it that sink a little, under a fast rise and a long decay. The weight of a hit is a body near
// 100 hertz that lasts; it is not a burst in the lowest octave. `size` sets the pitch, `decay` the
// length, `tone` the share of the modes against the noise.

import { Sine } from '../units/oscillator.shade.ts';
import { Svf } from '../units/svf.shade.ts';
import { noise } from './noise.shade.ts';

export class Boom {
  age: u32 = 0;
  key: u32 = 1;
  svf: Svf = new Svf();
  svf2: Svf = new Svf();
  /** The first mode, at the pitch, and the second, at 0.72 of it. */
  m0: Sine = new Sine();
  m1: Sine = new Sine();
  /** The frequency coefficient of the noise's bandpasses (`svfCoef`). */
  coef: f32 = 0.01;
  /** The phase step of the first mode at the start, in cycles a frame. */
  base: f32 = 0.002;
  /** How far the modes sink, as a fraction of their pitch, and the rate of the sinking, per frame. */
  glide: f32 = 0.08;
  glideRate: f32 = 0.0001;
  /** The decay rate, per frame. */
  decay: f32 = 0.0001;
  /** The frames of the rise. */
  rise: f32 = 288;
  aNoise: f32 = 1;
  aTone: f32 = 0.3;

  /** Sets the sound and returns it. */
  shape(
    key: u32,
    coef: f32,
    damp: f32,
    base: f32,
    glide: f32,
    glideRate: f32,
    decay: f32,
    rise: f32,
    aNoise: f32,
    aTone: f32,
  ): this {
    this.key = key;
    this.coef = coef;
    this.svf.damping(damp);
    this.svf2.damping(damp);
    this.base = base;
    this.glide = glide;
    this.glideRate = glideRate;
    this.decay = decay;
    this.rise = rise;
    this.aNoise = aNoise;
    this.aTone = aTone;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    const band = this.svf2.step(this.svf.step(noise(this.key, age), this.coef), this.coef);
    const g = 1 - this.glide * (1 - exp(-a * this.glideRate));
    this.m0.inc = this.base * g;
    this.m1.inc = this.base * 0.72 * g;
    const tone = this.m0.tick() + 0.7 * this.m1.tick();
    const r = min(a / this.rise, 1);
    const env = exp(-a * this.decay) * (r * r * (3 - 2 * r));
    return (band * this.aNoise + tone * this.aTone) * env;
  }
}
