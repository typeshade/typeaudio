'use typeshade';

// The kind `impact`: a sub sine whose pitch falls fast and whose level decays, a burst of lowpassed
// noise and a click. `weight` sets the sub's pitch and level, `decay` the lengths, `crack` the
// click and the noise's brightness.

import { Sine } from '../units/oscillator.shade.ts';
import { OnePole } from '../units/one-pole.shade.ts';
import { noise } from './noise.shade.ts';

export class Impact {
  age: u32 = 0;
  key: u32 = 1;
  /** The sub sine. */
  sub: Sine = new Sine();
  /** The noise burst's lowpass. */
  lp: OnePole = new OnePole(0.1);
  /** The phase step of the sub at rest, in cycles a frame. */
  base: f32 = 0.001;
  /** How far above `base` the pitch starts, as a fraction of it. */
  drop: f32 = 1;
  /** The pitch fall's rate, per frame. */
  dropRate: f32 = 0.001;
  /** The sub's decay rate, per frame. */
  subDecay: f32 = 0.0001;
  /** The noise burst's decay rate, per frame. */
  noiseDecay: f32 = 0.001;
  /** The click's length in frames. */
  clickLen: f32 = 48;
  aSub: f32 = 1;
  aNoise: f32 = 0.5;
  aClick: f32 = 0.5;

  /** Sets the sound and returns it. */
  shape(
    key: u32,
    base: f32,
    drop: f32,
    dropRate: f32,
    subDecay: f32,
    noiseDecay: f32,
    noiseK: f32,
    clickLen: f32,
    aSub: f32,
    aNoise: f32,
    aClick: f32,
  ): this {
    this.key = key;
    this.base = base;
    this.drop = drop;
    this.dropRate = dropRate;
    this.subDecay = subDecay;
    this.noiseDecay = noiseDecay;
    this.lp.k = noiseK;
    this.clickLen = clickLen;
    this.aSub = aSub;
    this.aNoise = aNoise;
    this.aClick = aClick;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    this.sub.inc = this.base * (1 + this.drop * exp(-a * this.dropRate));
    const s = this.sub.tick() * exp(-a * this.subDecay) * this.aSub;
    const n = this.lp.tick(noise(this.key, age)) * exp(-a * this.noiseDecay) * this.aNoise;
    let c = 0;
    if (a < this.clickLen) {
      const r = 1 - a / this.clickLen;
      c = noise(this.key ^ 12345, age) * r * r * this.aClick;
    }
    return s + n + c;
  }
}
