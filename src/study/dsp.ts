// The signal primitives of the perceptual study (`docs/studies/frieren-perceptual/scripts/dsp.py` at
// commit `07670c9`), ported line by line: filters as the exact response of biquads on an FFT grid,
// zero-phase shaping of noise, the shaping of noise in time and frequency, modes, the Friedlander
// pulse, the placement of a source in a hall with its early reflections and Doppler shift, the
// late field, the loudness of ITU-R BS.1770 and the true peak. Each function keeps the name and the
// arithmetic of the study's, so `test/study.test.ts` can hold it to the study.

import { irfft, rfft, rfftfreq } from './fft.ts';
import { Rng, rng } from './rng.ts';

export const SR = 48000;
export const C_AIR = 343.0;

/** A mono signal. */
export type Mono = Float64Array;
/** A stereo signal: the left and the right channel. */
export type Stereo = [Float64Array, Float64Array];

export { rng, Rng };

/** Python's `round`: halves go to the even integer. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export const nsamp = (seconds: number): number => pyRound(seconds * SR);
export const lin = (d: number): number => 10 ** (d / 20);
export const db = (x: number): number => 20 * Math.log10(Math.max(Math.abs(x), 1e-12));

// ---------------------------------------------------------------- arrays

export const zeros = (n: number): Float64Array => new Float64Array(Math.max(0, n));
export const stereo = (n: number): Stereo => [zeros(n), zeros(n)];

/** numpy's `interp`: x sorted or not, xp increasing; the ends hold their values. */
export function interp(
  x: number,
  xp: ArrayLike<number>,
  fp: ArrayLike<number>,
  left?: number,
  right?: number,
): number {
  const n = xp.length;
  if (x < xp[0]!) return left ?? fp[0]!;
  if (x > xp[n - 1]!) return right ?? fp[n - 1]!;
  if (x === xp[n - 1]!) return fp[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xp[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const x0 = xp[lo]!;
  const x1 = xp[lo + 1]!;
  if (x1 === x0) return fp[lo + 1]!;
  const slope = (fp[lo + 1]! - fp[lo]!) / (x1 - x0);
  return slope * (x - x0) + fp[lo]!;
}

export function interpN(
  x: ArrayLike<number>,
  xp: ArrayLike<number>,
  fp: ArrayLike<number>,
  left?: number,
  right?: number,
): Float64Array {
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = interp(x[i]!, xp, fp, left, right);
  return y;
}

export const linspace = (a: number, b: number, n: number): Float64Array => {
  const y = new Float64Array(n);
  if (n === 1) y[0] = a;
  else {
    const step = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) y[i] = i * step + a;
    y[n - 1] = b;
  }
  return y;
};

export const peak = (x: ArrayLike<number>): number => {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]!));
  return p;
};

export const rmsOf = (x: ArrayLike<number>): number => {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i]! * x[i]!;
  return Math.sqrt(e / Math.max(1, x.length));
};

export const stdOf = (x: ArrayLike<number>): number => {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i]!;
  m /= x.length;
  let e = 0;
  for (let i = 0; i < x.length; i++) e += (x[i]! - m) ** 2;
  return Math.sqrt(e / x.length);
};

export const scale = (x: Float64Array, g: number): Float64Array => x.map((v) => v * g);

/** y[a:a+len(k)] += k, clipped to y. */
export function addAt(y: Float64Array, k: ArrayLike<number>, at: number, w = 1): void {
  const s = Math.max(0, at);
  const e = Math.min(y.length, at + k.length);
  for (let i = s; i < e; i++) y[i] = y[i]! + w * k[i - at]!;
}

// ---------------------------------------------------------------- envelopes

/** A piecewise-linear envelope through (seconds, value) points, n samples. */
export function envPoints(points: readonly (readonly [number, number])[], n: number): Float64Array {
  const ts = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = interp(i / SR, ts, vs);
  return y;
}

export function fade(x: Float64Array, fin = 0.003, fout = 0.003): Float64Array {
  const y = Float64Array.from(x);
  const half = Math.floor(y.length / 2);
  const a = Math.min(nsamp(fin), half);
  const b = Math.min(nsamp(fout), half);
  for (let i = 0; i < a; i++) y[i] = y[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / a));
  for (let i = 0; i < b; i++) {
    const j = y.length - b + i;
    y[j] = y[j]! * (0.5 + 0.5 * Math.cos((Math.PI * i) / b));
  }
  return y;
}

