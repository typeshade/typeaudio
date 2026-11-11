// The sound models of the perceptual study (`docs/studies/frieren-perceptual/scripts/sources.py` at
// commit `07670c9`), ported line by line. Each model keeps its name (in camel case), its
// parameters, its defaults and the order in which it draws its random numbers, so that with the
// shared generator (`rng.ts`) it gives the study's samples. The comments are the study's.

import {
  SR,
  addAt,
  bandGain,
  bp,
  contact,
  envPoints,
  fade,
  friedlander,
  hann,
  interp,
  lin,
  lp,
  modal,
  nsamp,
  peak,
  pink,
  rng,
  smooth,
  spectral,
  stdOf,
  stftShape,
  tauOf,
  white,
  zeros,
  type Rng,
  type Stereo,
} from './dsp.ts';

const G = 9.81;
const log = Math.log;
const exp = Math.exp;

export function norm(x: Float64Array): Float64Array {
  const p = peak(x) + 1e-12;
  return x.map((v) => v / p);
}

const meanSq = (x: ArrayLike<number>): number => {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i]! * x[i]!;
  return e / x.length;
};
const meanSqSt = (y: Stereo): number => (meanSq(y[0]) + meanSq(y[1])) / 2;
const scaleSt = (y: Stereo, g: number): Stereo => [y[0].map((v) => v * g), y[1].map((v) => v * g)];
const tilted = (lo: number, hi: number, order: number, tilt: number) => (f: number) =>
  bandGain(f, lo, hi, order) * (lo / Math.max(f, lo)) ** tilt;

/** The hall's own noise: diffuse, band-limited pink, breathing slowly. */
export function hallAir(dur: number, seed: number): Stereo {
  const n = nsamp(dur);
  const ch = [0, 1].map((c) => spectral(pink(n, seed + c), (f) => bandGain(f, 70, 1800, 1)));
  const m = smooth(white(n, seed + 7), 2.5);
  const mp = peak(m) + 1e-9;
  for (let i = 0; i < n; i++) {
    const g = lin((1.5 * m[i]!) / mp);
    ch[0]![i] = ch[0]![i]! * g;
    ch[1]![i] = ch[1]![i]! * g;
  }
  const y: Stereo = [ch[0]!, ch[1]!];
  return scaleSt(y, 1 / Math.sqrt(meanSqSt(y)));
}

/** Cloth: many small stick-slip events whose rate follows the motion. */
export function cloth(
  dur: number,
  seed: number,
  density = 320,
  fLo = 1200,
  fHi = 6500,
): Float64Array {
  const n = nsamp(dur);
  const r = rng(seed);
  const arc = new Float64Array(n);
  for (let i = 0; i < n; i++) arc[i] = Math.sin((Math.PI * (i + 0.5)) / n) ** 1.5;
  const cdf = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) cdf[i] = s += arc[i]!;
  for (let i = 0; i < n; i++) cdf[i] = cdf[i]! / s;
  const tAxis = new Float64Array(n);
  for (let i = 0; i < n; i++) tAxis[i] = i / SR;
  const count = r.poisson(density * dur * 0.6);
  const draws = r.randomN(count).sort();
  const times = draws.map((u) => interp(u, cdf, tAxis));
  const y = zeros(n);
  for (const t0 of times) {
    const L = nsamp(r.uniform(0.002, 0.009));
    const fc = exp(r.uniform(log(fLo), log(fHi)));
    const ph = r.uniform(0, 6.28);
    const nz = r.normalN(L);
    const h = hann(L);
    const a = r.exponential(1.0);
    const k = new Float64Array(L);
    for (let i = 0; i < L; i++)
      k[i] = (0.6 * Math.sin(2 * Math.PI * fc * (i / SR) + ph) + 0.4 * nz[i]!) * h[i]! * a;
    addAt(y, k.subarray(0, Math.max(0, Math.min(n, nsamp(t0) + L) - nsamp(t0))), nsamp(t0));
  }
  const z = spectral(y, (f) => bandGain(f, fLo * 0.7, fHi * 1.2, 2));
  for (let i = 0; i < n; i++) z[i] = z[i]! * arc[i]! ** 0.5;
  return norm(z);
}

