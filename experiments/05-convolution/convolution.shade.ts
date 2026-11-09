"use typeshade";

// Experiment 5 (docs/experiments.md, section 5): the kernels of a uniform partitioned convolution
// by overlap-add, around the 2,048-point FFT entry of experiment 3 (`fftMediumTable` in
// `experiments/03-fft/fft.shade.ts`). The impulse response is cut into partitions of 1,024 frames;
// each partition, zero-padded to 2,048 points, is transformed once. Each block of 1,024 input
// frames is then:
//
// 1. `pad`: written into the first half of 2,048 complex points, whose second half stays zero;
// 2. transformed forward by the FFT entry;
// 3. `store`: written into its slot of the frequency-domain delay line, a ring of one spectrum per
//    partition;
// 4. `accumulate`: multiplied bin by bin with the partitions' spectra, the newest block with the
//    first partition, and summed over the partitions;
// 5. transformed back by the FFT entry;
// 6. `overlapAdd`: the first half of the result plus the second half that the block before left.
//
// Each function is a kernel function (compiler surface §65): one loop at the top level, each lane
// one bin or one frame, each write at the lane's own index. The sizes are module constants, so no
// loop reads a `.length` (docs/compiler-asks.md, J).

/** The frames of a block, and of a partition of the impulse response. */
const FRAMES: u32 = 1024;
/** The points of a transform: a block of frames, zero-padded to twice its length. */
const POINTS: u32 = 2048;

/** The product of two complex numbers, as `experiments/03-fft/fft.shade.ts` writes it. */
function cmul(a: vec2, b: vec2): vec2 {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

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

/**
 * The multiply-accumulate: bin `j` of `sum` is the sum over the partitions `p` of the spectrum of
 * the block `p` blocks old, which the delay line holds in slot `(head - p) mod partitions`, times
 * the spectrum of partition `p`. `head` is the slot of the newest block.
 */
export function accumulate(
  sum: array<vec2>,
  line: array<vec2>,
  spectra: array<vec2>,
  head: u32,
  partitions: u32,
) {
  for (let j: u32 = 0; j < POINTS; j++) {
    let acc = vec2(0., 0.);
    for (let p: u32 = 0; p < partitions; p++) {
      const slot = (head + partitions - p) % partitions;
      acc = acc + cmul(line[slot * POINTS + j], spectra[p * POINTS + j]);
    }
    sum[j] = acc;
  }
}

/**
 * The overlap-add: frame `n` of the output is the real part of point `n` of the inverse transform
 * `block` plus frame `n` of `tail`, which the block before left; then `tail` keeps the second half
 * of `block` for the block after.
 */
export function overlapAdd(out: array<f32>, tail: array<f32>, block: array<vec2>) {
  for (let n: u32 = 0; n < FRAMES; n++) {
    out[n] = block[n].x + tail[n];
    tail[n] = block[n + FRAMES].x;
  }
}