/** A zero-phase moving average, for control signals only. */
export function smooth(x: Float64Array, seconds: number): Float64Array {
  const k = Math.max(1, nsamp(seconds));
  if (k === 1) return x;
  const n = x.length;
  const pad = new Float64Array(n + 2 * k);
  pad.fill(x[0]!, 0, k);
  pad.set(x, k);
  pad.fill(x[n - 1]!, k + n);
  const c = new Float64Array(pad.length);
  let s = 0;
  for (let i = 0; i < pad.length; i++) c[i] = s += pad[i]!;
  // y = (c[k:] - c[:-k]) / k, then y[k//2 : k//2 + n]
  const y = new Float64Array(n);
  const o = Math.floor(k / 2);
  for (let i = 0; i < n; i++) y[i] = (c[k + o + i]! - c[o + i]!) / k;
  return y;
}

// ---------------------------------------------------------------- filters

export type Section = { b: [number, number, number]; a: [number, number] };

export function rbj(kind: string, f0: number, q = 0.7071, gainDb = 0): Section {
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const A = 10 ** (gainDb / 40);
  const alpha = sw / (2 * q);
  let b: number[];
  let a: number[];
  if (kind === 'lp') {
    b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2];
    a = [1 + alpha, -2 * cw, 1 - alpha];
  } else if (kind === 'hp') {
    b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2];
    a = [1 + alpha, -2 * cw, 1 - alpha];
  } else if (kind === 'bp') {
    b = [alpha, 0, -alpha];
    a = [1 + alpha, -2 * cw, 1 - alpha];
  } else if (kind === 'peak') {
    b = [1 + alpha * A, -2 * cw, 1 - alpha * A];
    a = [1 + alpha / A, -2 * cw, 1 - alpha / A];
  } else if (kind === 'ls' || kind === 'hs') {
    const al = (sw / 2) * Math.sqrt(2.0);
    const r = 2 * Math.sqrt(A) * al;
    if (kind === 'ls') {
      b = [
        A * (A + 1 - (A - 1) * cw + r),
        2 * A * (A - 1 - (A + 1) * cw),
        A * (A + 1 - (A - 1) * cw - r),
      ];
      a = [A + 1 + (A - 1) * cw + r, -2 * (A - 1 + (A + 1) * cw), A + 1 + (A - 1) * cw - r];
    } else {
      b = [
        A * (A + 1 + (A - 1) * cw + r),
        -2 * A * (A - 1 + (A + 1) * cw),
        A * (A + 1 + (A - 1) * cw - r),
      ];
      a = [A + 1 - (A - 1) * cw + r, 2 * (A - 1 - (A + 1) * cw), A + 1 - (A - 1) * cw - r];
    }
  } else throw new Error(`rbj: no filter "${kind}"`);
  return {
    b: [b[0]! / a[0]!, b[1]! / a[0]!, b[2]! / a[0]!],
    a: [a[1]! / a[0]!, a[2]! / a[0]!],
  };
}

/** Biquad sections applied exactly: circular convolution with enough zero padding. Keeps the length. */
export function iir(x: Float64Array, sections: readonly Section[], tail = 0.5): Float64Array {
  const n = x.length;
  const m = n + nsamp(tail);
  const nfft = 2 ** Math.ceil(Math.log2(m));
  const [re, im] = rfft(x, nfft);
  for (let k = 0; k < re.length; k++) {
    const w = (2 * Math.PI * k) / nfft;
    const z1r = Math.cos(w);
    const z1i = -Math.sin(w);
    const z2r = z1r * z1r - z1i * z1i;
    const z2i = 2 * z1r * z1i;
    let hr = 1;
    let hi = 0;
    for (const { b, a } of sections) {
      const nr = b[0] + b[1] * z1r + b[2] * z2r;
      const ni = b[1] * z1i + b[2] * z2i;
      const dr = 1 + a[0] * z1r + a[1] * z2r;
      const di = a[0] * z1i + a[1] * z2i;
      const dd = dr * dr + di * di;
      const qr = (nr * dr + ni * di) / dd;
      const qi = (ni * dr - nr * di) / dd;
      const tr = hr * qr - hi * qi;
      hi = hr * qi + hi * qr;
      hr = tr;
    }
    const xr = re[k]!;
    const xi = im[k]!;
    re[k] = xr * hr - xi * hi;
    im[k] = xr * hi + xi * hr;
  }
  return irfft(re, im, nfft).slice(0, n);
}