/** Brittle fracture: a main crack and an avalanche of smaller ones (rate k/(t+c), power-law sizes). */
export function fracture(
  seed: number,
  fLo: number,
  fHi: number,
  loss: number,
  { dur = 0.5, nModes = 90, kRate = 12.0, c = 0.012, hard = 0.00015, tilt = 0.5, burst = 0.9 } = {},
): Float64Array {
  const r = rng(seed);
  const fm = r.uniformN(log(fLo), log(fHi), nModes).map(exp);
  const taus = fm.map((f) => tauOf(f, loss));
  const n = nsamp(dur);
  const y = zeros(n);
  const am = r.uniformN(0.3, 1, nModes).map((a, i) => a * (fLo / fm[i]!) ** tilt);
  addAt(y, norm(modal(fm, am, taus, dur)), 0);
  const nb = nsamp(0.03);
  const nzb = r.normalN(nb);
  for (let i = 0; i < nb; i++) nzb[i] = nzb[i]! * exp(-i / SR / 0.003);
  const bn = spectral(nzb, (f) => bandGain(f, fLo, fHi, 2) * (fLo / Math.max(f, fLo)) ** tilt);
  addAt(y, norm(bn), 0, burst);
  const span = dur * 0.8;
  const count = r.poisson(kRate * log(1 + span / c));
  const times = r.randomN(count).map((u) => c * ((1 + span / c) ** u - 1));
  const amin = 0.05;
  const amps = r.randomN(count).map((u) => amin / (1 - u * (1 - amin)));
  for (let j = 0; j < count; j++) {
    const t0 = times[j]!;
    const a = amps[j]!;
    const fe = r.uniformN(log(fLo), log(fHi), 5).map(exp);
    const ae = r.uniformN(0.3, 1, 5).map((v, i) => a * v * (fLo / fe[i]!) ** tilt);
    const k = modal(
      fe,
      ae,
      fe.map((f) => tauOf(f, loss)),
      Math.min(dur - t0, 0.25),
    );
    addAt(y, k, nsamp(t0));
  }
  const z = norm(contact(y, hard));
  return z.map((v) => Math.tanh(2.0 * v) / 2.0);
}

/** Aerodynamic noise of a moving body: band limit and level follow the speed (power ~ U^6). */
export function aero(
  speed: Float64Array,
  seed: number,
  u0 = 10.0,
  kFc = 55.0,
  fmin = 120.0,
  fmax = 5000.0,
  cap = 4.0,
): Float64Array {
  const n = speed.length;
  const tAxis = new Float64Array(n).map((_, i) => i / SR);
  return stftShape(white(n, seed), (tf, fr, g) => {
    const u = interp(tf, tAxis, speed);
    const fc = Math.min(fmax, Math.max(fmin, kFc * u));
    const amp = Math.min((u / u0) ** 3, cap);
    for (let k = 0; k < fr.length; k++)
      g[k] =
        amp / Math.sqrt(1 + (fr[k]! / fc) ** 4) / Math.sqrt(1 + (60.0 / Math.max(fr[k]!, 1)) ** 4);
  });
}

/** Fine dry grains: dust, sand, the last remnants. */
export function sand(
  dur: number,
  seed: number,
  rate0 = 2500.0,
  tau = 0.8,
  fLo = 2500.0,
  fHi = 9000.0,
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const q = 1 - exp(-dur / tau);
  const count = r.poisson(rate0 * tau * q);
  const times = r.randomN(count).map((u) => -tau * log(1 - u * q));
  const y = zeros(n);
  const L = nsamp(0.0015);
  const k = new Float64Array(L);
  for (const t0 of times) {
    const f = exp(r.uniform(log(fLo), log(fHi)));
    const ph = r.uniform(0, 6.28);
    const a = r.exponential(1.0);
    for (let i = 0; i < L; i++) {
      const tt = i / SR;
      k[i] = Math.sin(2 * Math.PI * f * tt + ph) * exp(-tt / 0.0004) * a;
    }
    const s = nsamp(t0);
    addAt(y, k.subarray(0, Math.max(0, Math.min(n, s + L) - s)), s);
  }
  return norm(y);
}

export function wideNoise(
  dur: number,
  seed: number,
  lo: number,
  hi: number,
  order = 2,
  pinkish = true,
): Stereo {
  const n = nsamp(dur);
  return [0, 1].map((c) => {
    const x = spectral(
      white(n, seed + c),
      (f) => bandGain(f, lo, hi, order) / (pinkish ? Math.sqrt(Math.max(f, 50.0)) : 1.0),
    );
    const g = 1 / Math.sqrt(meanSq(x));
    return x.map((v) => v * g);
  }) as Stereo;
}

/** A soft clip of a hit normalised to its peak. */
export function saturate(x: Float64Array, drive = 2.2): Float64Array {
  return norm(x).map((v) => Math.tanh(drive * v) / drive);
}

/** A modulator with no period: band-limited noise, unit deviation, clipped to +-1.5 and scaled to +-1. */
export function irregular(n: number, seed: number, lo = 10.0, hi = 90.0): Float64Array {
  const m = spectral(white(n, seed), (f) => bandGain(f, lo, hi, 2));
  const s = stdOf(m) + 1e-12;
  return m.map((v) => Math.min(1.5, Math.max(-1.5, v / s)) / 1.5);
}

/**
 * The red material without a rotor: a low rumble, a roar whose band narrows and rises with the
 * tension, and a crackling surface. Every modulation is irregular. `tension` is in 0..1.
 */
