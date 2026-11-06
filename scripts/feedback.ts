import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { compileGraph } from "../src/graph/compiler/index.ts";
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
for (const path of paths) {
  const input = validateReproduction(JSON.parse(await readFile(path, "utf8")));
  const start = performance.now();
  const program = compileGraph(input.graph);
  const compileMs = performance.now() - start;
  // Only compiler-generated source is loaded. Imported reproduction JSON cannot supply JavaScript.
  await import(`data:text/javascript;base64,${Buffer.from(program.code).toString("base64")}`);
  const cold = summarizeReplay(replayGraph(input, () => performance.now()));
  const warm = summarizeReplay(replayGraph(input, () => performance.now()));
  if (cold.pcmHash !== warm.pcmHash || cold.invalidSamples || warm.invalidSamples)
    throw new Error(`${basename(path)}: non-deterministic or non-finite output.`);
  if (output) {
    const sourcePath = `${resolve(output)}.${basename(path, ".json")}.shade.ts`;
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, program.source);
  }
  results.push({ fixture: basename(path), captured: input.versions, compileMs, cold, warm });
}
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const report = {
  format: "typeaudio.feedback-report", version: 1, date: new Date().toISOString(),
  execution: {
    typeaudio: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")),
    compilerDependency: pkg.devDependencies.typeshade,
    candidate: process.env.TYPESHADE_CANDIDATE_SHA ?? null,
    node: process.version, platform: process.platform, arch: process.arch,
    scope: "CPU correctness and compute-only timing; no device latency or underrun measurement",
  }, results,
};
const json = JSON.stringify(report, null, 2) + "\n";
if (output) await writeFile(resolve(output), json);
process.stdout.write(json);
