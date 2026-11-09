// The master of the layered render (docs/sound-design-loop.md, "The guards", item 1): a loudness
// target and a look-ahead true-peak limiter. Both are host-side and pure, in doubles. The loudness
// of a clip is integrated over the whole clip, so it cannot be known before the clip is rendered:
// the render runs once, then the master measures the mix, scales it to the target and limits it.
// The limiter reads the whole mix, so its look-ahead costs no delay.

import { integratedLoudness, peakEnvelope } from './analyze/loudness.ts';

/** The look-ahead of the limiter, in milliseconds, and its release. */
export const LOOKAHEAD_MS = 1.5;
export const RELEASE_MS = 120;
/** The margin under the ceiling, in dB, for what a gain that moves does to the interpolated peaks. */
export const CEILING_MARGIN_DB = 0.1;

/** The linear gain that takes `channels` to `target` LUFS; 1 for a silent mix. */
export function normalizationGain(
  channels: readonly Float32Array[],
  sampleRate: number,
  target: number,
): number {
  const lufs = integratedLoudness(channels, sampleRate);
  return Number.isFinite(lufs) ? 10 ** ((target - lufs) / 20) : 1;
}

/**
 * The gain curve of a look-ahead true-peak limiter, one linear gain per sample for every channel
 * (stereo linked). The oversampled peak around each sample sets the gain it needs; the least need
 * over the look-ahead window holds for the window; the gain recovers at the release rate; and a
 * moving average over the window smooths the edges. Each of those steps keeps the gain at or under
 * the need of every sample the window covers, so the limited mix stays under `ceilingDb`.
 */
export function limiterGain(
  channels: readonly Float32Array[],
  sampleRate: number,
  ceilingDb: number,
): Float32Array {
  const n = channels[0]?.length ?? 0;
  const limit = 10 ** ((ceilingDb - CEILING_MARGIN_DB) / 20);
  const peak = new Float32Array(n);
  for (const c of channels) {
    const e = peakEnvelope(c);
    for (let i = 0; i < n; i++) peak[i] = Math.max(peak[i]!, e[i]!);
  }
  const need = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(peak[i]!, i > 0 ? peak[i - 1]! : 0);
    need[i] = p > limit ? limit / p : 1;
  }
  const window = Math.max(1, Math.round((LOOKAHEAD_MS / 1000) * sampleRate));
  // The least need over [j, j + window): a monotonic deque.
  const held = new Float64Array(n);
  const deque: number[] = [];
  let head = 0;
  for (let j = n - 1; j >= 0; j--) {
    while (deque.length > head && need[deque[deque.length - 1]!]! >= need[j]!) deque.pop();
    deque.push(j);
    while (deque[head]! >= j + window) head++;
    held[j] = need[deque[head]!]!;
  }
  // The release: the gain climbs back at a fixed fraction, and never above the held need.
  const rate = 1 - Math.exp(-1 / ((RELEASE_MS / 1000) * sampleRate));
  const released = new Float64Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(held[i]!, g + (1 - g) * rate);
    released[i] = g;
  }
  // The moving average of the last `window` values, each of which is at or under the need of `i`.
  const out = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += released[i]!;
    if (i >= window) sum -= released[i - window]!;
    out[i] = sum / Math.min(i + 1, window);
  }
  return out;
}
