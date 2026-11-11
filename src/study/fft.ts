// A discrete Fourier transform of any length, in f64, for the study's models (`src/study/dsp.ts`).
// numpy's `rfft` and `irfft` take any length, and the study's zero-phase shaping (`spectral`) is
// circular over the whole signal, so its result depends on the length. A length whose prime factors
// are at most 13 runs as a mixed-radix Stockham transform; any other length runs as Bluestein's
// chirp transform over a power of two.

interface Plan {
  readonly n: number;
  readonly factors: readonly number[];
  /** For each stage: the twiddles w^(p·k), p < m, k < r, as [re, im] interleaved. */
  readonly twiddles: readonly Float64Array[];
  readonly bluestein?: Bluestein;
}

interface Bluestein {
  readonly size: number;
  readonly chirpRe: Float64Array;
  readonly chirpIm: Float64Array;
  /** The transform of the conjugate chirp, padded to `size`. */
  readonly kernelRe: Float64Array;
  readonly kernelIm: Float64Array;
}

const plans = new Map<number, Plan>();

function factorize(n: number): number[] | undefined {
  const out: number[] = [];
  let m = n;
  while (m % 4 === 0) {
    out.push(4);
    m /= 4;
  }
  for (const p of [2, 3, 5, 7, 11, 13]) {
    while (m % p === 0) {
      out.push(p);
      m /= p;
    }
  }
  return m === 1 ? out : undefined;
}

function planOf(n: number): Plan {
  let plan = plans.get(n);
  if (plan) return plan;
  const factors = factorize(n);
  if (!factors) {
    let size = 1;
    while (size < 2 * n - 1) size *= 2;
    const chirpRe = new Float64Array(n);
    const chirpIm = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      // k² mod 2n keeps the angle exact for long transforms.
      const k2 = Number((BigInt(k) * BigInt(k)) % BigInt(2 * n));
      const a = (-Math.PI * k2) / n;
      chirpRe[k] = Math.cos(a);
      chirpIm[k] = Math.sin(a);
    }
    const kr = new Float64Array(size);
    const ki = new Float64Array(size);
    kr[0] = chirpRe[0]!;
    ki[0] = -chirpIm[0]!;
    for (let k = 1; k < n; k++) {
      kr[k] = kr[size - k] = chirpRe[k]!;
      ki[k] = ki[size - k] = -chirpIm[k]!;
    }
    const [kernelRe, kernelIm] = transform(kr, ki, false);
    plan = {
      n,
      factors: [],
      twiddles: [],
      bluestein: { size, chirpRe, chirpIm, kernelRe, kernelIm },
    };
  } else {
    const twiddles: Float64Array[] = [];
    let len = n;
    for (const r of factors) {
      const m = len / r;
      const t = new Float64Array(2 * m * r);
      for (let p = 0; p < m; p++)
        for (let k = 0; k < r; k++) {
          const a = (-2 * Math.PI * ((p * k) % len)) / len;
          t[2 * (p * r + k)] = Math.cos(a);
          t[2 * (p * r + k) + 1] = Math.sin(a);
        }
      twiddles.push(t);
      len = m;
    }
    plan = { n, factors, twiddles };
  }
  plans.set(n, plan);
  return plan;
}

