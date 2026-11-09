'use typeshade';

// The kind `riser`: a sine whose pitch rises exponentially and noise through a lowpass whose cutoff
// rises too, both under a quadratic swell. The swell rises over `len` frames and then holds at its
// peak until the event ends. `length` sets the fraction of the duration the rise occupies, `pitch`
// the end pitch.

import { Sine } from '../units/oscillator.shade.ts';
import { Svf, svfCoef } from '../units/svf.shade.ts';
import { noise } from './noise.shade.ts';

export class Riser {
  age: u32 = 0;
  key: u32 = 1;
  sr: f32 = 48000;
  /** The frames of the rise: the swell holds at its peak after them. */
  len: f32 = 1;
  sine: Sine = new Sine();
  svf: Svf = new Svf();
  /** The sine's phase step at the start, in cycles a frame. */
  inc0: f32 = 0.005;
  /** The natural log of the ratio of the final pitch to the first. */
  lr: f32 = 1;
  /** The lowpass's cutoff at the start, in hertz. */
  cut0: f32 = 300;
  /** The natural log of the ratio of the final cutoff to the first. */
  cutLr: f32 = 1;
  aSine: f32 = 0.5;
  aNoise: f32 = 1;

  /** Sets the sound and returns it. */
  shape(
    sr: f32,
    len: f32,
    inc0: f32,
    lr: f32,
    cut0: f32,
    cutLr: f32,
    aSine: f32,
    aNoise: f32,
    key: u32,
  ): this {
    this.sr = sr;
    this.len = len;
    this.inc0 = inc0;
    this.lr = lr;
    this.cut0 = cut0;
    this.cutLr = cutLr;
    this.aSine = aSine;
    this.aNoise = aNoise;
    this.key = key;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const p = min(f32(age) / this.len, 1);
    this.sine.inc = this.inc0 * exp(p * this.lr);
    const fc = this.cut0 * exp(p * this.cutLr);
    this.svf.step(noise(this.key, age), svfCoef(fc, this.sr));
    return p * p * (this.sine.tick() * this.aSine + this.svf.low * this.aNoise);
  }
}