export function redMaterial(
  n: number,
  tension: Float64Array,
  seed: number,
): [Float64Array, Float64Array, Float64Array] {
  const tAxis = new Float64Array(n).map((_, i) => i / SR);
  const shared = irregular(n, seed + 20);
  const i21 = irregular(n, seed + 21);
  const i22 = irregular(n, seed + 22, 15, 120);
  const m1 = new Float64Array(n);
  const m2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const depth = 0.5 + 0.35 * tension[i]!;
    m1[i] = 1 + depth * (0.6 * shared[i]! + 0.4 * i21[i]!);
    m2[i] = 1 + depth * (0.6 * shared[i]! + 0.4 * i22[i]!);
  }
  let rumble = spectral(pink(n, seed), (f) => bandGain(f, 38, 150, 2));
  const gr = 1 / Math.sqrt(meanSq(rumble));
  rumble = rumble.map((v, i) => v * gr * m1[i]!);
  let roar = stftShape(white(n, seed + 1), (tf, fr, g) => {
    const ten = interp(tf, tAxis, tension);
    const fc = 480 * (1100 / 480) ** ten;
    const wd = 1.1 - 0.7 * ten;
    for (let k = 0; k < fr.length; k++)
      g[k] = exp(-0.5 * (Math.log2(Math.max(fr[k]!, 1) / fc) / wd) ** 2);
  });
  const go = 1 / Math.sqrt(meanSq(roar));
  roar = roar.map((v, i) => v * go * m2[i]!);
  const r = rng(seed + 2);
  const u = r.randomN(n);
  const amp = r.uniformN(0.4, 1.0, n);
  const sg = r.signN(n);
  const cr0 = new Float64Array(n);
  for (let i = 0; i < n; i++)
    cr0[i] = u[i]! < (250 + 650 * tension[i]!) / SR ? amp[i]! * sg[i]! : 0;
  const cr = spectral(cr0, (f) => bandGain(f, 2200, 9000, 2));
  const gc = 1 / (Math.sqrt(meanSq(cr)) + 1e-12);
  const i23 = irregular(n, seed + 23, 2, 12);
  const crackle = cr.map((v, i) => v * gc * (1 + 0.5 * i23[i]!));
  return [rumble, roar, crackle];
}

/** A noise burst between lo and hi Hz with an exponential decay: an impact with no pitch. */
export function burst(
  seed: number,
  lo: number,
  hi: number,
  tau: number,
  { dur, rise = 0.0005, order = 2 }: { dur?: number; rise?: number; order?: number } = {},
): Float64Array {
  return shapedBurst(seed, tau, dur, rise, (f) => bandGain(f, lo, hi, order));
}

function shapedBurst(
  seed: number,
  tau: number,
  dur: number | undefined,
  rise: number,
  mag: (f: number) => number,
): Float64Array {
  const d = dur || tau * 8;
  const n = nsamp(d);
  const x = spectral(white(n + nsamp(0.05), seed), mag);
  const k = Math.max(2, nsamp(rise));
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let e = exp(-i / SR / tau);
    if (i < k) e *= 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / k);
    y[i] = x[i]! * e;
  }
  return norm(y);
}

/** An overpressure with no pitch: the Friedlander pulse, a low noise body, a mid slap. */
export function whump(
  seed: number,
  tplus = 0.0035,
  dur = 0.5,
): [Float64Array, Float64Array, Float64Array] {
  const front = friedlander(dur, tplus);
  const low = zeros(nsamp(dur));
  addAt(low, burst(seed, 35, 130, 0.045, { rise: 0.002 }).subarray(0, low.length), 0);
  const slap = zeros(nsamp(dur));
  addAt(slap, burst(seed + 1, 250, 2600, 0.016).subarray(0, slap.length), 0);
  return [front, low, slap];
}

/** A fragment of radius a landing at speed v: a clack around ka = 1, a low thud, a hard tick. */
export function stoneImpact(a: number, v: number, r: Rng): Float64Array {
  const fpk = Math.min(54.6 / a, 6000.0);
  const seed = r.integers(1, 2 ** 31 - 1);
  const clack = burst(seed, 0.5 * fpk, 2.6 * fpk, 0.004 + 0.03 * a);
  const thud = burst(seed + 1, 55, 320, 0.02 + 0.08 * a, {
    rise: 0.002 + 0.01 * a,
  });
  const tick = burst(seed + 2, 2200, 8000, 0.0009, { dur: 0.006 });
  const y = zeros(Math.max(clack.length, thud.length));
  addAt(y, clack, 0);
  addAt(y, thud, 0, (a / 0.1) ** 2);
  addAt(y, tick, 0, 0.5 * (1 + (a / 0.1) ** 2) * Math.min(1.0, v / 6.0));
  const g = a ** 1.5 * v;
  return y.map((s) => s * g);
}

/** A fragment that lands on rubble: one impact, sometimes one more contact, and a scatter of pieces. */
export function rockFall(a: number, h: number, seed: number): Float64Array {
  const r = rng(seed);
  const v = Math.sqrt(2 * G * h);
  const y = zeros(nsamp(0.9));
  const put = (k: Float64Array, t0: number) => addAt(y, k, nsamp(t0));
  put(stoneImpact(a, v, r), 0.0);
  if (r.random() < 0.5) {
    const a2 = a * r.uniform(0.5, 0.8);
    const v2 = v * r.uniform(0.2, 0.4);
    const k = stoneImpact(a2, v2, r);
    put(k, r.uniform(0.08, 0.26));
  }
  const count = r.poisson(4 + 30 * a);
  for (let j = 0; j < count; j++) {
    const t0 = 0.03 + r.exponential(0.11);
    const a3 = r.uniform(0.008, 0.03);
    const v3 = v * r.uniform(0.1, 0.35) * exp(-t0 / 0.2);
    put(stoneImpact(a3, v3, r), t0);
  }
  return y;
}

