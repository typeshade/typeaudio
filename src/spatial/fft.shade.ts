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

// `pad` and `store` were experiment 5's (`experiments/05-convolution/convolution.shade.ts`, which
// keeps its own copy for its oracle): an engine module does not import an experiment.

/**
 * Writes the block `input` as the real parts of the first 1,024 points of `padded`, with imaginary
 * parts of 0. The second half of `padded` is the zero padding: the engine makes `padded` zeroed and
 * no call writes its second half.
 *
 * The loop runs over the 2,048 points and writes only under `if (j < FRAMES)`, so `input` is read
 * only at indices 0 to 1023. The call's check of the arrays a loop reads sees the guard at the
 * compiler pin `415b276a` (compiler issue #997, fixed by #1029). Earlier pins refused this form
 * before it ran (`pad(): parameter "input" holds 1024 elements, and loop 1 reads it at indices 0
 * to 2047.`), and this kernel looped over the frames.
 */
export function pad(padded: array<vec2>, input: array<f32>) {
  for (let j: u32 = 0; j < POINTS; j++) {
    if (j < FRAMES) {
      padded[j] = vec2(input[j], 0.);
    }
  }
}

/**
 * Writes the spectrum of the newest block into slot `slot` of the delay line `line`.
 *
 * The index is written `slot * POINTS + j`. The loop proof of rule R3 admits it at the compiler pin
 * `415b276a` (compiler issue #983, fixed by #994). Earlier pins refused it with TS8070 and this
 * kernel wrote `j * 1 + slot * POINTS`.
 */
export function store(line: array<vec2>, spectrum: array<vec2>, slot: u32) {
  for (let j: u32 = 0; j < POINTS; j++) {
    line[slot * POINTS + j] = spectrum[j];
  }
}
