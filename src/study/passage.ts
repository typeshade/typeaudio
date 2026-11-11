// The helpers of the study's passages (`docs/studies/frieren-perceptual/scripts/passages.py` at
// commit `07670c9`): envelopes in picture seconds, straight paths, steady band noise, the hall's bed
// and a row of short sounds at given times.

import {
  SR,
  addAt,
  bandGain,
  envPoints,
  fade,
  lin,
  linspace,
  nsamp,
  spectral,
  white,
  zeros,
} from './dsp.ts';
import type { Path, Stereo, Vec3 } from './dsp.ts';
import type { Mix } from './mix.ts';
import { hallAir, wideNoise } from './sources.ts';

/** An envelope from (picture seconds, value) points for a layer that starts at t0. */
export const curve = (
  points: readonly (readonly [number, number])[],
  t0: number,
  n: number,
): Float64Array =>
  envPoints(
    points.map((p) => [p[0] - t0, p[1]] as const),
    n,
  );

/** n positions on a straight path from a to b. */
export function line(
  a: Vec3,
  b: Vec3,
  n: number,
): { x: Float64Array; y: Float64Array; z: Float64Array } {
  const u = linspace(0, 1, n);
  const axis = (c: 0 | 1 | 2) => u.map((v) => a[c] + (b[c] - a[c]) * v);
  return { x: axis(0), y: axis(1), z: axis(2) };
}

/** Two paths, one after the other. */
export function concat(p: Exclude<Path, Vec3>, q: Exclude<Path, Vec3>): Exclude<Path, Vec3> {
  const join = (a: Float64Array, b: Float64Array) => {
    const y = new Float64Array(a.length + b.length);
    y.set(a);
    y.set(b, a.length);
    return y;
  };
  return { x: join(p.x, q.x), y: join(p.y, q.y), z: join(p.z, q.z) };
}

/** Steady band noise with short fades: a source whose envelope comes from its path. */
export function steady(dur: number, seed: number, lo: number, hi: number): Float64Array {
  const n = nsamp(dur);
  return fade(
    spectral(white(n, seed), (f) => bandGain(f, lo, hi, 2)),
    0.02,
    0.04,
  );
}

/** The hall between the events: air, a very low rumble, a thin high air. `duck`: (picture seconds, dB). */
export function fullBed(
  m: Mix,
  t0: number,
  dur: number,
  seed: number,
  level: number,
  duck: readonly (readonly [number, number])[],
): void {
  const beds: [string, Stereo, number, 'a' | 'r'][] = [
    ['bed', hallAir(dur, seed), level, 'a'],
    ['bed-low', wideNoise(dur, seed + 3, 28, 90, 3), -47.0, 'r'],
    ['bed-high', wideNoise(dur, seed + 5, 5000, 12000), level - 9.0, 'a'],
  ];
  for (const [name, sig, tg, kind] of beds) {
    const d = curve(duck, t0, sig[0].length);
    const s: Stereo = [sig[0].map((v, i) => v * lin(d[i]!)), sig[1].map((v, i) => v * lin(d[i]!))];
    m.addWide(name, s, t0, { target: tg, kind });
  }
}

/** Short sounds at the given times (seconds from the start), summed into `dur` seconds. */
export function ticks(
  times: ArrayLike<number>,
  make: (i: number) => Float64Array,
  dur: number,
): Float64Array {
  const y = zeros(nsamp(dur));
  for (let i = 0; i < times.length; i++) {
    const k = make(i);
    const s = nsamp(times[i]!);
    const e = Math.min(y.length, s + k.length);
    if (e > s) addAt(y, k.subarray(0, e - s), s);
  }
  return y;
}

/** A stereo signal times one gain for each channel. */
export const spread = (x: Stereo, gl: number, gr: number): Stereo => [
  x[0].map((v) => v * gl),
  x[1].map((v) => v * gr),
];

/** A stereo signal times an envelope. */
export const shapeSt = (x: Stereo, env: Float64Array): Stereo => [
  x[0].map((v, i) => v * env[i]!),
  x[1].map((v, i) => v * env[i]!),
];

/** A mono signal times an envelope or a number. */
export const times = (x: Float64Array, e: Float64Array | number): Float64Array =>
  typeof e === 'number' ? x.map((v) => v * e) : x.map((v, i) => v * (e[i] ?? 0));

/** a·x + b·y + ..., each term a (weight, signal); the length of the first. */
export function sum(...terms: (readonly [number, Float64Array])[]): Float64Array {
  const y = zeros(terms[0]![1].length);
  for (const [w, x] of terms) addAt(y, x.subarray(0, Math.min(x.length, y.length)), 0, w);
  return y;
}

export { SR };