export const iirSt = (x: Stereo, sections: readonly Section[], tail = 0.5): Stereo => [
  iir(x[0], sections, tail),
  iir(x[1], sections, tail),
];

export const lp = (x: Float64Array, f: number, q = 0.7071): Float64Array =>
  iir(x, [rbj('lp', f, q)]);
export const hp = (x: Float64Array, f: number, q = 0.7071): Float64Array =>
  iir(x, [rbj('hp', f, q)]);
export const bp = (x: Float64Array, f: number, q = 1.0): Float64Array => iir(x, [rbj('bp', f, q)]);

/** Zero-phase magnitude shaping, for stationary noise only. `mag(f)` gives the gain at f Hz. */
export function spectral(x: Float64Array, mag: (f: number) => number): Float64Array {
  const n = x.length;
  const [re, im] = rfft(x);
  const f = rfftfreq(n, 1 / SR);
  for (let k = 0; k < re.length; k++) {
    const g = mag(f[k]!);
    re[k] = re[k]! * g;
    im[k] = im[k]! * g;
  }
  return irfft(re, im, n);
}

/** A smooth band-pass magnitude with Butterworth-like skirts. */
export function bandGain(f: number, lo: number, hi: number, order = 2): number {
  f = Math.max(f, 1e-3);
  return 1 / Math.sqrt(1 + (lo / f) ** (2 * order)) / Math.sqrt(1 + (f / hi) ** (2 * order));
}

/**
 * The shaping of a noise-like signal in time and frequency. `gain(t, freqs, out)` writes the gain
 * of each bin for the frame centred at t seconds.
 */
export function stftShape(
  x: Float64Array,
  gain: (t: number, freqs: Float64Array, out: Float64Array) => void,
  nfft = 1024,
  hop = 256,
): Float64Array {
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nfft);
  const n = x.length;
  const xp = new Float64Array(n + 2 * nfft);
  xp.set(x, nfft);
  const nf = 1 + Math.floor((xp.length - nfft) / hop);
  const fr = rfftfreq(nfft, 1 / SR);
  const g = new Float64Array(fr.length);
  const out = new Float64Array(xp.length);
  const frame = new Float64Array(nfft);
  for (let j = 0; j < nf; j++) {
    const o = hop * j;
    for (let i = 0; i < nfft; i++) frame[i] = xp[o + i]! * win[i]!;
    const [re, im] = rfft(frame);
    gain((hop * j + nfft / 2 - nfft) / SR, fr, g);
    for (let k = 0; k < re.length; k++) {
      re[k] = re[k]! * g[k]!;
      im[k] = im[k]! * g[k]!;
    }
    const y = irfft(re, im, nfft);
    for (let i = 0; i < nfft; i++) out[o + i] = out[o + i]! + y[i]! * win[i]!;
  }
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = out[nfft + i]! / 1.5;
  return r;
}

// ---------------------------------------------------------------- sources

export const white = (n: number, seed: number): Float64Array => rng(seed).normalN(n);

export const pink = (n: number, seed: number): Float64Array =>
  spectral(white(n, seed), (f) => 1 / Math.sqrt(Math.max(f, 20.0)));

/** A sum of damped sinusoids: the response of a struck solid. */
export function modal(
  freqs: ArrayLike<number>,
  amps: ArrayLike<number>,
  taus: ArrayLike<number>,
  dur: number,
  phases?: ArrayLike<number>,
): Float64Array {
  const n = nsamp(dur);
  const y = new Float64Array(n);
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]!;
    if (f >= 0.45 * SR) continue;
    const tau = taus[i]!;
    const a = amps[i]!;
    const m = Math.min(n, Math.trunc(9 * tau * SR) + 2);
    const ph = phases ? phases[i]! : 0;
    for (let k = 0; k < m; k++) {
      const t = k / SR;
      y[k] = y[k]! + a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t + ph);
    }
  }
  return y;
}

export const tauOf = (f: number, loss: number): number => 1.0 / (Math.PI * f * loss);

