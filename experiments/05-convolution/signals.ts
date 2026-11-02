// Experiment 5 (docs/experiments.md, section 5): the impulse response, the inputs, the f64
// references and the measures of the tail. It imports no shader module, so the runner, the page,
// Node and the oracle share it. The FFT's own helpers, the measures of an output against a
// reference and the base64 of an output's bits are experiment 3's (`../03-fft/signals.ts`).

import { generator } from 'typeshade/random';
import { SMALLEST_NORMAL, fft64, ulp32 } from '../03-fft/signals.ts';

/** The sample rate the impulse response is written for. */
export const SAMPLE_RATE = 48000;
/** The frames of a block of the input, and of a partition of the impulse response. */
export const FRAMES = 1024;
/** The points of a transform: a block zero-padded to twice its length. */
export const POINTS = 2048;
/** The frames of the impulse response: 10 seconds at 48 kHz. */
export const IR_FRAMES = 10 * SAMPLE_RATE;
/** The partitions of the impulse response: 469, the last one 768 frames long and zero-padded. */
export const PARTITIONS = Math.ceil(IR_FRAMES / FRAMES);

/** The seed of the impulse response's diffuse tail, a 32-bit word. */
export const IR_SEED = 0x5eed0005;
/** The seed of the noise input, a 32-bit word. */
export const NOISE_SEED = 0x5eed0006;
/** The seed of the inputs of the CPU tier's kernel check, a 32-bit word. */
export const CHECK_SEED = 0x5eed0007;

/** The level of the diffuse tail at frame 0, before it decays. */
export const DIFFUSE = 0.5;
/** The decay of the diffuse tail over the impulse response, in decibels: -60 dB at 10 s. */
export const DECAY_DB = -60;
/**
 * The direct sound and the early reflections: the frame each lands on and its gain, added to the
 * diffuse tail. At 48 kHz they are 7, 13, 21, 32, 47 and 63 ms after the direct sound.
 */
export const REFLECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [337, 0.71],
  [613, -0.55],
  [1031, 0.43],
  [1523, -0.34],
  [2267, 0.27],
  [3001, -0.21],
];

/** The frame of block 0 that holds the impulse of the tail's input. Its transform is the twiddles. */
export const IMPULSE_AT = 1;
/** The level of the full-scale impulse, and of the quiet one, whose tail reaches the subnormals. */
export const LEVELS = { full: 1, quiet: 2 ** -112 } as const;
export type Level = keyof typeof LEVELS;
/** The frames of the tail that the arms are compared over: the last second of the response. */
export const TAIL_FRAMES = SAMPLE_RATE;
/** The frame after the response's last: the impulse at `IMPULSE_AT` plus the impulse response. */
export const TAIL_END = IMPULSE_AT + IR_FRAMES;
/** The first frame of the last second of the response. */
export const TAIL_START = TAIL_END - TAIL_FRAMES;
/** The blocks the impulse's response takes, block 0 included: the last frame is in block 468. */
export const TAIL_BLOCKS = Math.ceil(TAIL_END / FRAMES);
/** The first block that holds a frame of the last second. */
export const TAIL_FIRST_BLOCK = Math.floor(TAIL_START / FRAMES);
/**
 * The block a jump starts from. A jump runs block 0, which holds the impulse, then the blocks from
 * this one to the last: the blocks between hold no input, write +0 into slots of the delay line
 * that hold +0, and their outputs are not compared. This block's output is not compared either:
 * it rebuilds the overlap-add's tail, which the blocks skipped would have left.
 */
export const JUMP_FROM = TAIL_FIRST_BLOCK - 1;

/** The uniform of a call of the FFT entry: the forward transform, and the inverse scaled by 1 / N. */
export const FORWARD = { sign: -1, scale: 1 } as const;
export const INVERSE = { sign: 1, scale: 1 / POINTS } as const;

/**
 * The impulse response, rounded to `f32`: the diffuse tail, `DIFFUSE * 10^(DECAY_DB / 20 * n / N) *
 * (2u - 1)` with `u` from `generator(IR_SEED)` of `typeshade/random`, plus the reflections.
 */
