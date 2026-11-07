import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { AudioQualityBrief } from "../../../src/quality/types.ts";
import { createColumn } from "./createColumn.ts";
import { validateControls, type ColumnControls } from "./controls.ts";
import { renderColumnSource } from "./renderSource.ts";
import {
  spatialColumn,
  COLUMN_LISTENER,
  COLUMN_POSITION,
  COLUMN_ROOM,
} from "./space.ts";
import { encodeWav } from "../audio/wav.ts";
import { analyzeSignal } from "../audio/analyzeSignal.ts";
import { measureLoudness } from "../audio/measureLoudness.ts";

export async function renderCandidate(
  brief: AudioQualityBrief,
  controls: ColumnControls,
  id: string,
  root: string,
  seed = 2026,
) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id))
    throw new Error("Invalid candidate ID.");
  const values = validateControls(brief, controls),
    directory = join(root, id);
  await mkdir(directory);
  const raw = createColumn(brief, values, seed),
    source = renderColumnSource(raw, brief.duration);
  const audio = spatialColumn(source.pcm, values["room-send"]!),
    signal = analyzeSignal(audio);
  if (!signal.passed)
    throw new Error("Candidate failed its technical signal gate.");
  const sourceBytes = JSON.stringify(source.document, null, 2) + "\n";
  const pcmBytes = encodeWav(audio),
    path = join(directory, "mix.wav");
  const sourcePath = join(directory, "source.function-graph.json");
  await writeFile(sourcePath, sourceBytes, { flag: "wx" });
  await writeFile(path, pcmBytes, { flag: "wx" });
  await writeFile(
    join(directory, "dry.wav"),
    encodeWav({ sampleRate: 48000, channels: [source.pcm] }),
    { flag: "wx" },
  );
  const stems = [];
  for (const node of ["contact", "body", "fracture"]) {
    const document = { ...source.document, output: { node, port: "out" } };
    const stem = renderColumnSource(document, brief.duration);
    const bytes = encodeWav({ sampleRate: 48000, channels: [stem.pcm] });
    await writeFile(join(directory, `${node}.wav`), bytes, { flag: "wx" });
    stems.push({
      node,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const candidate = {
    schema: "typeaudio.quality-candidate",
    version: 1,
    id,
    directory,
    path,
    sourcePath,
    controls: values,
    seed,
    duration: brief.duration,
    sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    audioSha256: createHash("sha256").update(pcmBytes).digest("hex"),
    signal,
    loudness: measureLoudness(path),
    stems,
    picture: {
      youtubeId: "YHCqcyX9N3s",
      start: 145.887,
      contact: 145.937,
      end: 148.887,
      syncVerified: false,
    },
    space: {
      room: COLUMN_ROOM,
      listener: COLUMN_LISTENER,
      position: COLUMN_POSITION,
      spread: 0.2,
      send: values["room-send"],
    },
    sourceProfile: {
      sampleRate: 48000,
      volume: 1,
      onsetFadeFrames: 240,
      endFadeFrames: 1440,
    },
    status: "signal-checked",
    humanAccepted: false,
  };
  await writeFile(
    join(directory, "candidate.json"),
    JSON.stringify(candidate, null, 2) + "\n",
    { flag: "wx" },
  );
  return candidate;
}

export type RenderedCandidate = Awaited<ReturnType<typeof renderCandidate>>;
