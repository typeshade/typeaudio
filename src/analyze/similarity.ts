import { bands, powerSpectrum, toDb } from './dsp.ts';

const FRAME = 256;

/** Pearson correlation of two vectors, zero padded to one length. A constant vector reads 0. */
function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.max(a.length, b.length);
  const get = (v: ArrayLike<number>, i: number) => (i < v.length ? v[i]! : 0);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += get(a, i);
    mb += get(b, i);
  }
  ma /= n;
  mb /= n;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < n; i++) {
    const x = get(a, i) - ma;
    const y = get(b, i) - mb;
    ab += x * y;
    aa += x * x;
    bb += y * y;
  }
  const d = Math.sqrt(aa * bb);
  return d > 0 ? ab / d : 0;
}

/** The RMS of each frame of `FRAME` samples. */
function envelope(x: Float32Array): number[] {
  const out: number[] = [];
  for (let s = 0; s < x.length; s += FRAME) {
    let sum = 0;
    const end = Math.min(x.length, s + FRAME);
    for (let i = s; i < end; i++) sum += x[i]! * x[i]!;
    out.push(Math.sqrt(sum / (end - s)));
  }
  return out;
}

/** The third-octave levels in dB, relative to the loudest band and floored at -80 dB. */
function spectrum(x: Float32Array, sampleRate: number): number[] {
  const levels = bands(powerSpectrum(x), sampleRate).map((b) => toDb(b.density));
  const top = Math.max(...levels);
  return levels.map((v) => Math.max(v - top, -80));
}

export interface Similarity {
  /** The correlation of the two envelopes, aligned at their starts. */
  envelope: number;
  /** The correlation of the two third-octave spectra. */
  spectrum: number;
  /** The mean of the two. 1 is identical. */
  similarity: number;
}

/** The similarity of two short events, the measure of variation between repeats. */
export function eventSimilarity(a: Float32Array, b: Float32Array, sampleRate: number): Similarity {
  const e = pearson(envelope(a), envelope(b));
  const s = pearson(spectrum(a, sampleRate), spectrum(b, sampleRate));
  return { envelope: e, spectrum: s, similarity: (e + s) / 2 };
}