/** A swish: noise whose band moves from f0 to f1 Hz, with a bell-shaped level. */
export function bandSweep(
  dur: number,
  seed: number,
  f0: number,
  f1: number,
  widthOct = 0.9,
  attack = 0.3,
): Float64Array {
  const n = nsamp(dur);
  const y = stftShape(white(n, seed), sweepGain(dur, f0, f1, widthOct));
  const g = 1 / Math.sqrt(meanSq(y));
  return y.map((v, i) => v * g * bell(i / SR / dur, attack));
}

/** `band_sweep(..., wide=True)`. */
export function bandSweepWide(
  dur: number,
  seed: number,
  f0: number,
  f1: number,
  widthOct = 0.9,
  attack = 0.3,
): Stereo {
  const n = nsamp(dur);
  const y: Stereo = [0, 1].map((c) =>
    stftShape(white(n, seed + c), sweepGain(dur, f0, f1, widthOct)),
  ) as Stereo;
  const g = 1 / Math.sqrt(meanSqSt(y));
  return y.map((ch) => ch.map((v, i) => v * g * bell(i / SR / dur, attack))) as Stereo;
}

const sweepGain =
  (dur: number, f0: number, f1: number, w: number) =>
  (tf: number, fr: Float64Array, g: Float64Array) => {
    const u = Math.min(1, Math.max(0, tf / dur));
    const fc = f0 * (f1 / f0) ** u;
    for (let k = 0; k < fr.length; k++)
      g[k] = exp(-0.5 * (Math.log2(Math.max(fr[k]!, 1) / fc) / w) ** 2);
  };
const bell = (u: number, attack: number): number =>
  u < attack
    ? Math.sin((0.5 * Math.PI * u) / attack) ** 2
    : Math.cos((0.5 * Math.PI * (u - attack)) / (1 - attack)) ** 2;

/** Sparks: a dense crackle above 3 kHz that dies away. */
export function sizzle(
  dur: number,
  seed: number,
  tau: number,
  rate = 900.0,
  fLo = 3000.0,
  fHi = 11000.0,
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const u = r.randomN(n);
  const amp = r.uniformN(0.3, 1.0, n);
  const sg = r.signN(n);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++)
    x[i] = u[i]! < (rate * exp(-i / SR / tau)) / SR ? amp[i]! * sg[i]! : 0;
  return norm(spectral(x, (f) => bandGain(f, fLo, fHi, 2)));
}

/** Stone blocks that fall over and onto one another: impacts at random times, rate(t) a second. */
export function tumble(
  dur: number,
  seed: number,
  rate: (t: number) => number,
  sizes: readonly [number, number] = [0.1, 0.3],
  speed: readonly [number, number] = [3.0, 8.0],
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const y = zeros(n + nsamp(0.6));
  let t = 0.0;
  let rmax = -Infinity;
  for (let i = 0; i < 50; i++) rmax = Math.max(rmax, rate(i * (dur / 49)));
  for (;;) {
    t += r.exponential(1.0 / rmax);
    if (t >= dur) break;
    if (r.random() > rate(t) / rmax) continue;
    const a = exp(r.uniform(log(sizes[0]), log(sizes[1])));
    const v = r.uniform(speed[0], speed[1]);
    addAt(y, stoneImpact(a, v, r), nsamp(t));
  }
  return y.slice(0, n + nsamp(0.4));
}

/** Crumbling stone: mid-band noise with an irregular, fast flutter. */
export function gravel(dur: number, seed: number, lo = 300.0, hi = 3500.0): Float64Array {
  const n = nsamp(dur);
  const x = spectral(white(n, seed), (f) => bandGain(f, lo, hi, 2));
  const m = irregular(n, seed + 1, 8, 60);
  const g = 1 / Math.sqrt(meanSq(x));
  return x.map((v, i) => v * g * Math.max(0.55 + 0.45 * m[i]!, 0.05));
}

/** Wind in hair and cloth after a blast: wide noise in slow, irregular gusts. */
export function wind(dur: number, seed: number, lo = 250.0, hi = 3000.0): Stereo {
  const n = nsamp(dur);
  const ch = [0, 1].map((c) => {
    const x = spectral(pink(n, seed + c), (f) => bandGain(f, lo, hi, 2));
    const g = 1 / Math.sqrt(meanSq(x));
    return x.map((v) => v * g);
  });
  const gs = smooth(white(n, seed + 5), 0.5);
  const gp = peak(gs) + 1e-12;
  for (let i = 0; i < n; i++) {
    const g = lin((4.0 * gs[i]!) / gp);
    ch[0]![i] = ch[0]![i]! * g;
    ch[1]![i] = ch[1]![i]! * g;
  }
  return [ch[0]!, ch[1]!];
}

const cumPhase = (inc: (i: number) => number, n: number): Float64Array => {
  const y = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) y[i] = (2 * Math.PI * (s += inc(i))) / SR;
  return y;
};