export function impulseResponse(): Float32Array {
  const h = new Float32Array(IR_FRAMES);
  const draw = generator(IR_SEED);
  const gains = new Map(REFLECTIONS);
  for (let n = 0; n < IR_FRAMES; n++) {
    const envelope = 10 ** ((DECAY_DB / 20) * (n / IR_FRAMES));
    h[n] = DIFFUSE * envelope * (2 * draw() - 1) + (gains.get(n) ?? 0);
  }
  return h;
}

/**
 * The partitions of `h`, each zero-padded to `POINTS` complex points: the frames of partition `p`
 * are the real parts of the first `FRAMES` points of its slot. The FFT entry transforms them, one
 * workgroup for each partition.
 */
export function paddedPartitions(h: Float32Array): Float32Array {
  const out = new Float32Array(PARTITIONS * POINTS * 2);
  for (let n = 0; n < h.length; n++) {
    const p = Math.floor(n / FRAMES);
    out[2 * (p * POINTS + (n % FRAMES))] = h[n]!;
  }
  return out;
}

/** `blocks` blocks of the noise input: `2u - 1` with `u` from `generator(NOISE_SEED)`. */
export function noise(blocks: number): Float32Array {
  const out = new Float32Array(blocks * FRAMES);
  const draw = generator(NOISE_SEED);
  for (let i = 0; i < out.length; i++) out[i] = 2 * draw() - 1;
  return out;
}

/** Block `k` of the impulse input at `level`: `level` at frame `IMPULSE_AT` of block 0, else 0. */
export function impulseBlock(k: number, level: number): Float32Array {
  const out = new Float32Array(FRAMES);
  if (k === 0) out[IMPULSE_AT] = level;
  return out;
}

/**
 * The f64 reference of the impulse's response at `level`, over frames `from` to `to`: `level`
 * times the impulse response delayed by `IMPULSE_AT`. The impulse response is in `f32`s and the
 * level is a power of 2, so each value is exact in doubles.
 */
export function impulseReference(h: Float32Array, level: number, from: number, to: number): Float64Array {
  const out = new Float64Array(to - from);
  for (let n = from; n < to; n++) {
    const m = n - IMPULSE_AT;
    if (m >= 0 && m < h.length) out[n - from] = level * h[m]!;
  }
  return out;
}

/**
 * The f64 reference of the convolution of `x` with `h` over the first `frames` frames: the
 * transform in doubles of experiment 3 (`fft64`) of both, zero-padded to a power of 2 that holds the
 * whole linear convolution, multiplied, and transformed back.
 */
export function convolve64(x: Float32Array, h: Float32Array, frames: number): Float64Array {
  let n = 1;
  while (n < x.length + h.length - 1) n *= 2;
  const a = new Float64Array(2 * n);
  const b = new Float64Array(2 * n);
  for (let i = 0; i < x.length; i++) a[2 * i] = x[i]!;
  for (let i = 0; i < h.length; i++) b[2 * i] = h[i]!;
  const fa = fft64(a, n, 'forward');
  const fb = fft64(b, n, 'forward');
  for (let k = 0; k < n; k++) {
    const re = fa[2 * k]! * fb[2 * k]! - fa[2 * k + 1]! * fb[2 * k + 1]!;
    const im = fa[2 * k]! * fb[2 * k + 1]! + fa[2 * k + 1]! * fb[2 * k]!;
    fa[2 * k] = re;
    fa[2 * k + 1] = im;
  }
  const y = fft64(fa, n, 'inverse');
  const out = new Float64Array(frames);
  for (let i = 0; i < frames; i++) out[i] = y[2 * i]!;
  return out;
}

const word = new DataView(new ArrayBuffer(4));

/** The place of an `f32` on the line of all `f32`s: adjacent `f32`s are 1 apart, and -0 is 0. */
function place(v: number): number {
  word.setFloat32(0, v);
  const bits = word.getUint32(0);
  return bits & 0x80000000 ? -(bits & 0x7fffffff) : bits;
}

/** How many `f32`s lie between `a` and `b`: 0 for the same value, 1 for neighbours. */
export function ulpDistance(a: number, b: number): number {
  return Math.abs(place(Math.fround(a)) - place(Math.fround(b)));
}

/** How an arm's tail stands against the f64 reference. */
export interface TailAccuracy {
  /** The largest error, in units of the `f32` ULP at the largest magnitude of the reference. */
  readonly maxPeakUlp: number;
  /** The mean error, in the same units. */
  readonly meanPeakUlp: number;
  /** The largest error, absolute. */
  readonly maxAbs: number;
  /** The root of the summed squared errors over the root of the summed squared reference. */
  readonly relRms: number;
  /** The most `f32`s between a value and the reference rounded to `f32`. */
  readonly maxUlp: number;
  /** How many values are the reference rounded to the nearest `f32`. */
  readonly exact: number;
  readonly count: number;
}

