"use typeshade";

// Experiment 4 (docs/experiments.md, section 4, method step 3): the sum of the partials in the
// tree order of a reduction (compiler Rule 7.2), in the two forms the language has for it. The
// engine's own sum, the gather `mixdown` of `src/kernels/mixdown.shade.ts`, adds the lanes of a
// frame one after another instead. The record compares the three.

/**
 * Sums frame `n` of the lanes over the `count` partials into `out[n]`: a reduction, so the sum is
 * the tree order of Rule 7.2 on every tier. One call sums one frame; a block takes one call for each
 * of its frames.
 */
export function sumFrame(out: array<f32>, lanes: array<f32>, n: u32, count: u32, block: u32) {
  let s = 0.;
  for (let v: u32 = 0; v < count; v++) {
    s += lanes[v * block + n];
  }
  out[n] = s;
}

/**
 * Adds every lane into the block: `out[n]` gains `lanes[v * block + n]` from each of the `count`
 * partials. An `f32` scatter: the CPU tier folds the partials of each frame in the tree order of
 * Rule 7.2, and the proof refuses the loop for the GPU (TS8070), which the record shows.
 */
export function sumScatter(out: array<f32>, lanes: array<f32>, count: u32, block: u32) {
  for (let v: u32 = 0; v < count; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[n] += lanes[v * block + n];
    }
  }
}
