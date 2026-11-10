import { compileFunctionGraph } from "../../../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../../../src/function-graph/runtime/index.ts";
import type { FunctionGraphDocument } from "../../../src/function-graph/types.ts";

/** Match the published studio's 48 kHz, unity-volume source onset/end taper profile. */
export function renderColumnSource(
  document: FunctionGraphDocument,
  seconds: number,
) {
  const program = compileFunctionGraph(document);
  for (const artifact of program.artifacts) new Function(artifact.code)();
  const dsp = new FunctionGraphDsp(program),
    frames = Math.round(seconds * 48000);
  const pcm = new Float32Array(frames),
    block = new Float32Array(128);
  let peak = 0,
    fade = 0;
  for (let at = 0; at < frames; at += 128) {
    const count = Math.min(128, frames - at);
    if (!dsp.process(block, count))
      throw new Error(
        `Column source fault at ${dsp.faultNode}: ${String(dsp.fault)}`,
      );
    for (let i = 0; i < count; i++) {
      const sample = block[i]!;
      if (!Number.isFinite(sample) || Math.abs(sample) >= 0.999)
        throw new Error(
          "Reject an invalid or overloaded source before any delivery gain.",
        );
      peak = Math.max(peak, Math.abs(sample));
      fade = Math.min(1, fade + 1 / 240);
      const faded = Math.fround(sample * fade);
      pcm[at + i] =
        faded * Math.max(0, Math.min(1, (frames - 1 - at - i) / 1440));
    }
  }
  if (peak < 1e-5) throw new Error("Reject a silent source.");
  return { pcm, peak, document: program.document };
}