/** `y` against the reference `r`, value by value. */
export function tailAccuracy(y: ArrayLike<number>, r: ArrayLike<number>): TailAccuracy {
  let peak = 0;
  for (let i = 0; i < r.length; i++) peak = Math.max(peak, Math.abs(r[i]!));
  const unit = ulp32(peak);
  let maxAbs = 0;
  let sum = 0;
  let sq = 0;
  let ref = 0;
  let exact = 0;
  let maxUlp = 0;
  for (let i = 0; i < r.length; i++) {
    const e = Math.abs(y[i]! - r[i]!);
    maxAbs = Math.max(maxAbs, e);
    sum += e;
    sq += e * e;
    ref += r[i]! * r[i]!;
    const rounded = Math.fround(r[i]!);
    if (Object.is(y[i], rounded)) exact++;
    maxUlp = Math.max(maxUlp, ulpDistance(y[i]!, rounded));
  }
  return {
    maxPeakUlp: maxAbs / unit,
    meanPeakUlp: sum / r.length / unit,
    maxAbs,
    relRms: ref === 0 ? 0 : Math.sqrt(sq / ref),
    maxUlp,
    exact,
    count: r.length,
  };
}

/** How two arms' tails differ. */
export interface TailAgreement {
  /** The values whose bits differ, -0 against 0 included. */
  readonly differ: number;
  /** The most `f32`s between two values of the same frame. */
  readonly maxUlp: number;
  /** The largest difference, in units of the `f32` ULP at the largest magnitude of the reference. */
  readonly maxPeakUlp: number;
  /** The root of the summed squared differences over the root of the summed squared reference. */
  readonly relRms: number;
  readonly count: number;
}

/** `a` against `b`, value by value; `r` is the reference, for the unit and the relative RMS. */
export function tailAgreement(a: Float32Array, b: Float32Array, r: ArrayLike<number>): TailAgreement {
  const ua = new Uint32Array(a.buffer, a.byteOffset, a.length);
  const ub = new Uint32Array(b.buffer, b.byteOffset, b.length);
  let peak = 0;
  let ref = 0;
  for (let i = 0; i < r.length; i++) {
    peak = Math.max(peak, Math.abs(r[i]!));
    ref += r[i]! * r[i]!;
  }
  let differ = 0;
  let largest = 0;
  let maxUlp = 0;
  let sq = 0;
  for (let i = 0; i < a.length; i++) {
    if (ua[i] !== ub[i]) {
      differ++;
      const d = Math.abs(a[i]! - b[i]!);
      largest = Math.max(largest, d);
      sq += d * d;
      maxUlp = Math.max(maxUlp, ulpDistance(a[i]!, b[i]!));
    }
  }
  return {
    differ,
    maxUlp,
    maxPeakUlp: largest / ulp32(peak),
    relRms: ref === 0 ? 0 : Math.sqrt(sq / ref),
    count: a.length,
  };
}

/** The values whose magnitude is below `SMALLEST_NORMAL`, 0 excepted: the subnormals. */
export function isSubnormal(v: number): boolean {
  return v !== 0 && Math.abs(v) < SMALLEST_NORMAL;
}

/** The seeded inputs of the kernel check, the same on every tier and on the oracle. */
export function checkInputs(): {
  input: Float32Array;
  spectrum: Float32Array;
  line: Float32Array;
  spectra: Float32Array;
  tail: Float32Array;
  block: Float32Array;
} {
  const draw = generator(CHECK_SEED);
  const fill = (n: number): Float32Array => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = 2 * draw() - 1;
    return out;
  };
  return {
    input: fill(FRAMES),
    spectrum: fill(POINTS * 2),
    line: fill(PARTITIONS * POINTS * 2),
    spectra: fill(PARTITIONS * POINTS * 2),
    tail: fill(FRAMES),
    block: fill(POINTS * 2),
  };
}

/** The slot `store` writes, and the newest block's slot of `accumulate`, in the kernel check. */
export const CHECK_SLOT = 5;
export const CHECK_HEAD = 37;
