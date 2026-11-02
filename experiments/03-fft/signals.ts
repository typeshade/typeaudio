// Experiment 3 (docs/experiments.md, section 3): the inputs, the f64 reference and the measures.
// It imports no shader module, so the runner, the page, Node and the test share it.
//
// A transform is N complex points, each point two `f32`s, real then imaginary. One call of an
// entry transforms a batch, one workgroup for each signal of `SIGNALS`, in that order.

import { generator } from 'typeshade/random';

/** The sizes of the transforms. */
export const SIZES = [1024, 4096] as const;
export type Size = (typeof SIZES)[number];

/**
 * Where the twiddles come from: `sin` and `cos` of an `f32` on the device (variant A), a table the
 * host computes in doubles (B), or `sin` and `cos` of an emulated double on the device (C).
 */
export const VARIANTS = ['device', 'table', 'double'] as const;
export type Variant = (typeof VARIANTS)[number];

export const DIRECTIONS = ['forward', 'inverse'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * The inputs, one workgroup each:
 * - `noise`: complex white noise, both parts uniform in [-1, 1), from `typeshade/random`;
 * - `impulse`: one point of 1 at n = 1, whose transform is the twiddles themselves;
 * - `decay`: a sine of 0.0626 cycles per sample (3,005 Hz at 48 kHz) that falls by 2^-40 over the
 *   transform, from a peak of 1;
 * - `quiet`: the same sine at 2^-110, so that its tail and the inverse transform's output reach the
 *   subnormals, below 2^-126 (docs/compiler-asks.md, E).
 */
export const SIGNALS = ['noise', 'impulse', 'decay', 'quiet'] as const;
export type Signal = (typeof SIGNALS)[number];

/** The seed of the noise, a 32-bit word. */
export const SEED = 0x5eed0003;
/** The level of the quiet sine. */
export const QUIET = 2 ** -110;
/** The smallest normal `f32`. Below it, a nonzero `f32` is subnormal. */
export const SMALLEST_NORMAL = 2 ** -126;

/** The entry of each size and variant, by its name in `fft.shade.ts`. */
export const ENTRIES = {
  1024: { device: 'fftSmallDevice', table: 'fftSmallTable', double: 'fftSmallDouble' },
  4096: { device: 'fftLargeDevice', table: 'fftLargeTable', double: 'fftLargeDouble' },
} as const;
export type EntryName = (typeof ENTRIES)[Size][Variant];

/**
 * The input of a call: the batch for the forward transform, and for the inverse the reference's
 * forward transform of the batch, rounded to `f32`, so that every tier and the reference start from
 * the same `f32`s.
 */
export const inputOf = (n: Size, direction: Direction): Float32Array =>
  direction === 'forward' ? batch(n) : Float32Array.from(fft64(batch(n), n, 'forward'));

/** The inputs of the probes: subnormals for the factor 2^20, normal values for 2^-20, and a short array to wrap. */
export const PROBE_INPUTS = {
  subnormal: [2 ** -149, 2 ** -140, 2 ** -130, 2 ** -127, -(2 ** -135), 3 * 2 ** -149],
  normal: [2 ** -110, 2 ** -112, 2 ** -115, -(2 ** -108), 1.5 * 2 ** -110, 2 ** -105],
  wrap: [1, 2, 3, 4, 5],
} as const;

/** The uniform of a call: the sign of the exponent, and the scale of the output. */
export const transformOf = (direction: Direction, n: number): { sign: number; scale: number } =>
  direction === 'forward' ? { sign: -1, scale: 1 } : { sign: 1, scale: 1 / n };

/** One signal at `n` points, complex, rounded to `f32`. */
export function signal(which: Signal, n: number): Float32Array {
  const out = new Float32Array(2 * n);
  if (which === 'noise') {
    const draw = generator(SEED);
    for (let i = 0; i < 2 * n; i++) out[i] = 2 * draw() - 1;
  } else if (which === 'impulse') {
    out[2] = 1;
  } else {
    const level = which === 'quiet' ? QUIET : 1;
    for (let i = 0; i < n; i++) {
      out[2 * i] = level * 2 ** ((-40 * i) / n) * Math.sin(2 * Math.PI * 0.0626 * i);
    }
  }
  return out;
}

/** The batch of one size: every signal, one after another, as one call takes them. */
export const batch = (n: number): Float32Array => {
  const out = new Float32Array(2 * n * SIGNALS.length);
  SIGNALS.forEach((s, i) => out.set(signal(s, n), 2 * n * i));
  return out;
};

/** Variant B's table: `(cos(2πt / n), sin(2πt / n))` for `t` below n / 2, in doubles, rounded to `f32`. */
export function twiddleTable(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let t = 0; t < n / 2; t++) {
    out[2 * t] = Math.cos((2 * Math.PI * t) / n);
    out[2 * t + 1] = Math.sin((2 * Math.PI * t) / n);
  }
  return out;
}

/**
 * The reference: the same radix-2 transform in doubles, of every transform of `n` points in `x`,
 * each twiddle computed directly with `Math.cos` and `Math.sin`.
 */
