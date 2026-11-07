import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateBrief } from "../../src/quality/index.ts";
import { validateFunctionDocument } from "../../src/function-graph/index.ts";
import { validateControls } from "./column/controls.ts";
import type { RenderedCandidate } from "./column/renderCandidate.ts";
import { decodeWav } from "./audio/wav.ts";
import { analyzeSignal } from "./audio/analyzeSignal.ts";
import { sha256 } from "./receipts.ts";

/** Paths are reconstructed inside the run, so archived runs remain portable. */
export async function loadPrepared(directory: string) {
  const manifest = JSON.parse(
    await readFile(join(directory, "run.json"), "utf8"),
  );
  if (
    manifest.schema !== "typeaudio.quality-run" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.candidates) ||
    manifest.candidates.length !== 3
  )
    throw new Error("Expected a prepared column-impact run.");
  const briefBytes = await readFile(join(directory, "brief.json"));
  if (sha256(briefBytes) !== manifest.briefSha256)
    throw new Error("The brief changed after preparation.");
  const brief = validateBrief(JSON.parse(briefBytes.toString())),
    candidates: RenderedCandidate[] = [];
  for (const entry of manifest.candidates) {
    if (
      typeof entry.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(entry.id) ||
      candidates.some((c) => c.id === entry.id)
    )
      throw new Error("Invalid or duplicate candidate ID.");
    const root = join(directory, entry.id),
      sourcePath = join(root, "source.function-graph.json"),
      path = join(root, "mix.wav");
    const source = await readFile(sourcePath),
      wav = await readFile(path);
    const candidate = JSON.parse(
      await readFile(join(root, "candidate.json"), "utf8"),
    );
    if (
      sha256(source) !== entry.sourceSha256 ||
      sha256(wav) !== entry.audioSha256 ||
      candidate.id !== entry.id ||
      candidate.sourceSha256 !== entry.sourceSha256 ||
      candidate.audioSha256 !== entry.audioSha256
    )
      throw new Error(
        "Candidate source or rendered audio changed after preparation.",
      );
    const document = validateFunctionDocument(JSON.parse(source.toString())),
      controls = validateControls(brief, candidate.controls);
    for (const parameter of document.parameters)
      if (parameter.value !== controls[parameter.id])
        throw new Error("Source parameters differ from the recorded controls.");
    if (
      candidate.space.send !== controls["room-send"] ||
      !Number.isInteger(candidate.seed) ||
      candidate.seed < 1 ||
      candidate.seed > 0xffffffff
    )
      throw new Error("Invalid candidate seed or room control.");
    const pcm = decodeWav(wav);
    if (
      Math.abs(pcm.channels[0]!.length / pcm.sampleRate - brief.duration) >
        1 / pcm.sampleRate ||
      !analyzeSignal(pcm).passed
    )
      throw new Error("Candidate audio failed verification.");
    candidates.push({
      ...candidate,
      controls,
      directory: root,
      path,
      sourcePath,
    });
  }
  return { brief, candidates, manifest };
}
