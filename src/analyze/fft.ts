// FFT helpers of the engine, host-side and pure: the twiddle table that the reverb's transform
// reads, and the radix-2 transform in doubles that the analyzers use. They were experiment 3's
// (`experiments/03-fft/signals.ts`), which now re-exports them: an engine module does not import
// an experiment, so that a host that links only `src/` (the site in typeshade/web) can build.

export const DIRECTIONS = ['forward', 'inverse'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The uniform of a call: the sign of the exponent, and the scale of the output. */
export const transformOf = (direction: Direction, n: number): { sign: number; scale: number } =>
  direction === 'forward' ? { sign: -1, scale: 1 } : { sign: 1, scale: 1 / n };

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
