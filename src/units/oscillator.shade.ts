"use typeshade";

// The oscillators. The phase and its step are shared, so they live in the abstract base, and each
// concrete class supplies the one thing that differs, the wave of a phase (surface §26: `abstract`,
// `extends`, `protected`, a `this`-returning method).
//
// Workaround: the static builder is written on each concrete class. Its one generic form on the
// base, `static at<C extends Oscillator>(this: { new (): C }, f: f32, sr: f32): C`, which plain
// TypeScript accepts for an abstract class, is refused by the compiler at its `new this()` (TS8035,
// "Oscillator" is abstract, so there is no instance of it to build), although TypeScript lets no
// call reach it on the abstract class itself. The compiler ask is `docs/compiler-asks.md`, M:
// issue typeshade/typeshade#944.

/** One full turn of the phase, in radians. */
const TAU: f32 = 6.283185307179586;

/**
 * A phase-accumulating oscillator: the phase, in cycles, moves by `inc` each sample and stays in
 * [0, 1). A class that extends it supplies `wave`, the sample of a phase.
 */
export abstract class Oscillator {
  /** The phase, in cycles, in [0, 1). */
  phase: f32 = 0.;
  /** The phase step of one sample, in cycles: the frequency over the sample rate. */
  inc: f32 = 0.;

  /** Sets the frequency to `f` hertz at the sample rate `sr`, and returns the oscillator. */
  hz(f: f32, sr: f32): this {
    this.inc = f / sr;
    return this;
  }

  /** One sample: the wave at the phase, then the phase moves on by one step. */
  tick(): f32 {
    const y = this.wave(this.phase);
    this.phase = fract(this.phase + this.inc);
    return y;
  }

  /** The sample at the phase `p`, in [-1, 1]. */
  protected abstract wave(p: f32): f32;
}

/** A sine oscillator. */
export class Sine extends Oscillator {
  /** A sine at `f` hertz and the sample rate `sr`. */
  static at(f: f32, sr: f32): Sine {
    return new Sine().hz(f, sr);
  }

  protected wave(p: f32): f32 {
    return sin(p * TAU);
  }
}

/** A naive sawtooth oscillator: it rises from -1 to 1 over each cycle, with no band limit. */
export class Saw extends Oscillator {
  /** A sawtooth at `f` hertz and the sample rate `sr`. */
  static at(f: f32, sr: f32): Saw {
    return new Saw().hz(f, sr);
  }

  protected wave(p: f32): f32 {
    return p * 2. - 1.;
  }
}
