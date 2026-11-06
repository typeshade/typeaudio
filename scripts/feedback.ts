import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { compileGraph, emitGraphSource } from "../src/graph/compiler/index.ts";
import { validateReproduction, replayGraph, summarizeReplay } from "../src/feedback/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const outputAt = args.indexOf("--out");
const output = outputAt < 0 ? undefined : args[outputAt + 1];
if (outputAt >= 0) {
  if (!output || output.startsWith("--")) throw new Error("--out needs a report path.");
  args.splice(outputAt, 2);
}
if (args.length > 1 || args.some((arg) => arg.startsWith("--")))
  throw new Error("Usage: bun run feedback [reproduction.json] [--out report.json]");
const fixtures = resolve(root, "fixtures/feedback");
const paths = args.length ? [resolve(args[0]!)] :
  (await readdir(fixtures)).filter((name) => name.endsWith(".json")).sort().map((name) => resolve(fixtures, name));
if (!paths.length) throw new Error("No reproduction fixtures found.");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const results = [];
let failures = 0;
for (const path of paths) {
  try {
    const input = validateReproduction(JSON.parse(await readFile(path, "utf8")));
    if (output) {
      const sourcePath = `${resolve(output)}.${basename(path, ".json")}.shade.ts`;
      await mkdir(dirname(sourcePath), { recursive: true });
      await writeFile(sourcePath, emitGraphSource(input.graph).source);
    }
    const start = performance.now();
    const program = compileGraph(input.graph);
    const compileMs = performance.now() - start;
    // Imported reproduction JSON cannot supply JavaScript; only generated source is loaded.
    await import(`data:text/javascript;base64,${Buffer.from(program.code).toString("base64")}`);
    const cold = summarizeReplay(replayGraph(input, () => performance.now()));
    const warm = summarizeReplay(replayGraph(input, () => performance.now()));
    const failed = cold.pcmHash !== warm.pcmHash || cold.invalidSamples || warm.invalidSamples ||
      (!args.length && warm.peak < 0.001);
    if (failed) failures++;
    results.push({ fixture: basename(path), captured: input.versions, status: failed ? "failed" : "passed", compileMs, cold, warm });
  } catch (error) {
    failures++;
    results.push({ fixture: basename(path), status: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const report = {
  format: "typeaudio.feedback-report", version: 1, date: new Date().toISOString(),
  execution: {
    typeaudio: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")),
    compilerDependency: pkg.devDependencies.typeshade,
    candidate: process.env.TYPESHADE_CANDIDATE_SHA ?? null,
    node: process.version, platform: process.platform, arch: process.arch,
    bun: process.versions.bun ?? null,
    scope: "CPU correctness and compute-only timing; no device latency or underrun measurement",
  }, results,
};
const json = JSON.stringify(report, null, 2) + "\n";
if (output) {
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), json);
}
process.stdout.write(json);
if (failures) process.exitCode = 1;