/** Convolution with a half-sine force pulse of tc seconds: the hardness of the contact. */
export function contact(y: Float64Array, tc: number): Float64Array {
  const k = Math.max(2, nsamp(tc));
  const p = new Float64Array(k);
  let sum = 0;
  for (let i = 0; i < k; i++) sum += p[i] = Math.sin((Math.PI * (i + 0.5)) / k);
  const out = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) {
    const v = y[i]!;
    if (v === 0) continue;
    const e = Math.min(k, y.length - i);
    for (let j = 0; j < e; j++) out[i + j] = out[i + j]! + (v * p[j]!) / sum;
  }
  return out;
}

/** Blast-wave pressure: an instant rise, then (1 - t/t+) exp(-t/t+). */
export function friedlander(dur: number, tplus: number, rise = 0.000125): Float64Array {
  const n = nsamp(dur);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] = (1 - t / tplus) * Math.exp(-t / tplus);
  }
  const k = Math.max(2, nsamp(rise));
  for (let i = 0; i < k && i < n; i++)
    y[i] = y[i]! * (0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / k));
  return y;
}

export function hann(n: number): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
  return y;
}

// ---------------------------------------------------------------- space

/** Read x at t - delay(t): the propagation delay, with Doppler when it changes. */
export function vdelay(x: Float64Array, delaySeconds: (i: number) => number): Float64Array {
  const n = x.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const idx = i - delaySeconds(i) * SR;
    if (idx < 0 || idx > n - 1) continue;
    const a = Math.floor(idx);
    const f = idx - a;
    y[i] = a + 1 < n ? x[a]! + (x[a + 1]! - x[a]!) * f : x[a]!;
  }
  return y;
}

export type Vec3 = readonly [number, number, number];
/** One position for the whole source, or one for each sample. */
export type Path =
  | Vec3
  | {
      readonly x: Float64Array;
      readonly y: Float64Array;
      readonly z: Float64Array;
    };

export const isFixed = (p: Path): p is Vec3 => Array.isArray(p);

export class Room {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly z: readonly [number, number];
  readonly listener: Vec3;
  readonly volume: number;
  readonly rtMid: number;
  readonly dc: number;
  readonly beta: Readonly<Record<string, number>>;

  constructor(
    x: readonly [number, number] = [-9, 9],
    y: readonly [number, number] = [0, 14],
    z: readonly [number, number] = [-16, 8],
    listener: Vec3 = [0, 1.6, 0],
    rtMid = 2.6,
    beta?: Record<string, number>,
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.listener = listener;
    this.volume = (x[1] - x[0]) * (y[1] - y[0]) * (z[1] - z[0]);
    this.rtMid = rtMid;
    this.dc = 0.057 * Math.sqrt(this.volume / rtMid);
    this.beta = beta ?? {
      x0: 0.85,
      x1: 0.85,
      y0: 0.45,
      y1: 0.8,
      z0: 0.85,
      z1: 0.85,
    };
  }

  /** The first-order image sources of a position. */
  planes(): [string, number, number][] {
    return [
      ['x0', 0, this.x[0]],
      ['x1', 0, this.x[1]],
      ['y0', 1, this.y[0]],
      ['y1', 1, this.y[1]],
      ['z0', 2, this.z[0]],
      ['z1', 2, this.z[1]],
    ];
  }
}

/** Equal-power stereo from an azimuth (rad, 0 in front, + to the right). */
export function panGains(az: number): [number, number] {
  const p = Math.min(1, Math.max(-1, Math.sin(az) * 0.9));
  const th = ((p + 1) * Math.PI) / 4;
  return [Math.cos(th), Math.sin(th)];
}

function pathAxes(pos: Path, n: number): [Float64Array, Float64Array, Float64Array] {
  if (isFixed(pos)) {
    return [
      new Float64Array(n).fill(pos[0]),
      new Float64Array(n).fill(pos[1]),
      new Float64Array(n).fill(pos[2]),
    ];
  }
  return [pos.x, pos.y, pos.z];
}

/**
 * A mono source at a position into direct stereo and early reflections. The direct sound is in sync
 * at the closest approach; elsewhere the change of the propagation delay gives the Doppler shift.
 */
