"use typeshade";

// Experiment 1 (docs/experiments.md, section 1): one kernel, 64 sine partials summed into each
// frame of a block, one lane per frame. Its numbers measure the round trip of a block; the sound
// is a by-product.

/** How many partials each frame sums. */
const PARTIALS: u32 = 64;
/** One full turn, in radians. */
const TAU: f32 = 6.283185307179586;

/**
 * Writes one block: frame `n` of the block that starts at the frame `start` is the sum of the 64
 * harmonics of `f0` hertz at the sample rate `sr`, harmonic `k` at the level `1 / k`. The time
 * wraps each second, which a whole number of hertz does not hear.
 */
export function partials(out: array<f32>, start: u32, f0: f32, sr: u32) {
  for (let n: u32 = 0; n < out.length; n++) {
    const t = f32((start + n) % sr) / f32(sr);
    let s = 0.;
    for (let k: u32 = 1; k <= PARTIALS; k++) {
      s += sin(TAU * fract(f0 * f32(k) * t)) / f32(k);
    }
    out[n] = s * 0.25;
  }
}
