import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateBrief } from "../../src/quality/index.ts";
import { COLUMN_CANDIDATES } from "./column/controls.ts";
import { renderCandidate } from "./column/renderCandidate.ts";
import { sha256, writeReceipt } from "./receipts.ts";

/** Offline: no evaluator, network or quality ranking. Refuse to overwrite an earlier run. */
export async function prepare(directory: string) {
  await mkdir(dirname(directory), { recursive: true });
  await mkdir(directory);
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const briefBytes = await readFile(
    new URL("../../fixtures/quality/column-impact/brief.json", import.meta.url),
  );
  const brief = validateBrief(JSON.parse(briefBytes.toString()));
  await writeReceipt(join(directory, "brief.json"), brief);
  const packageJson = JSON.parse(
    await readFile(join(repo, "package.json"), "utf8"),
  );
  const engine = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    }).trim(),
    dirty:
      execFileSync("git", ["status", "--porcelain"], {
        cwd: repo,
        encoding: "utf8",
      }).trim().length > 0,
    compiler: packageJson.devDependencies.typeshade,
    runtime: process.versions,
  };
  const candidates = [];
  for (const preset of COLUMN_CANDIDATES)
    candidates.push(
      await renderCandidate(brief, preset.controls, preset.id, directory),
    );
  const manifest = {
    schema: "typeaudio.quality-run",
    version: 1,
    preparedAt: new Date().toISOString(),
    briefSha256: sha256(await readFile(join(directory, "brief.json"))),
    engine,
    candidates: candidates.map((c) => ({
      id: c.id,
      sourceSha256: c.sourceSha256,
      audioSha256: c.audioSha256,
    })),
    status: "prepared",
    perceptualEvaluation: "not run",
    humanAccepted: false,
  };
  await writeReceipt(join(directory, "run.json"), manifest);
  return { brief, candidates, manifest };
}
