'use typeshade';

// The kind `whoosh` (docs/sound-design-loop.md, "The kinds"): noise through a bandpass whose centre
// sweeps up, under a raised-sine envelope. `speed` sets how early the sweep rises, `brightness` how
// high it ends. The host (`src/kinds/make.ts`) turns the macros into the numbers of `shape`.

import { Svf, svfCoef } from '../units/svf.shade.ts';
import { noise } from './noise.shade.ts';

/** Half a turn, in radians. */
const PI: f32 = 3.141592653589793;

export class Whoosh {
  /** The frames played so far. */
  age: u32 = 0;
  /** The seed of the noise. */
  key: u32 = 1;
  sr: f32 = 48000;
  /** The length in frames. */
  len: f32 = 1;
  /** The centre at the start, in hertz. */
  f0: f32 = 200;
  /** The natural log of the ratio of the final centre to the first. */
  lr: f32 = 1;
  /** From 0 (the centre rises evenly) to 1 (it rises late and fast). */
  curve: f32 = 0.5;
  gain: f32 = 1;
  svf: Svf = new Svf();

  /** Sets the sound and returns it. */
  shape(sr: f32, len: f32, f0: f32, lr: f32, curve: f32, damp: f32, gain: f32, key: u32): this {
    this.sr = sr;
    this.len = len;
    this.f0 = f0;
    this.lr = lr;
    this.curve = curve;
    this.gain = gain;
    this.key = key;
    this.svf.damping(damp);
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const p = min(f32(age) / this.len, 1);
    const q = p * (this.curve + (1 - this.curve) * p);
    const fc = this.f0 * exp(q * this.lr);
    const band = this.svf.step(noise(this.key, age), svfCoef(fc, this.sr));
    const s = sin(PI * p);
    return band * s * s * this.gain;
  }
}