/** A tone that lasts: a cluster of partials, each with its own slow, irregular drift of pitch and level. */
export function voice(
  dur: number,
  seed: number,
  freqs: readonly number[],
  { wander = 0.012, rate = 4.0, tilt = 0.7, breath = 0.35 } = {},
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const y = zeros(n);
  freqs.forEach((f, i) => {
    const w0 = spectral(white(n, seed + 31 * (i + 1)), (q) => bandGain(q, 0.2, rate, 1));
    const ws = stdOf(w0) + 1e-12;
    const ph = cumPhase((k) => f * (1 + (wander * w0[k]!) / ws), n);
    const a0 = spectral(white(n, seed + 57 * (i + 1)), (q) => bandGain(q, 0.1, 2.0, 1));
    const ap = peak(a0) + 1e-12;
    const off = r.uniform(0, 6.28);
    const tw = (i + 1) ** tilt;
    for (let k = 0; k < n; k++)
      y[k] = y[k]! + ((1 + (breath * a0[k]!) / ap) * Math.sin(ph[k]! + off)) / tw;
  });
  return norm(y);
}

/** A cluster whose pitch moves from f0 to f1 Hz over the whole duration. */
export function glide(
  dur: number,
  seed: number,
  f0: number,
  f1: number,
  { ratios = [1.0, 1.5, 2.0] as readonly number[], wander = 0.006, shape = 1.0, tilt = 0.8 } = {},
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const base = new Float64Array(n).map((_, i) => f0 * (f1 / f0) ** ((i / n) ** shape));
  const y = zeros(n);
  ratios.forEach((q, i) => {
    const w0 = spectral(white(n, seed + 13 * (i + 1)), (z) => bandGain(z, 0.3, 5.0, 1));
    const ws = stdOf(w0) + 1e-12;
    const ph = cumPhase((k) => base[k]! * q * (1 + (wander * w0[k]!) / ws), n);
    const off = r.uniform(0, 6.28);
    const tw = (i + 1) ** tilt;
    for (let k = 0; k < n; k++) y[k] = y[k]! + Math.sin(ph[k]! + off) / tw;
  });
  return norm(y);
}

/** Separate sharp pops at random times (sparks that fly off): each a few milliseconds, no pitch. */
export function pops(
  dur: number,
  seed: number,
  rate: number,
  fLo = 2000.0,
  fHi = 8000.0,
  tau = 0.0012,
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const y = zeros(n);
  let t = r.exponential(1.0 / rate);
  const L = nsamp(tau * 8);
  while (t < dur) {
    const nz = r.normalN(L);
    const a = r.uniform(0.35, 1.0);
    const k = nz.map((v, i) => v * exp(-i / SR / tau) * a);
    const s = nsamp(t);
    addAt(y, k.subarray(0, Math.max(0, Math.min(n, s + L) - s)), s);
    t += r.exponential(1.0 / rate);
  }
  return norm(spectral(y, (f) => bandGain(f, fLo, fHi, 2)));
}

/** What comes back from a far wall: the same sound, duller. */
export function slap(sig: Float64Array, cutoff = 1800.0): Float64Array {
  const x = zeros(sig.length + nsamp(0.05));
  x.set(sig);
  return lp(x, cutoff);
}

/** A noise burst between lo and hi Hz whose spectrum falls toward the top (amplitude ~ f^-tilt). */
export function tiltedBurst(
  seed: number,
  lo: number,
  hi: number,
  tau: number,
  { tilt = 0.8, dur, rise = 0.0005 }: { tilt?: number; dur?: number; rise?: number } = {},
): Float64Array {
  return shapedBurst(seed, tau, dur, rise, tilted(lo, hi, 2, tilt));
}

/** A crack through a thick solid of about `size` metres: a low knock, a damped fracture, a dry edge. */
export function heavyCrack(
  seed: number,
  { size = 0.5, dur = 0.5, kRate = 10.0, loss = 0.03, bright = 0.5 } = {},
): Float64Array {
  const fk = 54.6 / size;
  const top = Math.min(700.0, Math.max(250.0, 2.6 * fk));
  const body = fracture(seed, top, 5000.0, loss, {
    dur,
    kRate,
    tilt: 0.6,
    hard: 0.0004,
  });
  const knock = burst(seed + 1, Math.max(28.0, 0.5 * fk), top, 0.04 + 0.1 * Math.min(size, 2.0), {
    rise: 0.003,
  });
  const edge = tiltedBurst(seed + 2, 900.0, 7000.0, 0.012, { tilt: 0.5 });
  const y = zeros(Math.max(body.length, knock.length));
  addAt(y, body, 0);
  addAt(y, knock, 0, 0.7);
  addAt(y, edge, 0, bright);
  return norm(y);
}

/** A small crack in stone: a noise burst from ka = 1 up to 4.5 kHz, a low knock under it, a dry edge. */
export function stoneCrack(r: Rng, size = 0.3, bright = 0.4): Float64Array {
  const fk = 54.6 / size;
  const seed = r.integers(1, 2 ** 31 - 1);
  const top = tiltedBurst(seed, Math.max(80.0, fk), 4500.0, 0.008 + 0.03 * size);
  const knock = burst(
    seed + 1,
    Math.max(35.0, 0.5 * fk),
    Math.min(700.0, 2.6 * fk),
    0.02 + 0.1 * size,
    { rise: 0.002 },
  );
  const edge = burst(seed + 2, 1500.0, 7000.0, 0.003, { dur: 0.02 });
  const y = zeros(Math.max(top.length, knock.length));
  addAt(y, top, 0);
  addAt(y, knock, 0, 1.2);
  addAt(y, edge, 0, bright);
  return norm(y);
}

