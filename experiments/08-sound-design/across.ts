// The comparison of a page tier's mix with the CPU tier's, for `run.ts`. Each render is scaled by
// the master's gain, which is the loudness of the render's own length. Two renders of different
// lengths have different gains, so their values are not comparable, and the comparison refuses them.

/** The values of two mixes of the same length, held to each other. */
export interface AcrossMeasure {
  frames: number;
  values: number;
  /** The values whose bits differ. */
  differ: number;
  largest: number;
  /** The CPU mix's largest magnitude. */
  peak: number;
  relativeRms: number;
}

/** A comparison that did not run, with the reason. */
export interface AcrossSkipped {
  skipped: string;
  frames: number;
  cpuFrames: number;
}

export type AcrossEntry = AcrossMeasure | AcrossSkipped;

/**
 * Compares two stereo mixes, each stored as the left channel and then the right: `page` of `frames`
 * frames and `cpu` of `cpuFrames`. The mixes must have the same length, which means the same blocks and
 * the same master gain; otherwise the result says it was skipped.
 */
export function compareMixes(
  page: Float32Array,
  frames: number,
  cpu: Float32Array,
  cpuFrames: number,
): AcrossEntry {
  if (frames !== cpuFrames)
    return {
      skipped: `The page tier rendered ${frames} frames and the CPU tier ${cpuFrames}. The master scales each render by the gain of its own length, so the two are not comparable. Run both tiers with the same --blocks.`,
      frames,
      cpuFrames,
    };
  let differ = 0;
  let largest = 0;
  let peak = 0;
  let sq = 0;
  let dq = 0;
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < frames; i++) {
      const a = page[c * frames + i]!;
      const b = cpu[c * frames + i]!;
      if (!Object.is(a, b)) differ++;
      largest = Math.max(largest, Math.abs(a - b));
      peak = Math.max(peak, Math.abs(b));
      sq += b * b;
      dq += (a - b) * (a - b);
    }
  return { frames, values: 2 * frames, differ, largest, peak, relativeRms: Math.sqrt(dq / sq) };
}
