'use typeshade';

// The kind `shimmer`: up to six inharmonic partials, each a sine of the engine's units with its own
// decay, as experiment 4's additive units are built. `density` sets how many sound, `height` the
// lowest partial's pitch.

import { Sine } from '../units/oscillator.shade.ts';

/** One partial: a sine, an amplitude and a decay rate. */
export class Partial {
  osc: Sine = new Sine();
  amp: f32 = 0;
  /** The decay rate, per frame. */
  rate: f32 = 0;

  /** Sets the partial at `f` hertz and the sample rate `sr`, and returns it. */
  set(f: f32, sr: f32, amp: f32, rate: f32): this {
    this.osc.hz(f, sr);
    this.amp = amp;
    this.rate = rate;
    return this;
  }

  /** One sample at the frame `a`, after an attack of rate `att`. */
  tick(a: f32, att: f32): f32 {
    return this.osc.tick() * this.amp * exp(-a * this.rate) * (1 - exp(-a * att));
  }
}

/** The amplitude of partial `i` when `count` partials sound. */
function amplitude(i: f32, count: f32, gain: f32): f32 {
  if (count > i) {
    return gain / (1 + 0.5 * i);
  }
  return 0;
}

export class Shimmer {
  age: u32 = 0;
  /** The attack rate, per frame. */
  att: f32 = 0.01;
  p0: Partial = new Partial();
  p1: Partial = new Partial();
  p2: Partial = new Partial();
  p3: Partial = new Partial();
  p4: Partial = new Partial();
  p5: Partial = new Partial();

  /**
   * Sets the sound and returns it: the lowest partial at `base` hertz, `count` partials (1 to 6) at
   * the ratios of a bell, each decaying at `rate` a frame times its place, at `gain`.
   */
  shape(sr: f32, base: f32, count: f32, rate: f32, att: f32, gain: f32): this {
    this.att = att;
    this.p0.set(base * 1, sr, amplitude(0, count, gain), rate * 1);
    this.p1.set(base * 1.5, sr, amplitude(1, count, gain), rate * 1.5);
    this.p2.set(base * 2.01, sr, amplitude(2, count, gain), rate * 2);
    this.p3.set(base * 2.76, sr, amplitude(3, count, gain), rate * 2.5);
    this.p4.set(base * 3.4, sr, amplitude(4, count, gain), rate * 3);
    this.p5.set(base * 4.13, sr, amplitude(5, count, gain), rate * 3.5);
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    const att = this.att;
    return (
      this.p0.tick(a, att) +
      this.p1.tick(a, att) +
      this.p2.tick(a, att) +
      this.p3.tick(a, att) +
      this.p4.tick(a, att) +
      this.p5.tick(a, att)
    );
  }
}
