import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "./bundle.ts";
import { inPage } from "./browser.ts";
import impact from "../fixtures/function-graph/impact.json";
import { compileFunctionGraph } from "../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../src/function-graph/runtime/index.ts";

const program = compileFunctionGraph(impact),
  length = 16384,
  rate = 48000;
const entry = await bundle({
  entry: "test/function-graph/worklet/processor.ts",
  outDir: "out/function-worklet",
  target: "worklet",
});
const dir = dirname(entry),
  runtime = await readFile(entry, "utf8");
if (
  /compileTsSource|generateModuleJs|createSourceFile|new Function\(/.test(
    runtime,
  )
)
  throw new Error("Compiler or eval leaked into the AudioWorklet runtime.");
await writeFile(
  join(dir, "index.html"),
  "<!doctype html><title>TypeAudio function execution check</title>",
);
await writeFile(
  join(dir, "functions.js"),
  program.artifacts.map((a) => a.code).join("\n"),
);
const { rendered, browser } = await inPage(dir, async (page) => ({
  browser: page.context().browser()?.version(),
  rendered: await page.evaluate(
    async ({ program, length, rate }) => {
      const context = new OfflineAudioContext(1, length, rate);
      await context.audioWorklet.addModule("./processor.js");
      await context.audioWorklet.addModule("./functions.js");
      const node = new AudioWorkletNode(context, "typeaudio-function-check", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { program },
      });
      let failed = false;
      node.onprocessorerror = () => {
        failed = true;
      };
      node.connect(context.destination);
      const out = await context.startRendering();
      node.disconnect();
      if (failed) throw new Error("Function AudioWorklet failed.");
      return Array.from(out.getChannelData(0));
    },
    { program, length, rate },
  ),
}));
for (const a of program.artifacts) new Function(a.code)();
const dsp = new FunctionGraphDsp(program),
  out = new Float32Array(128);
let maxError = 0,
  energy = 0,
  peak = 0;
for (let at = 0; at < length; at += 128) {
  if (at === 2048) dsp.setParameter("pitch", 420);
  if (at === 4096) dsp.setParameter("strength", 0.3);
  if (at === 6144) dsp.reset();
  if (!dsp.process(out)) throw dsp.fault;
  for (let i = 0; i < 128; i++) {
    const v = rendered[at + i]!;
    maxError = Math.max(maxError, Math.abs(v - out[i]!));
    energy += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
}
if (!Number.isFinite(maxError) || maxError > 1e-6 || energy < 0.01)
  throw new Error(
    `Function worklet mismatch: error=${maxError}, energy=${energy}.`,
  );
const report = {
  date: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  compiler: "87af4eb0d9d15f02b66b8341b72cab0944290472",
  check: "typed function AudioWorklet",
  browser,
  frames: length,
  sampleRate: rate,
  maxError,
  energy,
  peak,
  functions: program.artifacts.map((a) => ({
    definition: a.descriptor.id,
    ...a.report,
  })),
  scope:
    "Actual OfflineAudioContext/AudioWorklet module loading, synchronous PCM, parameter updates and state reset. No compiler/eval in worklet bundle. Excludes physical device deadlines and listening approval.",
};
await mkdir("artifacts/functions", { recursive: true });
await writeFile(
  "artifacts/functions/worklet.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
