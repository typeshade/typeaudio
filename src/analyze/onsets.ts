import { magnitudeFrames, mono } from './dsp.ts';

const HOP = 256;

/**
 * The onsets of a signal, in seconds: peaks of the spectral flux (the half-wave rectified rise of the
 * log magnitude between frames), each refined to the first sample of its region that reaches 30 % of
 * the region's peak. Onsets lie at least `minGap` seconds apart.
 */
export function detectOnsets(
  channels: readonly Float32Array[],
  sampleRate: number,
  minGap = 0.05,
): number[] {
  const x = mono(channels);
  const flux: number[] = [];
  const starts: number[] = [];
  let previous: Float64Array | undefined;
  for (const { start, magnitude } of magnitudeFrames(x, HOP)) {
    const log = magnitude.map((m) => Math.log1p(100 * m));
    let sum = 0;
    if (previous) for (let k = 0; k < log.length; k++) sum += Math.max(0, log[k]! - previous[k]!);
    flux.push(sum);
    starts.push(start);
    previous = log;
  }
  const max = Math.max(0, ...flux);
  if (max <= 0) return [];
  const span = 3;
  const peaks: number[] = [];
  for (let f = 0; f < flux.length; f++) {
    let local = 0;
    let count = 0;
    let isMax = true;
    for (let g = Math.max(0, f - 10); g <= Math.min(flux.length - 1, f + 10); g++) {
      local += flux[g]!;
      count++;
      if (Math.abs(g - f) <= span && flux[g]! > flux[f]!) isMax = false;
    }
    if (isMax && flux[f]! >= Math.max(0.1 * max, (1.5 * local) / count)) peaks.push(f);
  }
  const window = 2048;
  const smooth = Math.max(1, Math.round(0.001 * sampleRate));
  const onsets: number[] = [];
  for (const f of peaks) {
    const from = Math.max(0, starts[f]! - HOP);
    const to = Math.min(x.length, starts[f]! + window + HOP);
    let top = 0;
    const env = new Float64Array(to - from);
    for (let i = from; i < to; i++) {
      let s = 0;
      for (let j = Math.max(0, i - smooth + 1); j <= i; j++) s = Math.max(s, Math.abs(x[j]!));
      env[i - from] = s;
      top = Math.max(top, s);
    }
    let at = from;
    for (let i = from; i < to; i++)
      if (env[i - from]! >= 0.3 * top) {
        at = i;
        break;
      }
    const t = at / sampleRate;
    if (onsets.length === 0 || t - onsets[onsets.length - 1]! >= minGap) onsets.push(t);
  }
  return onsets;
}

export interface SyncError {
  /** The onset, in seconds. */
  onset: number;
  /** The nearest picture time, or null when none lies within `maxDistance`. */
  picture: number | null;
  /** onset - picture, in ms, or null. Positive means the sound is late. */
  errorMs: number | null;
}

/** The sync error of each onset against the picture times, in ms. */
export function syncErrors(
  onsets: readonly number[],
  pictureTimes: readonly number[],
  maxDistance = 0.25,
): SyncError[] {
  return onsets.map((onset) => {
    let best: number | null = null;
    for (const p of pictureTimes)
      if (
        Math.abs(onset - p) <= maxDistance &&
        (best === null || Math.abs(onset - p) < Math.abs(onset - best))
      )
        best = p;
    return { onset, picture: best, errorMs: best === null ? null : (onset - best) * 1000 };
  });
}
