import { bands, FFT_SIZE, mono, powerSpectrum } from './dsp.ts';

/**
 * The spectral tilt in dB per octave: the least-squares slope of the log power density of the
 * third-octave bands against log2 frequency. White noise reads 0, pink noise -3.
 */
export function spectralTilt(channels: readonly Float32Array[], sampleRate: number): number {
  const b = bands(powerSpectrum(mono(channels)), sampleRate).filter((v) => v.density > 0);
  if (b.length < 2) return NaN;
  const xs = b.map((v) => Math.log2(v.centre));
  const ys = b.map((v) => 10 * Math.log10(v.density));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return num / den;
}

/** The share of the power (0 to 1) of the bins from `low` Hz up to `high` Hz. */
export function energyShare(
  channels: readonly Float32Array[],
  sampleRate: number,
  low: number,
  high: number,
): number {
  const power = powerSpectrum(mono(channels));
  let part = 0;
  let total = 0;
  for (let k = 1; k < power.length; k++) {
    const f = (k * sampleRate) / FFT_SIZE;
    total += power[k]!;
    if (f >= low && f < high) part += power[k]!;
  }
  return total > 0 ? part / total : 0;
}

/** The share of the power from 200 to 400 Hz, where a mix piles up. */
export const mudShare = (channels: readonly Float32Array[], sampleRate: number): number =>
  energyShare(channels, sampleRate, 200, 400);

/** The share of the power above 10 kHz. */
export const airShare = (channels: readonly Float32Array[], sampleRate: number): number =>
  energyShare(channels, sampleRate, 10000, Infinity);
