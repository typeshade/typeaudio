'use typeshade';

// The kind `voice`: an input stem that the plan's host supplies (a `Float32Array` per event). The
// unit only scales it. With no stem the host feeds zeros, and the kind is silent.

export class Stem {
  /** The linear level. */
  level: f32 = 1;

  /** Sets the level and returns the unit. */
  shape(level: f32): this {
    this.level = level;
    return this;
  }

  /** One sample of the stem, scaled. */
  at(x: f32): f32 {
    return x * this.level;
  }
}