export function fft64(x: ArrayLike<number>, n: number, direction: Direction): Float64Array {
  const { sign, scale } = transformOf(direction, n);
  const bits = Math.log2(n);
  const out = new Float64Array(x.length);
  for (let base = 0; base < x.length; base += 2 * n) {
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0, v = i; b < bits; b++, v >>= 1) r = (r << 1) | (v & 1);
      out[base + 2 * r] = x[base + 2 * i]!;
      out[base + 2 * r + 1] = x[base + 2 * i + 1]!;
    }
    for (let half = 1; half < n; half *= 2) {
      for (let k = 0; k < half; k++) {
        const angle = (sign * Math.PI * k) / half;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        for (let g = 0; g < n; g += 2 * half) {
          const t = base + 2 * (g + k);
          const u = t + 2 * half;
          const vr = out[u]! * wr - out[u + 1]! * wi;
          const vi = out[u]! * wi + out[u + 1]! * wr;
          const ur = out[t]!;
          const ui = out[t + 1]!;
          out[t] = ur + vr;
          out[t + 1] = ui + vi;
          out[u] = ur - vr;
          out[u + 1] = ui - vi;
        }
      }
    }
    for (let i = base; i < base + 2 * n; i++) out[i] = out[i]! * scale;
  }
  return out;
}

const word = new DataView(new ArrayBuffer(8));

/** The exponent of a nonzero finite double: `floor(log2(|v|))`, read from its bits. */
function exponent(v: number): number {
  word.setFloat64(0, v);
  const e = (word.getUint16(0) >> 4) & 0x7ff;
  if (e !== 0) return e - 1023;
  return Math.floor(Math.log2(Math.abs(v)));
}

/** The spacing of `f32`s at `v`: one unit in the last place of an `f32` of that magnitude. */
export function ulp32(v: number): number {
  if (v === 0 || Math.abs(v) < SMALLEST_NORMAL) return 2 ** -149;
  return 2 ** (exponent(v) - 23);
}

/**
 * How a tier's output stands against the reference, over one transform. An FFT's rounding error
 * scales with the transform's largest magnitude, not with each value, so the error is counted in
 * units of the `f32` ULP at that magnitude: the ULP at each value would grow without bound as the
 * value nears 0, where the error of an FFT does not shrink.
 */
export interface Accuracy {
  /** The largest error, in units of the `f32` ULP at the largest magnitude of the reference. */
  readonly maxPeakUlp: number;
  /** The mean error, in the same units. */
  readonly meanPeakUlp: number;
  /** The largest error, absolute. */
  readonly maxAbs: number;
  /** The root of the summed squared errors over the root of the summed squared reference. */
  readonly relRms: number;
  /** How many values are the reference rounded to the nearest `f32`. */
  readonly exact: number;
  /** How many values were compared. */
  readonly count: number;
}

/** `y` against the reference `r`, value by value. */
export function accuracy(y: ArrayLike<number>, r: ArrayLike<number>): Accuracy {
  let peak = 0;
  for (let i = 0; i < r.length; i++) peak = Math.max(peak, Math.abs(r[i]!));
  const unit = ulp32(peak);
  let maxAbs = 0;
  let sum = 0;
  let sq = 0;
  let ref = 0;
  let exact = 0;
  for (let i = 0; i < r.length; i++) {
    const e = Math.abs(y[i]! - r[i]!);
    maxAbs = Math.max(maxAbs, e);
    sum += e;
    sq += e * e;
    ref += r[i]! * r[i]!;
    if (Object.is(y[i], Math.fround(r[i]!))) exact++;
  }
  return {
    maxPeakUlp: maxAbs / unit,
    meanPeakUlp: sum / r.length / unit,
    maxAbs,
    relRms: ref === 0 ? 0 : Math.sqrt(sq / ref),
    exact,
    count: r.length,
  };
}

/** How two tiers' outputs differ: the values whose bits differ, and how far apart they are. */
export interface Agreement {
  /** The values whose bits differ, -0 against 0 included. */
  readonly differ: number;
  /** The largest difference, in units of the `f32` ULP at the largest magnitude of the reference. */
  readonly maxPeakUlp: number;
  readonly count: number;
}

/** `a` against `b`, value by value; `r` is the reference both transformed, for the unit. */
export function agreement(a: Float32Array, b: Float32Array, r: ArrayLike<number>): Agreement {
  const ua = new Uint32Array(a.buffer, a.byteOffset, a.length);
  const ub = new Uint32Array(b.buffer, b.byteOffset, b.length);
  let peak = 0;
  for (let i = 0; i < r.length; i++) peak = Math.max(peak, Math.abs(r[i]!));
  let differ = 0;
  let largest = 0;
  for (let i = 0; i < a.length; i++) {
    if (ua[i] !== ub[i]) {
      differ++;
      largest = Math.max(largest, Math.abs(a[i]! - b[i]!));
    }
  }
  return { differ, maxPeakUlp: largest / ulp32(peak), count: a.length };
}

/** The subnormal and zero values of an output, and of the reference rounded to `f32`. */
export interface Subnormals {
  /** Nonzero values below 2^-126 in magnitude. */
  readonly subnormal: number;
  /** Values of 0 or -0. */
  readonly zero: number;
}

export function subnormals(y: ArrayLike<number>): Subnormals {
  let subnormal = 0;
  let zero = 0;
  for (let i = 0; i < y.length; i++) {
    const v = Math.fround(y[i]!);
    if (v === 0) zero++;
    else if (Math.abs(v) < SMALLEST_NORMAL) subnormal++;
  }
  return { subnormal, zero };
}

/** How many values `oracle` holds as subnormals and `tier` holds as 0: the subnormals a tier flushed. */
export function flushed(tier: ArrayLike<number>, oracle: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < oracle.length; i++) {
    const o = oracle[i]!;
    if (o !== 0 && Math.abs(o) < SMALLEST_NORMAL && tier[i] === 0) n++;
  }
  return n;
}

/** An `f32` array as base64 of its bytes, which keeps every bit, -0 included, through JSON. */
export function toBase64(values: Float32Array): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

/** The `f32` array that `toBase64` wrote. */
export function fromBase64(text: string): Float32Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
