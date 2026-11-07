import { cpus } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import impact from "../fixtures/function-graph/impact.json";
import { compileFunctionGraph } from "../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../src/function-graph/runtime/index.ts";

const start = performance.now(),
  program = compileFunctionGraph(impact),
  compileMs = performance.now() - start;
for (const a of program.artifacts) new Function(a.code)();
const measurements = [];
for (const voices of [1, 8, 32]) {
  const prepared = performance.now(),
    dsps = Array.from({ length: voices }, () => new FunctionGraphDsp(program)),
    prepareMs = performance.now() - prepared;
  const out = new Float32Array(128),
    times: number[] = [];
  for (let block = 0; block < 1500; block++) {
    if (block % 64 === 0) for (const d of dsps) d.reset();
    const before = performance.now();
    for (const d of dsps) if (!d.process(out)) throw d.fault;
    const elapsed = performance.now() - before;
    if (block >= 500) times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  measurements.push({
    voices,
    prepareMs,
    blocks: times.length,
    blockFrames: 128,
    p50Ms: times[500],
    p95Ms: times[950],
    p99Ms: times[990],
    maxMs: times[times.length - 1],
    overBlockInterval: times.filter((t) => t > 128 / 48).length,
  });
}
const report = {
  date: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runtime: process.version,
  cpu: cpus()[0]?.model,
  backend: "compiled CPU functions, Bun host",
  sampleRate: 48000,
  compileMs,
  measurements,
  scope:
    "Host computation only; 500 warmup blocks, 1000 measured blocks per voice count. Resets occur outside timed processing. No physical audio latency, game load, browser deadline or GPU performance claim.",
};
await mkdir("artifacts/functions", { recursive: true });
await writeFile(
  "artifacts/functions/benchmark.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
