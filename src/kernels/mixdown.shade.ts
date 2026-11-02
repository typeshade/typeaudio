"use typeshade";

// Shape G (docs/architecture.md, section 2): the loop runs over the frames of a block and gathers
// each frame from the lanes, an index other than its own counter.

/**
 * Mixes the lanes of a bank into one bus: `out[n]` is the sum over the voices `v` of
 * `lanes[v * block + n]`, added in the order of `v`.
 */
export function mixdown(out: array<f32>, lanes: array<f32>, voiceCount: u32, block: u32) {
  for (let n: u32 = 0; n < block; n++) {
    let s = 0.;
    for (let v: u32 = 0; v < voiceCount; v++) {
      s += lanes[v * block + n];
    }
    out[n] = s;
  }
}