/** A large solid under stress: stick and slip through wide low resonances. */
export function groan(
  dur: number,
  seed: number,
  {
    rLo = 110.0,
    rHi = 240.0,
    res = [140.0, 260.0, 470.0] as readonly number[],
    jitter = 0.25,
    q = 2.5,
  } = {},
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const path = irregular(n, seed + 1, 0.7, 5.0).map((m) => rLo * (rHi / rLo) ** (0.5 + 0.5 * m));
  const y = zeros(n + nsamp(0.1));
  let t = r.uniform(0, 0.01);
  while (t < dur) {
    const i = Math.min(n - 1, nsamp(t));
    y[i] = y[i]! + r.uniform(0.4, 1.0);
    t += (1.0 / path[i]!) * (1 + jitter * r.uniform(-1, 1));
  }
  const out = zeros(y.length);
  res.forEach((f, k) => addAt(out, bp(y, f, q), 0, 1 / (k + 1) ** 0.5));
  return norm(fade(out, 0.03, 0.08));
}

/** Ice or stone that is crushed: dense noise with a fast, irregular flutter and a decay. */
export function crush(
  dur: number,
  seed: number,
  tau: number,
  lo = 700.0,
  hi = 6000.0,
): Float64Array {
  const n = nsamp(dur);
  const x = spectral(white(n, seed), tilted(lo, hi, 2, 0.4));
  const m = irregular(n, seed + 1, 15, 90);
  const k = nsamp(0.003);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let e = exp(-i / (tau * SR));
    if (i < k) e *= k === 1 ? 0 : i / (k - 1);
    y[i] = x[i]! * Math.max(0.5 + 0.5 * m[i]!, 0.05) * e;
  }
  return norm(y);
}

/** The third-octave levels of a torrent of energy, dB against the strongest band (Hz, dB). */
export const BEAM_CURVE: readonly (readonly [number, number])[] = [
  [25, -18],
  [31, -13],
  [39, -6],
  [50, -4.5],
  [62, -4],
  [79, -1],
  [125, -1],
  [250, -2],
  [500, -2],
  [800, -2.5],
  [1000, -4],
  [2000, -6],
  [3175, -9],
  [4000, -12.5],
  [5040, -15.5],
  [6350, -20],
  [8000, -24.5],
  [10079, -27],
  [12699, -30],
];

/** Noise whose third-octave levels follow `curve`. */
export function curveNoise(n: number, seed: number, curve = BEAM_CURVE): Float64Array {
  const lf = curve.map((c) => log(c[0]));
  const lv = curve.map((c) => c[1]);
  return spectral(white(n, seed), (f0) => {
    const f = Math.max(f0, 1.0);
    const t = interp(log(f), lf, lv, lv[0]! - 30, lv[lv.length - 1]! - 12);
    return 10 ** ((t - 10 * Math.log10(f)) / 20);
  });
}

/** A level that wanders with no period: a gain with a deviation of sd_db. */
export function levelWalk(
  n: number,
  seed: number,
  sdDb: number,
  lo: number,
  hi: number,
): Float64Array {
  const m = spectral(white(n, seed), (f) => bandGain(f, lo, hi, 1));
  const s = stdOf(m) + 1e-12;
  return m.map((v) => 10 ** ((sdDb * Math.min(2.5, Math.max(-2.5, v / s))) / 20));
}

export const TURBULENCE_BANDS: readonly (readonly [number, number, number, number, number])[] = [
  [25.0, 110.0, 1.0, 0.4, 6.0],
  [110.0, 900.0, 1.3, 0.5, 8.0],
  [900.0, 4000.0, 5.5, 1.0, 11.0],
  [4000.0, 13000.0, 6.5, 1.0, 13.0],
];

/** A torrent as turbulence: one spectrum, cut into bands, each with its own noise and wandering level. */
export function turbulence(
  dur: number,
  seed: number,
  curve = BEAM_CURVE,
  bands = TURBULENCE_BANDS,
  corr = 0.5,
): Stereo[] {
  const n = nsamp(dur);
  const a = Math.sqrt(corr);
  const b = Math.sqrt(1 - corr);
  return bands.map(([lo, hi, sd, rLo, rHi], i) => {
    const p = [0, 1, 2].map((c) =>
      spectral(curveNoise(n, seed + 10 * i + c, curve), (f) => bandGain(f, lo, hi, 4)),
    );
    const walk = levelWalk(n, seed + 10 * i + 5, sd, rLo, rHi);
    return [
      p[0]!.map((v, k) => (a * v + b * p[1]![k]!) * walk[k]!),
      p[0]!.map((v, k) => (a * v + b * p[2]![k]!) * walk[k]!),
    ] as Stereo;
  });
}

