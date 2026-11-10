'use typeshade';

// The unit of the kinds `crack` and `rubble`: stone that breaks and stone that falls in a mass. Stone
// is heard as impacts, and each impact has the knock of its size: a block of radius `a` metres
// sounds near `54.6 / a` hertz, where its circumference is one wavelength (ka = 1). The unit holds no
// state for an impact. Five bands of noise each have an envelope; an impact raises the envelopes by
// the share of its sound that lies in each band, and each envelope then decays, the low bands slowly
// and the high bands fast. So a large block is low and long, a small one is high and short, and any
// number of impacts costs the same. The impacts come at random frames, from the key alone.

import { hash32, uniform } from 'typeshade/random';
import { Svf } from '../units/svf.shade.ts';
import { noise } from './noise.shade.ts';

/** One band of the stones: noise through two bandpasses, under an envelope that the impacts raise. */
export class StoneBand {
  svf: Svf = new Svf();
  svf2: Svf = new Svf();
  /** The envelope: what the impacts put into this band, decaying. */
  env: f32 = 0;
  /** The share of the envelope that a frame keeps. */
  keep: f32 = 0.999;
  /** The frequency coefficient of the bandpasses (`svfCoef`). */
  coef: f32 = 0.1;
  /** The band's centre over 54.6 hertz: times a size in metres, it is the centre over the size's ka = 1. */
  ratio: f32 = 1;
  /** The share of an impact's dry edge that this band takes. */
  edge: f32 = 0;
  gain: f32 = 1;

  /** Sets the band and returns it. */
  set(coef: f32, damp: f32, keep: f32, ratio: f32, edge: f32, gain: f32): this {
    this.coef = coef;
    this.svf.damping(damp);
    this.svf2.damping(damp);
    this.keep = keep;
    this.ratio = ratio;
    this.edge = edge;
    this.gain = gain;
    return this;
  }

  /**
   * An impact of a block of `size` metres at the level `amp`. Its knock is a bell around ka = 1, its
   * crack lies above ka = 1 and falls slowly toward the top, and `bright` is its dry edge.
   */
  hit(amp: f32, size: f32, bright: f32) {
    const r = this.ratio * size;
    const p = r / 1.15;
    const k = (2 * p) / (1 + p * p);
    const knock = 1.2 * (k * k);
    const q = sqrt(r);
    const r2 = r * r;
    const body = min(r2 * r2, 1) / sqrt(q);
    this.env = this.env + amp * (knock + body + this.edge * bright);
  }

  /** One sample of the band for the noise sample `x`. */
  tick(x: f32): f32 {
    const y = this.svf2.step(this.svf.step(x, this.coef), this.coef) * this.env * this.gain;
    this.env = this.env * this.keep;
    return y;
  }
}

export class Stones {
  age: u32 = 0;
  key: u32 = 1;
  /** The length in frames, over which the rate and the sizes move. No impact comes after it: the bands ring out. */
  len: f32 = 1;
  /** The chance of an impact in a frame: `rateA + rateB * u ** 1.5 + rateC * (1 - u) ** 3`, `u` the part of the length played. */
  rateA: f32 = 0;
  rateB: f32 = 0;
  rateC: f32 = 0;
  /** The smallest size in metres, and the natural log of the largest over it. */
  sizeLo: f32 = 0.1;
  sizeLog: f32 = 1;
  /** The sizes are scaled by `grow0 + grow1 * u`. */
  grow0: f32 = 1;
  grow1: f32 = 0;
  /** The level of the dry edge of each impact. */
  bright: f32 = 0.3;
  /** The level of the impact at the first frame, 0 for none, and its size in metres. */
  first: f32 = 0;
  firstSize: f32 = 0.5;
  b0: StoneBand = new StoneBand();
  b1: StoneBand = new StoneBand();
  b2: StoneBand = new StoneBand();
  b3: StoneBand = new StoneBand();
  b4: StoneBand = new StoneBand();

  /** Sets the sound and returns it; the host sets the five bands. */
  shape(
    key: u32,
    len: f32,
    rateA: f32,
    rateB: f32,
    rateC: f32,
    sizeLo: f32,
    sizeLog: f32,
    grow0: f32,
    grow1: f32,
    bright: f32,
    first: f32,
    firstSize: f32,
  ): this {
    this.key = key;
    this.len = len;
    this.rateA = rateA;
    this.rateB = rateB;
    this.rateC = rateC;
    this.sizeLo = sizeLo;
    this.sizeLog = sizeLog;
    this.grow0 = grow0;
    this.grow1 = grow1;
    this.bright = bright;
    this.first = first;
    this.firstSize = firstSize;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const u = min(f32(age) / this.len, 1);
    let amp: f32 = 0;
    let size: f32 = this.firstSize;
    if (age == 0) {
      amp = this.first;
    } else if (u < 1) {
      const v = 1 - u;
      const rate = this.rateA + this.rateB * u * sqrt(u) + this.rateC * v * v * v;
      const word = hash32(this.key ^ hash32(age));
      if (uniform(word) < rate) {
        size =
          this.sizeLo *
          exp(uniform(hash32(word ^ 1)) * this.sizeLog) *
          (this.grow0 + this.grow1 * u);
        amp = size * sqrt(size) * (0.5 + 0.5 * uniform(hash32(word ^ 2)));
      }
    }
    if (amp > 0) {
      this.b0.hit(amp, size, this.bright);
      this.b1.hit(amp, size, this.bright);
      this.b2.hit(amp, size, this.bright);
      this.b3.hit(amp, size, this.bright);
      this.b4.hit(amp, size, this.bright);
    }
    const y0 = this.b0.tick(noise(this.key ^ 101, age));
    const y1 = this.b1.tick(noise(this.key ^ 102, age));
    const y2 = this.b2.tick(noise(this.key ^ 103, age));
    const y3 = this.b3.tick(noise(this.key ^ 104, age));
    const y4 = this.b4.tick(noise(this.key ^ 105, age));
    return y0 + y1 + y2 + y3 + y4;
  }
}