export function place(
  x: Float64Array,
  pos: Path,
  room: Room,
  focusDb = 0,
  erDb: number | null = 0,
  doppler = true,
  minD = 1.0,
): [Stereo, Stereo] {
  const n = x.length;
  const [px, py, pz] = pathAxes(pos, n);
  const L = room.listener;
  const d = new Float64Array(n);
  let s = 0;
  let dmin = Infinity;
  let dmax = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = Math.hypot(px[i]! - L[0], py[i]! - L[1], pz[i]! - L[2]);
    d[i] = v;
    if (v < dmin) {
      dmin = v;
      s = i;
    }
    dmax = Math.max(dmax, v);
  }
  const dSync = d[s] ?? 0;
  const moving = doppler && dmax - dmin > 0.02;
  const xd = moving ? vdelay(x, (i) => (d[i]! - dSync) / C_AIR) : x;
  const g0 = lin(focusDb);
  const direct = stereo(n);
  for (let i = 0; i < n; i++) {
    const g = g0 / Math.max(d[i]!, minD);
    const [gl, gr] = panGains(Math.atan2(px[i]! - L[0], -(pz[i]! - L[2])));
    direct[0][i] = xd[i]! * g * gl;
    direct[1][i] = xd[i]! * g * gr;
  }
  const er = stereo(n);
  if (erDb !== null) {
    const ge = lin(focusDb + erDb);
    for (const [name, axis, plane] of room.planes()) {
      const ip: [Float64Array, Float64Array, Float64Array] = [px, py, pz];
      const mirrored = ip[axis]!.map((v) => 2 * plane - v);
      ip[axis] = mirrored;
      const di = new Float64Array(n);
      for (let i = 0; i < n; i++)
        di[i] = Math.hypot(ip[0][i]! - L[0], ip[1][i]! - L[1], ip[2][i]! - L[2]);
      const xi = vdelay(x, (i) => (di[i]! - dSync) / C_AIR);
      const beta = room.beta[name]!;
      for (let i = 0; i < n; i++) {
        const gi = (ge * beta) / Math.max(di[i]!, minD);
        const [l, r] = panGains(Math.atan2(ip[0][i]! - L[0], -(ip[2][i]! - L[2])));
        er[0][i] = er[0][i]! + xi[i]! * gi * l;
        er[1][i] = er[1][i]! + xi[i]! * gi * r;
      }
    }
  }
  return [direct, er];
}

/**
 * The late field: noise that dies with a decay time for each frequency, a different noise in each
 * ear. For a steady source its power equals the direct power at the room's critical distance.
 */
export function reverbIr(room: Room, seconds?: number, seed = 11, predelay = 0.03): Stereo {
  const rt = room.rtMid;
  const dur = seconds ?? rt * 1.6;
  const n = nsamp(dur);
  const lf = [63, 125, 500, 2000, 4000, 8000, 16000].map(Math.log2);
  const lv = [1.05, 1.08, 1.0, 0.82, 0.62, 0.36, 0.2];
  const out: Float64Array[] = [];
  for (let c = 0; c < 2; c++) {
    const r = rng(seed + c);
    const u = r.randomN(n);
    const sgn = r.signN(n);
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR + predelay;
      const p = Math.min(1.0, (4 * Math.PI * C_AIR ** 3 * t * t) / room.volume / SR);
      w[i] = u[i]! < p ? sgn[i]! / Math.sqrt(p) : 0;
    }
    const y = stftShape(w, (tf, fr, g) => {
      const tt = Math.max(tf, 0);
      for (let k = 0; k < fr.length; k++) {
        const f = Math.max(fr[k]!, 20.0);
        const rtf = rt * interp(Math.log2(f), lf, lv);
        g[k] = Math.exp((-6.908 * tt) / rtf) * (1 / (1 + (fr[k]! / 9000.0) ** 2)) ** 0.5;
      }
    });
    const k = nsamp(0.012);
    for (let i = 0; i < k; i++) y[i] = y[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / k));
    const full = new Float64Array(nsamp(predelay) + n);
    full.set(y, nsamp(predelay));
    out.push(full);
  }
  for (const ch of out) {
    let e = 0;
    for (const v of ch) e += v * v;
    const g = Math.sqrt(1.0 / (2 * room.dc ** 2)) / Math.sqrt(e);
    for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * g;
  }
  return [out[0]!, out[1]!];
}