/** A breath with a pitch, as wind in a wide pipe: narrow bands of noise whose centres wander. */
export function howl(
  dur: number,
  seed: number,
  centres: readonly number[],
  q = 7.0,
  wander = 0.05,
  rate = 1.5,
): Float64Array {
  const n = nsamp(dur);
  const y = zeros(n);
  centres.forEach((fc, i) => {
    const bw = fc / q;
    const ab = [1, 2].map((c) =>
      spectral(white(n, seed + 7 * i + c), (f) => bandGain(f, 0.01, bw / 2, 2)),
    );
    const w0 = spectral(white(n, seed + 7 * i + 3), (f) => bandGain(f, 0.1, rate, 1));
    const ws = stdOf(w0) + 1e-12;
    const ph = cumPhase((k) => fc * 2 ** (wander * Math.min(2.5, Math.max(-2.5, w0[k]! / ws))), n);
    const s0 = stdOf(ab[0]!) + 1e-12;
    const g = 1 / (i + 1) ** 0.5;
    for (let k = 0; k < n; k++)
      y[k] = y[k]! + ((ab[0]![k]! * Math.cos(ph[k]!) - ab[1]![k]! * Math.sin(ph[k]!)) / s0) * g;
  });
  return norm(y);
}

/** Dust that is thrown out: a wide burst of noise with a soft rise and a long fall. */
export function puff(
  dur: number,
  seed: number,
  lo = 150.0,
  hi = 5000.0,
  rise = 0.04,
  tau = 0.5,
  tilt = 0.5,
): Stereo {
  const n = nsamp(dur);
  const k = Math.max(2, nsamp(rise));
  const e = new Float64Array(n).map(
    (_, i) => exp(-i / SR / tau) * (i < k ? 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / k) : 1),
  );
  const y = [0, 1].map((c) =>
    spectral(white(n, seed + c), tilted(lo, hi, 2, tilt)).map((v, i) => v * e[i]!),
  ) as Stereo;
  const p = Math.max(peak(y[0]), peak(y[1])) + 1e-12;
  return scaleSt(y, 1 / p);
}

/** Dust and grit that hang and fall: a hiss whose level wanders, with a fine grain of tiny impacts. */
export function dust(
  dur: number,
  seed: number,
  { lo = 1500.0, hi = 10000.0, sd = 2.0, grain = 0.35, tilt = 0.3 } = {},
): Stereo {
  const n = nsamp(dur);
  return [0, 1].map((c) => {
    const x0 = spectral(white(n, seed + c), tilted(lo, hi, 2, tilt));
    const gx = 1 / Math.sqrt(meanSq(x0));
    const walk = levelWalk(n, seed + 10 + c, sd, 0.4, 7.0);
    const g = sand(dur, seed + 20 + c, 1800.0, dur * 4, 2500.0, 9000.0).subarray(0, n);
    const gg = (2.0 * grain) / (Math.sqrt(meanSq(g)) + 1e-12);
    return x0.map((v, i) => v * gx * walk[i]! + g[i]! * gg);
  }) as Stereo;
}

/** A cloud of smoke or dust that rolls: low noise in slow, irregular surges. */
export function billow(dur: number, seed: number, lo = 70.0, hi = 700.0, sd = 3.0): Stereo {
  const n = nsamp(dur);
  return [0, 1].map((c) => {
    const x = spectral(white(n, seed + c), tilted(lo, hi, 2, 0.5));
    const g = 1 / Math.sqrt(meanSq(x));
    const walk = levelWalk(n, seed + 10 + c, sd, 0.3, 3.0);
    return x.map((v, i) => v * g * walk[i]!);
  }) as Stereo;
}

/**
 * A slab of stone that lands: a deep thud that lasts, the slab cracks, small pieces scatter
 * (`scatter`, their weight; the study's 0.2). The scenes pass 0: the owner's rule cuts small
 * stones that roll (2026-11-11), so a landing keeps its body, its crack and its thud only.
 */
export function slabFall(seed: number, size = 1.0, tail = 1.0, scatter = 0.2): Float64Array {
  const hc = heavyCrack(seed, { size, dur: 0.35, kRate: 6, bright: 0.3 });
  const thud = burst(seed + 5, 26.0, 95.0, tail * (0.18 + 0.1 * Math.min(size, 2.0)), {
    rise: 0.006,
  });
  const body = boom(seed + 9, {
    f: 110.0 / Math.max(size, 0.3) ** 0.3,
    tau: tail * (0.28 + 0.12 * Math.min(size, 2.0)),
  });
  const sc = tumble(0.7, seed + 7, (t) => 16.0 * exp(-t / 0.22), [0.05, 0.15], [2.0, 5.0]);
  const y = zeros(Math.max(hc.length, thud.length, sc.length, body.length));
  addAt(y, hc, 0, 0.6);
  addAt(y, thud, 0, 0.5);
  addAt(y, body, 0, 1.3);
  if (scatter > 0) addAt(y, norm(sc), 0, scatter);
  return norm(y);
}

/** A block of stone that strikes another: the clack and thud of its size, and the crack of both. */
export function blockHit(seed: number, size = 0.6, v = 8.0): Float64Array {
  const r = rng(seed);
  const k = norm(stoneImpact(size, v, r));
  const c = heavyCrack(seed + 3, { size, dur: 0.2, kRate: 3, bright: 0.4 });
  const b = boom(seed + 5, {
    f: 125.0 / Math.max(size, 0.3) ** 0.3,
    tau: 0.12 + 0.14 * size,
  });
  const y = zeros(Math.max(k.length, c.length, b.length));
  addAt(y, k, 0, 0.8);
  addAt(y, c, 0, 0.7);
  addAt(y, b, 0, 0.9);
  return norm(y);
}

