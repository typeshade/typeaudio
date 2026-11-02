"use typeshade";

// Shape R (docs/architecture.md, section 2): a reduction over the frames of a block. It folds in
// the tree order of Rule 7.2 on every tier, and as the last call of a `fuse` scope it can take
// the shape F calls before it into its loop (surface §71, fact F6).

/** The largest magnitude of a bus, 0 for silence. */
export function peak(x: array<f32>): f32 {
  let s = 0.;
  for (let i: u32 = 0; i < x.length; i++) {
    s = max(s, abs(x[i]));
  }
  return s;
}
