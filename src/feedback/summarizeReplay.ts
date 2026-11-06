import type { replayGraph } from "./replayGraph.ts";

/** A compute-only report. Deadline estimates do not measure browser output underruns. */
export function summarizeReplay(result: ReturnType<typeof replayGraph>) {
  let peak = 0,
    squares = 0,
    hash = 2166136261;
  const bits = new DataView(new ArrayBuffer(4));
  for (const sample of result.pcm) {
    peak = Math.max(peak, Math.abs(sample));
    squares += sample * sample;
    bits.setFloat32(0, sample, true);
    for (let i = 0; i < 4; i++)
      hash = Math.imul(hash ^ bits.getUint8(i), 16777619) >>> 0;
  }
  const durations = result.timings
    .map((t) => t.milliseconds)
    .sort((a, b) => a - b);
  return {
    frames: result.pcm.length,
    peak,
    rms: Math.sqrt(squares / result.pcm.length),
    pcmHash: hash.toString(16).padStart(8, "0"),
    invalidSamples: result.invalidSamples,
    updates: result.updates,
    compute: durations.length
      ? {
          blocks: durations.length,
          p99Ms: durations[Math.ceil(durations.length * 0.99) - 1]!,
          maxMs: durations[durations.length - 1]!,
          overBudgetBlocks: result.timings.filter(
            (t) => t.milliseconds > (t.frames / 48000) * 1000,
          ).length,
          scope:
            "synchronous DSP only; excludes compilation, scheduling and output underruns",
        }
      : null,
  };
}
