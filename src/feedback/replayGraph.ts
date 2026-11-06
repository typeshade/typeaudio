import { GraphDsp } from "../graph/dsp.ts";
import { validateReproduction } from "./validateReproduction.ts";
import type { GraphReproduction } from "./types.ts";

/** The caller compiles and installs the graph before replay. Timing covers DSP calls only. */
export function replayGraph(raw: GraphReproduction, now?: () => number) {
  const r = validateReproduction(raw);
  const patch = { graph: r.graph, volume: r.volume };
  const dsp = new GraphDsp(patch);
  const pcm = new Float32Array(r.frames);
  const out = new Float32Array(r.blockFrames);
  const timings: { frames: number; milliseconds: number }[] = [];
  let cursor = 0,
    eventIndex = 0;
  while (cursor < r.frames) {
    while (r.events[eventIndex]?.frame === cursor) {
      const event = r.events[eventIndex++]!;
      if (event.type === "retrigger") dsp.retrigger();
      else {
        if (event.type === "volume") patch.volume = event.value;
        else
          patch.graph.parameters.forEach((p, i) => {
            p.value = event.values[i]!;
          });
        dsp.update(patch);
      }
    }
    const frames = Math.min(
      r.blockFrames,
      r.frames - cursor,
      (r.events[eventIndex]?.frame ?? r.frames) - cursor,
    );
    const start = now?.();
    dsp.process(out, frames);
    if (now && start !== undefined)
      timings.push({ frames, milliseconds: now() - start });
    pcm.set(out.subarray(0, frames), cursor);
    cursor += frames;
  }
  return {
    pcm,
    timings,
    invalidSamples: dsp.invalidSamples,
    updates: dsp.revision,
  };
}
