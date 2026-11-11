// The random numbers of the study's models. The study draws from numpy's generator; this port
// draws from a counter hash that a few lines of numpy can compute too
// (`experiments/12-scene1-red-seal/parity/shared_rng.py`). With that generator in the study's
// scripts, the port and the study give the same samples, so a test can hold each model to the
// study exactly. With numpy's own generator the two differ in their noise and agree in kind.
//
// A stream has a key from its seed and a counter. Draw `c` is two 32-bit hashes of the key and the
// counter, made into a double in [0, 1) with 53 bits, as numpy's `random()` makes one.

const h32 = (x: number): number => {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

/** A stream of the study's random numbers, as `dsp.rng(seed)` gives one. */
export class Rng {
  private readonly key: number;
  private counter = 0;

  constructor(seed: number) {
    // A seed is any integer below 2^53; both halves enter the key.
    const lo = seed >>> 0;
    const hi = Math.floor(seed / 4294967296) >>> 0;
    this.key = h32((lo ^ h32(hi ^ 0x9e3779b9)) >>> 0);
  }

  /** One double in [0, 1). */
  next(): number {
    const c = this.counter;
    this.counter = (c + 1) >>> 0;
    const a = h32((this.key ^ h32((2 * c) >>> 0)) >>> 0);
    const b = h32((this.key ^ h32((2 * c + 1) >>> 0)) >>> 0);
    return ((a >>> 5) * 67108864 + (b >>> 6)) / 9007199254740992;
  }

  random(): number {
    return this.next();
  }

  randomN(n: number): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = this.next();
    return y;
  }

  uniform(lo = 0, hi = 1): number {
    return lo + (hi - lo) * this.next();
  }

  uniformN(lo: number, hi: number, n: number): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = lo + (hi - lo) * this.next();
    return y;
  }

  /** A standard normal number: Box and Muller, from two draws, the second unused. */
  normal(): number {
    const u1 = 1 - this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  normalN(n: number): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = this.normal();
    return y;
  }

  exponential(scale = 1): number {
    return -Math.log(1 - this.next()) * scale;
  }

  exponentialN(scale: number, n: number): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = this.exponential(scale);
    return y;
  }

  /** A Poisson count: Knuth's product up to a mean of 30, a rounded normal above. */
  poisson(lam: number): number {
    if (lam <= 0) return 0;
    if (lam <= 30) {
      const limit = Math.exp(-lam);
      let k = 0;
      let p = this.next();
      while (p > limit) {
        k++;
        p *= this.next();
      }
      return k;
    }
    return Math.max(0, Math.floor(lam + Math.sqrt(lam) * this.normal() + 0.5));
  }

  /** An integer in [lo, hi). */
  integers(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo));
  }

  /** `choice([-1.0, 1.0], n)`. */
  signN(n: number): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = this.next() < 0.5 ? -1 : 1;
    return y;
  }
}

export const rng = (seed: number): Rng => new Rng(seed);