/** x mono, ir stereo, to a stereo signal of len(x) + len(ir) - 1. */
export function convolve(x: Float64Array, ir: Stereo): Stereo {
  const n = x.length + ir[0].length - 1;
  const nfft = 2 ** Math.ceil(Math.log2(n));
  const [xr, xi] = rfft(x, nfft);
  return ir.map((h) => {
    const [hr, hi] = rfft(h, nfft);
    for (let k = 0; k < hr.length; k++) {
      const r = xr[k]! * hr[k]! - xi[k]! * hi[k]!;
      hi[k] = xr[k]! * hi[k]! + xi[k]! * hr[k]!;
      hr[k] = r;
    }
    return irfft(hr, hi, nfft).slice(0, n);
  }) as Stereo;
}

// ---------------------------------------------------------------- measures

const K1: Section = {
  b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
  a: [-1.69065929318241, 0.73248077421585],
};
const K2: Section = {
  b: [1.0, -2.0, 1.0],
  a: [-1.99004745483398, 0.99007225036621],
};

export const kWeight = (x: Float64Array): Float64Array => iir(x, [K1, K2], 0.2);

/** Momentary (0.4 s) or short-term (3 s) loudness of a stereo signal, LUFS, with block centres. */
export function loudnessBlocks(
  x: Stereo,
  window = 0.4,
  hop = 0.1,
): { t: Float64Array; l: Float64Array } {
  const k0 = kWeight(x[0]);
  const k1 = kWeight(x[1]);
  const n = k0.length;
  const c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) c[i + 1] = c[i]! + k0[i]! * k0[i]! + k1[i]! * k1[i]!;
  const w = nsamp(window);
  const h = nsamp(hop);
  const last = Math.max(1, n - w + 1);
  const count = Math.ceil(last / h);
  const t = new Float64Array(count);
  const l = new Float64Array(count);
  for (let j = 0; j < count; j++) {
    const s = j * h;
    const ms = (c[Math.min(n, s + w)]! - c[s]!) / w;
    t[j] = (s + w / 2) / SR;
    l[j] = -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));
  }
  return { t, l };
}

export function integratedLufs(x: Stereo): number {
  const { l } = loudnessBlocks(x, 0.4, 0.1);
  const p = l.map((v) => 10 ** ((v + 0.691) / 10));
  let s = 0;
  let c = 0;
  l.forEach((v, i) => {
    if (v > -70) {
      s += p[i]!;
      c++;
    }
  });
  if (c === 0) return -99.0;
  const rel = -0.691 + 10 * Math.log10(s / c) - 10;
  s = 0;
  c = 0;
  l.forEach((v, i) => {
    if (v > -70 && v > rel) {
      s += p[i]!;
      c++;
    }
  });
  return -0.691 + 10 * Math.log10(s / c);
}

/** The true peak in dB, four times oversampled through the spectrum. */
export function truePeakDb(x: readonly Float64Array[], over = 4): number {
  let pk = 0;
  for (const ch of x) {
    const n = ch.length;
    const [re, im] = rfft(ch);
    const y = irfft(re, im, over * n);
    for (const v of y) pk = Math.max(pk, Math.abs(v * over));
  }
  return 20 * Math.log10(Math.max(pk, 1e-12));
}

// ---------------------------------------------------------------- output

/** A 24-bit WAV with a TPDF dither of 1 LSB, as the study writes one. */
export function wav24(x: Stereo): Uint8Array {
  const n = x[0].length;
  const full = 2 ** 23 - 1;
  const r = rng(1234);
  const data = new Uint8Array(44 + n * 6);
  const v = new DataView(data.buffer);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => (data[o + i] = ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 6, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 6, true);
  v.setUint16(32, 6, true);
  v.setUint16(34, 24, true);
  str(36, 'data');
  v.setUint32(40, n * 6, true);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 2; c++) {
      const d = (r.next() - r.next()) / full;
      const q = Math.max(-full - 1, Math.min(full, Math.round((x[c]![i]! + d) * full)));
      const u = q < 0 ? q + 16777216 : q;
      data[o++] = u & 0xff;
      data[o++] = (u >> 8) & 0xff;
      data[o++] = (u >> 16) & 0xff;
    }
  return data;
}
