import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import impact from "../fixtures/function-graph/impact.json";
import { compileFunctionGraph } from "../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../src/function-graph/runtime/index.ts";

const program = compileFunctionGraph(impact);
for (const a of program.artifacts) new Function(a.code)();
const dsp = new FunctionGraphDsp(program),
  frames = 48000,
  out = new Float32Array(128),
  wav = Buffer.alloc(44 + frames * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(frames * 2, 40);
let peak = 0,
  energy = 0;
for (let at = 0; at < frames; at += 128) {
  const n = Math.min(128, frames - at);
  if (!dsp.process(out, n)) throw dsp.fault;
  for (let i = 0; i < n; i++) {
    const v = out[i]!;
    peak = Math.max(peak, Math.abs(v));
    energy += v * v;
    if (Math.abs(v) > 1) throw new Error("Demo exceeds PCM headroom.");
    wav.writeInt16LE(Math.round(v * 32767), 44 + (at + i) * 2);
  }
}
await mkdir("artifacts/functions", { recursive: true });
await writeFile("artifacts/functions/impact.wav", wav);
await writeFile(
  "artifacts/functions/impact.function-graph.json",
  JSON.stringify(program.document, null, 2) + "\n",
);
await writeFile(
  "artifacts/functions/listening.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      source: "fixtures/function-graph/impact.json",
      frames,
      sampleRate: 48000,
      channels: 1,
      peak,
      rms: Math.sqrt(energy / frames),
      review:
        "Engine execution demonstration; listening quality not approved. Engine source graph is not yet a Web project import.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Function impact: ${frames} frames, peak ${peak}; source JSON and WAV written.`,
);
