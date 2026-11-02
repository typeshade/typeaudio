"use typeshade";

// Experiment 4 (docs/experiments.md, section 4): a bank of partials, each a sine through a lowpass
// at the level of its envelope, whose filter cutoff moves once per block. The kernels are shape V
// (docs/architecture.md, section 2): one lane per partial, each lane writing its own block of
// frames at `out[v * block + n]`. The sum of the lanes is a second kernel in the same scope.
//
// The filter's coefficients for the new cutoff come from one of three places, one partial class
// each, to measure ask D of docs/compiler-asks.md:
//
// - `Partial`: the engine's `Lowpass` designs them on the device, in `f32`;
// - `Partial64`: `Lowpass64` designs them on the device, in the emulated `f64` (surface §39);
// - `HostPartial`: the host designs them in JavaScript doubles and the kernel hands them over.

import { Sine } from "../../src/units/oscillator.shade.ts";
import { Biquad, Lowpass } from "../../src/units/biquad.shade.ts";
import { Envelope } from "../../src/units/envelope.shade.ts";

/** A lowpass whose coefficients are designed in the emulated `f64` and then rounded to `f32`. */
export class Lowpass64 extends Biquad {
  protected design(w: f32, q: f32): void {
    const cw: f64 = cos(f64(w));
    const alpha: f64 = sin(f64(w)) / (2. * f64(q));
    const a0: f64 = 1. + alpha;
    const b1: f64 = (1. - cw) / a0;
    this.b0 = f32(b1 * 0.5);
    this.b1 = f32(b1);
    this.b2 = f32(b1 * 0.5);
    this.a1 = f32((-2. * cw) / a0);
    this.a2 = f32((1. - alpha) / a0);
  }
}

/** A lowpass that also takes coefficients a host designed. */
export class HostLowpass extends Lowpass {
  /** Sets the coefficients as they are, in the order of the difference equation. */
  use(b0: f32, b1: f32, b2: f32, a1: f32, a2: f32) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
  }
}

/** What every partial holds but its filter: a sine, an envelope, a level and the filter's settings. */
export abstract class PartialBase {
  /** The oscillator. */
  osc: Sine = new Sine();
  /** The amplitude envelope. */
  env: Envelope = new Envelope();
  /** The level of the partial, linear. */
  level: f32 = 1.;
  /** The cutoff of the filter at a sweep of 1, in hertz. */
  cutoff: f32 = 1000.;
  /** The quality of the filter. */
  q: f32 = 0.707;
  /** The sample rate, in hertz. */
  sr: f32 = 48000.;

  /**
   * Sets a partial at `f` hertz and the linear level `level`, its filter's cutoff `cutoff` hertz at
   * a sweep of 1 with the quality `q`, its envelope rising in `attack` seconds and falling in
   * `decay` seconds toward `sustain`, at the sample rate `sr`.
   */
  protected init(f: f32, level: f32, cutoff: f32, q: f32, attack: f32, decay: f32, sustain: f32, sr: f32) {
    this.osc.hz(f, sr);
    this.env.times(attack, decay, sustain, sr);
    this.level = level;
    this.cutoff = cutoff;
    this.q = q;
    this.sr = sr;
  }

  /** The cutoff at `sweep` times its own, below 0.45 of the sample rate. */
  protected swept(sweep: f32): f32 {
    return min(this.cutoff * sweep, 0.45 * this.sr);
  }

  /** One sample of the partial. */
  tick(): f32 {
    return this.filtered(this.osc.tick()) * this.env.tick() * this.level;
  }

  /** One sample through the partial's filter. */
  protected abstract filtered(x: f32): f32;
}

/** A partial whose filter designs its coefficients on the device, in `f32`: the engine's `Lowpass`. */
export class Partial extends PartialBase {
  /** The filter, whose cutoff `retune` moves each block. */
  filter: Lowpass = new Lowpass();

  /** A partial with the settings `init` names. */
  constructor(f: f32, level: f32, cutoff: f32, q: f32, attack: f32, decay: f32, sustain: f32, sr: f32) {
    super();
    this.init(f, level, cutoff, q, attack, decay, sustain, sr);
    this.filter.set(cutoff, q, sr);
  }

  /** Moves the filter's cutoff to `sweep` times its own. */
  retune(sweep: f32) {
    this.filter.set(this.swept(sweep), this.q, this.sr);
  }

  protected filtered(x: f32): f32 {
    return this.filter.tick(x);
  }
}

/** A partial whose filter designs its coefficients on the device, in the emulated `f64`. */
export class Partial64 extends PartialBase {
  /** The filter, whose cutoff `retune` moves each block. */
  filter: Lowpass64 = new Lowpass64();

  /** A partial with the settings `init` names. */
  constructor(f: f32, level: f32, cutoff: f32, q: f32, attack: f32, decay: f32, sustain: f32, sr: f32) {
    super();
    this.init(f, level, cutoff, q, attack, decay, sustain, sr);
    this.filter.set(cutoff, q, sr);
  }

  /** Moves the filter's cutoff to `sweep` times its own. */
  retune(sweep: f32) {
    this.filter.set(this.swept(sweep), this.q, this.sr);
  }

  protected filtered(x: f32): f32 {
    return this.filter.tick(x);
  }
}

/** A partial whose filter takes the coefficients a host designed, once per block. */
export class HostPartial extends PartialBase {
  /** The filter, whose coefficients `retune` replaces each block. */
  filter: HostLowpass = new HostLowpass();

  /** A partial with the settings `init` names. */
  constructor(f: f32, level: f32, cutoff: f32, q: f32, attack: f32, decay: f32, sustain: f32, sr: f32) {
    super();
    this.init(f, level, cutoff, q, attack, decay, sustain, sr);
    this.filter.set(cutoff, q, sr);
  }

  /** Gives the filter the coefficients of the new cutoff. */
  retune(b0: f32, b1: f32, b2: f32, a1: f32, a2: f32) {
    this.filter.use(b0, b1, b2, a1, a2);
  }

  protected filtered(x: f32): f32 {
    return this.filter.tick(x);
  }
}

/**
 * Renders one block of every partial of the bank, one lane per partial: lane `v` moves its filter's
 * cutoff to `sweep` times its own, then writes its `block` frames to `out[v * block + n]`. Its state
 * stays in `partials[v]` for the next block.
 */
export function additive(out: array<f32>, partials: array<Partial>, block: u32, sweep: f32) {
  for (let v: u32 = 0; v < partials.length; v++) {
    partials[v].retune(sweep);
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = partials[v].tick();
    }
  }
}

/** `additive` over partials whose filters design their coefficients in the emulated `f64`. */
export function additive64(out: array<f32>, partials: array<Partial64>, block: u32, sweep: f32) {
  for (let v: u32 = 0; v < partials.length; v++) {
    partials[v].retune(sweep);
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = partials[v].tick();
    }
  }
}

/**
 * `additive` over partials whose filters take the coefficients the host designed for this block:
 * lane `v` reads its five from `coefficients[v * 5]` on.
 */
export function additiveHost(out: array<f32>, partials: array<HostPartial>, coefficients: array<f32>, block: u32) {
  for (let v: u32 = 0; v < partials.length; v++) {
    const at = v * 5;
    partials[v].retune(coefficients[at], coefficients[at + 1], coefficients[at + 2], coefficients[at + 3], coefficients[at + 4]);
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = partials[v].tick();
    }
  }
}
