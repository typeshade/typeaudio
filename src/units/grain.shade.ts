"use typeshade";

// The grains (docs/architecture.md, section 6). A grain keeps no state that a frame changes: its
// sample at a frame is computed from its age, so the frames of a block can be rendered in any
// order, each by its own lane, and a list of grains is read and never written by the render.
// The engine's oscillators advance a phase on each `tick`, so a grain computes its wave from its
// age instead of holding an `Oscillator`.

import { hash32, uniform } from "typeshade/random";

/** One full turn, in radians. */
const TAU: f32 = 6.283185307179586;

/**
 * A grain: a sine burst under a Hann window, from the frame `start` for `length` frames. Before
 * `start` and from `start + length` on it is silent.
 */
export class Grain {
  /** The frame the grain starts at. */
  start: u32 = 0;
  /** How many frames the grain lasts, 1 or more. */
  length: u32 = 1;
  /** The phase step of one frame, in cycles: the frequency over the sample rate. */
  inc: f32 = 0.;
  /** The peak level, linear. */
  peak: f32 = 0.;

  /** A grain from the frame `start` for `length` frames, at `inc` cycles a frame and the peak level `peak`. */
  constructor(start: u32, length: u32, inc: f32, peak: f32) {
    this.start = start;
    this.length = length;
    this.inc = inc;
    this.peak = peak;
  }

  /** The sample at the frame `t`: 0 before the grain starts and once it has ended. */
  at(t: u32): f32 {
    if (t < this.start) {
      return 0.;
    }
    const age = t - this.start;
    if (age >= this.length) {
      return 0.;
    }
    const window = 0.5 - 0.5 * cos(TAU * (f32(age) / f32(this.length)));
    return this.peak * window * sin(TAU * fract(this.inc * f32(age)));
  }

  /** Whether the grain still sounds at the frame `t` or after it. */
  soundsFrom(t: u32): bool {
    return this.start + this.length > t;
  }
}

/**
 * A cloud of grains: how often a grain starts, and the ranges its length, pitch and level are
 * drawn from. Every draw comes from the seed and the frame, so the same cloud gives the same
 * grains on every tier. Build it with `new Cloud(sr)` and its setters, each of which returns it.
 */
export class Cloud {
  /** The sample rate, in hertz. */
  sr: f32 = 48000.;
  /** The chance that a frame starts a grain: the density over the sample rate. */
  chance: f32 = 0.;
  /** The shortest grain, in frames. */
  shortest: u32 = 1;
  /** How many frames longer than the shortest a grain may be. */
  spread: u32 = 0;
  /** The lowest phase step, in cycles a frame. */
  low: f32 = 0.;
  /** How far above the lowest the phase step may be, in cycles a frame. */
  span: f32 = 0.;
  /** The peak level of the loudest grain, linear; a grain's peak is drawn from half of it to all of it. */
  loudest: f32 = 1.;
  /** The seed every draw starts from. */
  key: u32 = 1;

  /** A silent cloud at the sample rate `sr`. */
  constructor(sr: f32) {
    this.sr = sr;
  }

  /** Starts `perSecond` grains a second, on average. */
  density(perSecond: f32): this {
    this.chance = perSecond / this.sr;
    return this;
  }

  /** Draws each grain's length from `shortest` to `longest` seconds. */
  lengths(shortest: f32, longest: f32): this {
    this.shortest = max(u32(shortest * this.sr), 1);
    this.spread = u32((longest - shortest) * this.sr);
    return this;
  }

  /** Draws each grain's frequency from `low` to `high` hertz. */
  pitches(low: f32, high: f32): this {
    this.low = low / this.sr;
    this.span = (high - low) / this.sr;
    return this;
  }

  /** Sets the peak level of the loudest grain, linear. */
  level(loudest: f32): this {
    this.loudest = loudest;
    return this;
  }

  /** Sets the seed every draw starts from. */
  seed(key: u32): this {
    this.key = key;
    return this;
  }

  /** The draw of the frame `t`: one word, from the seed and the frame only. */
  draw(t: u32): u32 {
    return hash32(this.key ^ hash32(t));
  }

  /** Whether the frame whose draw is `word` starts a grain. */
  starts(word: u32): bool {
    return uniform(word) < this.chance;
  }

  /** The grain that starts at the frame `t`, its length, pitch and level drawn from `word`. */
  grain(t: u32, word: u32): Grain {
    const length = this.shortest + hash32(word ^ 1) % (this.spread + 1);
    const inc = this.low + this.span * uniform(hash32(word ^ 2));
    const peak = this.loudest * (0.5 + 0.5 * uniform(hash32(word ^ 3)));
    return new Grain(t, length, inc, peak);
  }
}