/** Stone that grinds on stone: stick and slip with a jitter of 60 %, through wide low resonances, and a scrape. */
export function grind(
  dur: number,
  seed: number,
  {
    rLo = 60.0,
    rHi = 200.0,
    res = [90.0, 210.0, 480.0] as readonly number[],
    jitter = 0.6,
    scrape = 1.2,
  } = {},
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const path = irregular(n, seed + 1, 0.7, 5.0).map((m) => rLo * (rHi / rLo) ** (0.5 + 0.5 * m));
  const y = zeros(n + nsamp(0.1));
  const L = nsamp(0.004);
  let t = r.uniform(0, 0.02);
  while (t < dur) {
    const i = Math.min(n - 1, nsamp(t));
    const nz = r.normalN(L);
    const a = r.uniform(0.3, 1.0);
    addAt(y, nz.subarray(0, Math.min(L, y.length - i)), i, a);
    t += (1.0 / path[i]!) * (1 + jitter * r.uniform(-1, 1));
  }
  const low = zeros(y.length);
  res.forEach((f, k) => addAt(low, bp(y, f, 2.0), 0, 1 / (k + 1) ** 0.5));
  const env = smooth(low.map(Math.abs), 0.03);
  const sc = spectral(white(y.length, seed + 2), tilted(500.0, 4000.0, 2, 0.5));
  const se = norm(sc.map((v, i) => v * env[i]!));
  const lo = norm(low);
  const out = lo.map((v, i) => v + scrape * se[i]!);
  return norm(fade(out, 0.03, 0.08));
}

/** A ray that leaves its source: a short tear whose band falls fast. */
export function lance(seed: number, dur = 0.09, f0 = 6000.0, f1 = 700.0): Stereo {
  return bandSweepWide(dur, seed, f0, f1, 1.3, 0.12);
}

/** A ray that is held: noise in a band whose level moves fast and with no period. */
export function sear(dur: number, seed: number, lo = 900.0, hi = 6000.0, sd = 4.0): Float64Array {
  const n = nsamp(dur);
  const x = spectral(white(n, seed), tilted(lo, hi, 2, 0.6));
  const g = 1 / Math.sqrt(meanSq(x));
  const walk = levelWalk(n, seed + 1, sd, 3.0, 30.0);
  return norm(x.map((v, i) => v * g * walk[i]!));
}

/** The body of a heavy hit: a band of noise around f Hz and two damped modes in it that sink. */
export function boom(
  seed: number,
  {
    f = 110.0,
    tau = 0.4,
    tone = 0.3,
    dur,
  }: { f?: number; tau?: number; tone?: number; dur?: number } = {},
): Float64Array {
  const d = dur || Math.min(2.5, tau * 7);
  const n = nsamp(d);
  const k = Math.max(2, nsamp(0.006));
  const nz0 = spectral(white(n + nsamp(0.05), seed), (q) =>
    bandGain(q, 0.55 * f, 1.5 * f, 3),
  ).subarray(0, n);
  const np = peak(nz0) + 1e-12;
  const r = rng(seed + 1);
  const md = zeros(n);
  for (const [fm, a] of [
    [f, 1.0],
    [0.72 * f, 0.7],
  ] as const) {
    const ph = cumPhase((i) => fm * (1.0 - 0.08 * (1 - exp(-i / SR / (0.6 * tau)))), n);
    const off = r.uniform(0, 6.28);
    for (let i = 0; i < n; i++) md[i] = md[i]! + a * Math.sin(ph[i]! + off);
  }
  const mp = peak(md) + 1e-12;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let env = exp(-i / SR / tau);
    if (i < k) env *= 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / k);
    y[i] = ((1 - tone) * (nz0[i]! / np) + tone * (md[i]! / mp)) * env;
  }
  return norm(y);
}

/** Blocks of stone that strike one another while they fall: impacts at random times, rate(t) a second. */
export function rubble(
  dur: number,
  seed: number,
  rate: (t: number) => number,
  { sizes = [0.3, 1.0] as readonly [number, number], bright = 0.25, body = 0.0 } = {},
): Float64Array {
  const r = rng(seed);
  const n = nsamp(dur);
  const y = zeros(n + nsamp(1.2));
  let rmax = -Infinity;
  for (let i = 0; i < 60; i++) rmax = Math.max(rmax, rate(i * (dur / 59)));
  let t = 0.0;
  for (;;) {
    t += r.exponential(1.0 / rmax);
    if (t >= dur) break;
    if (r.random() > rate(t) / rmax) continue;
    const a = exp(r.uniform(log(sizes[0]), log(sizes[1])));
    const c = stoneCrack(r, a, bright);
    const g = a ** 1.5 * r.uniform(0.5, 1.0);
    const s = nsamp(t);
    addAt(y, c, s, g);
    if (body && a > 0.6) {
      const b = boom(r.integers(1, 2 ** 31 - 1), {
        f: 125.0 / a ** 0.3,
        tau: 0.1 + 0.12 * a,
      });
      addAt(y, b, s, body * a ** 1.5);
    }
  }
  return y.slice(0, n + nsamp(0.6));
}

export { envPoints };
