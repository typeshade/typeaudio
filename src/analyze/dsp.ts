// Shared helpers of the analyzers: a Welch power spectrum over `fft64`, third-octave bands and
// percentiles. Host-side, pure, in doubles.

import { fft64 } from './fft.ts';

/** The FFT size of every spectrum here. */
export const FFT_SIZE = 2048;

/** The mean of the channels, as one `Float64Array`. */
export function mono(channels: readonly Float32Array[]): Float64Array {
  const n = channels[0]?.length ?? 0;
  const out = new Float64Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i]! += c[i]!;
  for (let i = 0; i < n; i++) out[i]! /= channels.length || 1;
  return out;
}

/** The Hann window of `n` points. */
export const hann = (n: number): Float64Array =>
  Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));

/**
 * The magnitudes of the frames `[start, start + FFT_SIZE)`, stepping by `hop`, Hann windowed. A
 * signal shorter than one frame is zero padded into one.
 */
export function* magnitudeFrames(
  x: ArrayLike<number>,
  hop: number,
  size = FFT_SIZE,
): Generator<{ start: number; magnitude: Float64Array }> {
  const w = hann(size);
  const frames = Math.max(1, Math.floor((x.length - size) / hop) + 1);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const z = new Float64Array(2 * size);
    for (let i = 0; i < size && start + i < x.length; i++) z[2 * i] = x[start + i]! * w[i]!;
    const spectrum = fft64(z, size, 'forward');
    const magnitude = new Float64Array(size / 2 + 1);
    for (let k = 0; k <= size / 2; k++)
      magnitude[k] = Math.hypot(spectrum[2 * k]!, spectrum[2 * k + 1]!);
    yield { start, magnitude };
  }
}

/** The mean power of each bin, over the frames (Welch). Bin `k` is at `k * sampleRate / FFT_SIZE`. */
export function powerSpectrum(x: ArrayLike<number>): Float64Array {
  const power = new Float64Array(FFT_SIZE / 2 + 1);
  let frames = 0;
  for (const { magnitude } of magnitudeFrames(x, FFT_SIZE / 2)) {
    for (let k = 0; k < power.length; k++) power[k]! += magnitude[k]! * magnitude[k]!;
    frames++;
  }
  for (let k = 0; k < power.length; k++) power[k]! /= frames;
  return power;
}

/** The lowest and highest edge of the bands, in Hz. */
export const BAND_LOW = 50;
export const BAND_HIGH = 16000;

/** One third-octave band: its centre and the mean power density of the bins inside it. */
export interface Band {
  centre: number;
  density: number;
}

/** The third-octave bands from `BAND_LOW` to the lower of `BAND_HIGH` and 0.45 of the sample rate. */
export function bands(power: Float64Array, sampleRate: number): Band[] {
  const top = Math.min(BAND_HIGH, 0.45 * sampleRate);
  const out: Band[] = [];
  for (let c = BAND_LOW; c * 2 ** (1 / 6) <= top; c *= 2 ** (1 / 3)) {
    const lo = (c / 2 ** (1 / 6) / sampleRate) * FFT_SIZE;
    const hi = ((c * 2 ** (1 / 6)) / sampleRate) * FFT_SIZE;
    let sum = 0;
    let count = 0;
    for (let k = Math.ceil(lo); k < hi && k < power.length; k++) {
      sum += power[k]!;
      count++;
    }
    if (count > 0) out.push({ centre: c, density: sum / count });
  }
  return out;
}

/** The `p`th percentile (0 to 1) of `values`, by linear interpolation between ranks. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export const toDb = (power: number, floor = 1e-20): number =>
  10 * Math.log10(Math.max(power, floor));
