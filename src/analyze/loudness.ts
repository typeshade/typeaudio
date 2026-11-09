// Loudness, after ITU-R BS.1770: K-weighting, 400 ms gated blocks and a 4x oversampled true peak.

import { percentile } from './dsp.ts';

interface Biquad {
  b: [number, number, number];
  a: [number, number];
}

/** The two K-weighting filters at any sample rate (the coefficients of BS.1770 at 48 kHz, derived). */
export function kWeighting(sampleRate: number): Biquad[] {
  const shelf = (() => {
    const f0 = 1681.974450955533;
    const gain = 3.999843853973347;
    const q = 0.7071752369554196;
    const k = Math.tan((Math.PI * f0) / sampleRate);
    const vh = 10 ** (gain / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    return {
      b: [
        (vh + (vb * k) / q + k * k) / a0,
        (2 * (k * k - vh)) / a0,
        (vh - (vb * k) / q + k * k) / a0,
      ],
      a: [(2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0],
    } as Biquad;
  })();
  const high = (() => {
    const f0 = 38.13547087602444;
    const q = 0.5003270373238773;
    const k = Math.tan((Math.PI * f0) / sampleRate);
    const a0 = 1 + k / q + k * k;
    return {
      b: [1, -2, 1],
      a: [(2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0],
    } as Biquad;
  })();
  return [shelf, high];
}

/** One channel through the K-weighting filters. */
export function kWeigh(x: Float32Array, sampleRate: number): Float64Array {
  let y = Float64Array.from(x);
  for (const { b, a } of kWeighting(sampleRate)) {
    const out = new Float64Array(y.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b[0] * y[i]! + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1;
      x1 = y[i]!;
      y2 = y1;
      y1 = v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}

/** The loudness of a mean square sum, in LUFS. Silence is -Infinity. */
const lufs = (z: number): number => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity);

/** The weighted mean square of each window of `size` samples, stepping by `hop`, summed over channels. */
function windows(weighted: Float64Array[], size: number, hop: number): number[] {
  const n = weighted[0]?.length ?? 0;
  const prefix = weighted.map((w) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i]! + w[i]! * w[i]!;
    return p;
  });
  const out: number[] = [];
  const count = n < size ? 1 : Math.floor((n - size) / hop) + 1;
  for (let f = 0; f < count; f++) {
    const start = f * hop;
    const end = Math.min(n, start + size);
    let z = 0;
    for (const p of prefix) z += (p[end]! - p[start]!) / Math.max(1, end - start);
    out.push(z);
  }
  return out;
}

/**
 * The integrated loudness in LUFS (BS.1770-4): 400 ms blocks every 100 ms, the absolute gate at
 * -70 LUFS, the relative gate 10 LU under the mean of the blocks that passed. Every channel has
 * weight 1. Returns -Infinity when no block passes.
 */
export function integratedLoudness(channels: readonly Float32Array[], sampleRate: number): number {
  const weighted = channels.map((c) => kWeigh(c, sampleRate));
  const blocks = windows(weighted, Math.round(0.4 * sampleRate), Math.round(0.1 * sampleRate));
  const loud = blocks.filter((z) => lufs(z) > -70);
  if (loud.length === 0) return -Infinity;
  const relative = lufs(loud.reduce((s, z) => s + z, 0) / loud.length) - 10;
  const gated = loud.filter((z) => lufs(z) > relative);
  if (gated.length === 0) return -Infinity;
  return lufs(gated.reduce((s, z) => s + z, 0) / gated.length);
}

/** The floor of the short-term curve, in LUFS, for a silent window. */
export const CURVE_FLOOR = -70;

/**
 * The short-term loudness curve: one value in LUFS for each window of `window` seconds (3 s), every
 * `hop` seconds (1 s), without gating. A silent window reads `CURVE_FLOOR`.
 */
export function loudnessCurve(
  channels: readonly Float32Array[],
  sampleRate: number,
  window = 3,
  hop = 1,
): number[] {
  const weighted = channels.map((c) => kWeigh(c, sampleRate));
  return windows(weighted, Math.round(window * sampleRate), Math.round(hop * sampleRate)).map((z) =>
    Math.max(CURVE_FLOOR, lufs(z)),
  );
}

/** The contrast of a loudness curve in LU: its 95th percentile less its 5th. */
export const loudnessContrast = (curve: readonly number[]): number =>
  percentile(curve, 0.95) - percentile(curve, 0.05);

/** The taps on each side of an interpolated point. */
const HALF_TAPS = 16;

/**
 * The peak of the 4x oversampled signal that lies from each sample to the next, as a magnitude:
 * element `i` is the largest of `|x[i]|` and the three interpolated points after it. `truePeak`
 * is the largest of these in dBTP; the limiter of `src/master.ts` reads them sample by sample.
 */
export function peakEnvelope(x: Float32Array): Float32Array {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.abs(x[i]!);
  for (const phase of [0.25, 0.5, 0.75]) {
    const taps = new Float64Array(2 * HALF_TAPS);
    for (let j = 0; j < taps.length; j++) {
      const t = j - HALF_TAPS + 1 - phase;
      const s = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
      taps[j] = s * (0.5 + 0.5 * Math.cos((Math.PI * t) / (HALF_TAPS + 1)));
    }
    for (let i = 0; i < x.length - 1; i++) {
      let y = 0;
      for (let j = 0; j < taps.length; j++) {
        const m = i + j - HALF_TAPS + 1;
        if (m >= 0 && m < x.length) y += taps[j]! * x[m]!;
      }
      out[i] = Math.max(out[i]!, Math.abs(y));
    }
  }
  return out;
}

/** The true peak of one channel in dBTP, over a 4x oversampled signal (windowed sinc interpolation). */
export function truePeak(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const x of channels) {
    for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]!));
    for (const phase of [0.25, 0.5, 0.75]) {
      const taps = new Float64Array(2 * HALF_TAPS);
      for (let j = 0; j < taps.length; j++) {
        const t = j - HALF_TAPS + 1 - phase;
        const s = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
        taps[j] = s * (0.5 + 0.5 * Math.cos((Math.PI * t) / (HALF_TAPS + 1)));
      }
      for (let i = 0; i < x.length - 1; i++) {
        let y = 0;
        for (let j = 0; j < taps.length; j++) {
          const m = i + j - HALF_TAPS + 1;
          if (m >= 0 && m < x.length) y += taps[j]! * x[m]!;
        }
        peak = Math.max(peak, Math.abs(y));
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}
