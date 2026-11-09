'use typeshade';

// The partitioned convolution of the reverb send (docs/sound-design-loop.md, "Spatial sound").
// Experiment 5 runs the transform in an entry that reaches a barrier, which the CPU tier refuses
// at the compiler pin (change 0092 is accepted, not implemented). Here the transform is kernel
// functions only, so that it runs on every tier: a radix-2 Stockham transform of 2,048 points in
// 11 stages, each stage one kernel function whose lane `i` writes `out[i]` from two reads (compiler
// surface §65). The stages of several transforms run in one call: lane `i` belongs to transform
// `i / 2048`. The pad, the store and the delay line are experiment 5's kernels, called as they are.

/** The points of a transform, and the frames of a block of the render. */
const POINTS: u32 = 2048;
/** The frames of a block. */
const FRAMES: u32 = 1024;

/** The product of two complex numbers, as `experiments/05-convolution/convolution.shade.ts` writes it. */
function cmul(a: vec2, b: vec2): vec2 {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

/**
 * One stage of the Stockham transform for every transform in `out`: with the stride `stride`
 * (1, 2, 4, ... 1,024) and `half = 1,024 / stride`, output `q + stride * (2 p + r)` is the sum of
 * the inputs `q + stride * p` and `q + stride * (p + half)` for `r = 0`, and their difference
 * times the twiddle `tw[p * stride]` for `r = 1`. `tw` is the table of `exp(+2 pi i k / 2048)` for
 * `k < 1,024` (`twiddleTable(2048)` of experiment 3); `sign` is -1 for the forward transform and
 * +1 for the inverse, which conjugates it; `scale` multiplies the output (1 / 2,048 on the last
 * stage of an inverse). After 11 stages, stage 0 writing one array and each stage after reading
 * the array the stage before wrote, the result is in natural order.
 */
export function fftStage(
  out: array<vec2>,
  inp: array<vec2>,
  tw: array<vec2>,
  stride: u32,
  half: u32,
  sign: f32,
  scale: f32,
) {
  for (let i: u32 = 0; i < out.length; i++) {
    const base = (i / POINTS) * POINTS;
    const j = i % POINTS;
    const q = j % stride;
    const k = j / stride;
    const p = k >> 1;
    const a = inp[base + q + stride * p];
    const b = inp[base + q + stride * (p + half)];
    if ((k & 1) == 0) {
      out[i] = (a + b) * scale;
    } else {
      const w = tw[p * stride];
      out[i] = cmul(a - b, vec2(w.x, sign * w.y)) * scale;
    }
  }
}

/**
 * The multiply-accumulate for two channels: lane `i` is bin `i % 2048` of channel `i / 2048`, the
 * sum over the `partitions` of the delay line's spectrum `p` blocks old (`head` is the slot of the
 * newest block) times the spectrum of that channel's partition `p`. `spectra` holds the left
 * partitions, then the right ones, `partitions * 2048` points each.
 */
export function accumulate2(
  sum: array<vec2>,
  line: array<vec2>,
  spectra: array<vec2>,
  head: u32,
  partitions: u32,
) {
  for (let i: u32 = 0; i < sum.length; i++) {
    const c = i / POINTS;
    const j = i % POINTS;
    let acc = vec2(0, 0);
    for (let p: u32 = 0; p < partitions; p++) {
      const slot = (head + partitions - p) % partitions;
      acc = acc + cmul(line[slot * POINTS + j], spectra[(c * partitions + p) * POINTS + j]);
    }
    sum[i] = acc;
  }
}

/**
 * The overlap-add for two channels: for channel `c = i / 1,024` and frame `n = i % 1,024`, the
 * output is the real part of point `n` of the channel's inverse transform plus `tail[i]`, and
 * `tail[i]` then keeps point `n + 1,024`.
 */
export function overlap2(out: array<f32>, tail: array<f32>, frames: array<vec2>) {
  for (let i: u32 = 0; i < out.length; i++) {
    const c = i / FRAMES;
    const n = i % FRAMES;
    out[i] = frames[c * POINTS + n].x + tail[i];
    tail[i] = frames[c * POINTS + n + FRAMES].x;
  }
}