/** The forward transform (sign -1) of a complex sequence; `inverse` gives sign +1 and no scale. */
export function transform(
  re: Float64Array,
  im: Float64Array,
  inverse: boolean,
): [Float64Array, Float64Array] {
  const n = re.length;
  if (n === 0) return [new Float64Array(0), new Float64Array(0)];
  const plan = planOf(n);
  if (plan.bluestein) return bluestein(re, im, inverse, plan.bluestein);
  let xr = Float64Array.from(re);
  let xi = Float64Array.from(im);
  if (inverse) for (let i = 0; i < n; i++) xi[i] = -xi[i]!;
  let yr = new Float64Array(n);
  let yi = new Float64Array(n);
  let len = n;
  let s = 1;
  const ar = new Float64Array(16);
  const ai = new Float64Array(16);
  plan.factors.forEach((r, stage) => {
    const m = len / r;
    const tw = plan.twiddles[stage]!;
    if (r === 2) {
      for (let p = 0; p < m; p++) {
        const wr = tw[2 * (p * 2 + 1)]!;
        const wi = tw[2 * (p * 2 + 1) + 1]!;
        for (let q = 0; q < s; q++) {
          const i0 = q + s * p;
          const i1 = q + s * (p + m);
          const a0r = xr[i0]!;
          const a0i = xi[i0]!;
          const a1r = xr[i1]!;
          const a1i = xi[i1]!;
          const o = q + s * 2 * p;
          yr[o] = a0r + a1r;
          yi[o] = a0i + a1i;
          const dr = a0r - a1r;
          const di = a0i - a1i;
          yr[o + s] = dr * wr - di * wi;
          yi[o + s] = dr * wi + di * wr;
        }
      }
    } else if (r === 4) {
      for (let p = 0; p < m; p++) {
        const w1r = tw[2 * (p * 4 + 1)]!;
        const w1i = tw[2 * (p * 4 + 1) + 1]!;
        const w2r = tw[2 * (p * 4 + 2)]!;
        const w2i = tw[2 * (p * 4 + 2) + 1]!;
        const w3r = tw[2 * (p * 4 + 3)]!;
        const w3i = tw[2 * (p * 4 + 3) + 1]!;
        for (let q = 0; q < s; q++) {
          const a0r = xr[q + s * p]!;
          const a0i = xi[q + s * p]!;
          const a1r = xr[q + s * (p + m)]!;
          const a1i = xi[q + s * (p + m)]!;
          const a2r = xr[q + s * (p + 2 * m)]!;
          const a2i = xi[q + s * (p + 2 * m)]!;
          const a3r = xr[q + s * (p + 3 * m)]!;
          const a3i = xi[q + s * (p + 3 * m)]!;
          const t0r = a0r + a2r;
          const t0i = a0i + a2i;
          const t1r = a0r - a2r;
          const t1i = a0i - a2i;
          const t2r = a1r + a3r;
          const t2i = a1i + a3i;
          // (a1 - a3) · (-i)
          const t3r = a1i - a3i;
          const t3i = -(a1r - a3r);
          const o = q + s * 4 * p;
          yr[o] = t0r + t2r;
          yi[o] = t0i + t2i;
          const b1r = t1r + t3r;
          const b1i = t1i + t3i;
          const b2r = t0r - t2r;
          const b2i = t0i - t2i;
          const b3r = t1r - t3r;
          const b3i = t1i - t3i;
          yr[o + s] = b1r * w1r - b1i * w1i;
          yi[o + s] = b1r * w1i + b1i * w1r;
          yr[o + 2 * s] = b2r * w2r - b2i * w2i;
          yi[o + 2 * s] = b2r * w2i + b2i * w2r;
          yr[o + 3 * s] = b3r * w3r - b3i * w3i;
          yi[o + 3 * s] = b3r * w3i + b3i * w3r;
        }
      }
    } else {
      const cr = new Float64Array(r * r);
      const ci = new Float64Array(r * r);
      for (let j = 0; j < r; j++)
        for (let k = 0; k < r; k++) {
          const a = (-2 * Math.PI * ((j * k) % r)) / r;
          cr[j * r + k] = Math.cos(a);
          ci[j * r + k] = Math.sin(a);
        }
      for (let p = 0; p < m; p++)
        for (let q = 0; q < s; q++) {
          for (let j = 0; j < r; j++) {
            ar[j] = xr[q + s * (p + j * m)]!;
            ai[j] = xi[q + s * (p + j * m)]!;
          }
          for (let k = 0; k < r; k++) {
            let sr = 0;
            let si = 0;
            for (let j = 0; j < r; j++) {
              const c = cr[j * r + k]!;
              const d = ci[j * r + k]!;
              sr += ar[j]! * c - ai[j]! * d;
              si += ar[j]! * d + ai[j]! * c;
            }
            const wr = tw[2 * (p * r + k)]!;
            const wi = tw[2 * (p * r + k) + 1]!;
            const o = q + s * (r * p + k);
            yr[o] = sr * wr - si * wi;
            yi[o] = sr * wi + si * wr;
          }
        }
    }
    [xr, yr] = [yr, xr];
    [xi, yi] = [yi, xi];
    len = m;
    s *= r;
  });
  if (inverse) for (let i = 0; i < n; i++) xi[i] = -xi[i]!;
  return [xr, xi];
}

function bluestein(
  re: Float64Array,
  im: Float64Array,
  inverse: boolean,
  b: Bluestein,
): [Float64Array, Float64Array] {
  const n = re.length;
  const ar = new Float64Array(b.size);
  const ai = new Float64Array(b.size);
  for (let k = 0; k < n; k++) {
    const xr = re[k]!;
    const xi = inverse ? -im[k]! : im[k]!;
    ar[k] = xr * b.chirpRe[k]! - xi * b.chirpIm[k]!;
    ai[k] = xr * b.chirpIm[k]! + xi * b.chirpRe[k]!;
  }
  const [fr, fi] = transform(ar, ai, false);
  for (let k = 0; k < b.size; k++) {
    const r = fr[k]! * b.kernelRe[k]! - fi[k]! * b.kernelIm[k]!;
    const i = fr[k]! * b.kernelIm[k]! + fi[k]! * b.kernelRe[k]!;
    fr[k] = r;
    fi[k] = i;
  }
  const [cr, ci] = transform(fr, fi, true);
  const outR = new Float64Array(n);
  const outI = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = cr[k]! / b.size;
    const i = ci[k]! / b.size;
    outR[k] = r * b.chirpRe[k]! - i * b.chirpIm[k]!;
    outI[k] = r * b.chirpIm[k]! + i * b.chirpRe[k]!;
    if (inverse) outI[k] = -outI[k]!;
  }
  return [outR, outI];
}

/** numpy's `rfft(x, n)`: the first n / 2 + 1 bins of the transform of x, cut or padded to n. */
export function rfft(x: ArrayLike<number>, n = x.length): [Float64Array, Float64Array] {
  const re = new Float64Array(n);
  const m = Math.min(n, x.length);
  for (let i = 0; i < m; i++) re[i] = x[i]!;
  const [r, i] = transform(re, new Float64Array(n), false);
  const h = Math.floor(n / 2) + 1;
  return [r.slice(0, h), i.slice(0, h)];
}

/** numpy's `irfft(X, n)`: the real signal of n samples whose half spectrum is X. */
export function irfft(re: Float64Array, im: Float64Array, n: number): Float64Array {
  const h = Math.floor(n / 2) + 1;
  const fr = new Float64Array(n);
  const fi = new Float64Array(n);
  const m = Math.min(h, re.length);
  for (let k = 0; k < m; k++) {
    fr[k] = re[k]!;
    fi[k] = im[k]!;
  }
  fi[0] = 0;
  if (n % 2 === 0) fi[n / 2] = 0;
  for (let k = 1; k < h; k++) {
    if (n - k === k) continue;
    fr[n - k] = fr[k]!;
    fi[n - k] = -fi[k]!;
  }
  const [r] = transform(fr, fi, true);
  for (let i = 0; i < n; i++) r[i] = r[i]! / n;
  return r;
}

/** numpy's `rfftfreq(n, d)`. */
export function rfftfreq(n: number, d: number): Float64Array {
  const h = Math.floor(n / 2) + 1;
  const f = new Float64Array(h);
  for (let k = 0; k < h; k++) f[k] = k / (n * d);
  return f;
}
