import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeWav, encodeWav } from "../audio/wav.ts";
import { matchPair } from "../audio/matchPair.ts";
import { writeReceipt } from "../receipts.ts";
import type { AudioQualityBrief } from "../../../src/quality/types.ts";
import type { AudioJudge } from "./types.ts";

/** Basic discrimination only. It does not calibrate professional sound-design judgment. */
export async function calibrate(
  judge: AudioJudge,
  positivePath: string,
  directory: string,
) {
  await mkdir(directory);
  const good = await readFile(positivePath),
    pcm = decodeWav(good);
  const brief: AudioQualityBrief = {
    schema: "typeaudio.quality-brief",
    version: 1,
    id: "audio-discrimination",
    description:
      "Compare actual audio for a clean, audible sound. Prefer non-silent over silent audio, and undistorted over deliberately hard-clipped audio. Identical audio is a tie. This is a signal discrimination test, not an artistic preference test.",
    duration: pcm.channels[0]!.length / pcm.sampleRate,
    layers: ["mix"],
    criteria: [
      {
        id: "audible-clean",
        description: "Audible signal without severe hard-clipping distortion.",
        required: true,
      },
    ],
    controls: [],
  };
  const silence = encodeWav({
    ...pcm,
    channels: pcm.channels.map((c) => new Float32Array(c.length)),
  });
  const distorted = encodeWav({
    ...pcm,
    channels: pcm.channels.map((c) =>
      Float32Array.from(c, (v) => Math.max(-0.7, Math.min(0.7, v * 50))),
    ),
  });
  await writeFile(join(directory, "clean.wav"), good, { flag: "wx" });
  await writeFile(join(directory, "silence.wav"), silence, { flag: "wx" });
  await writeFile(join(directory, "distorted.wav"), distorted, { flag: "wx" });
  const matched = await matchPair(
    join(directory, "clean.wav"),
    join(directory, "distorted.wav"),
    directory,
  );
  const a = await readFile(matched.outputs[0]!.path),
    b = await readFile(matched.outputs[1]!.path);
  const tests = [
    { name: "audibility-forward", a: good, b: silence, expected: "A" },
    { name: "audibility-reverse", a: silence, b: good, expected: "B" },
    { name: "identical", a: good, b: good, expected: "tie" },
    { name: "distortion-forward", a, b, expected: "A" },
    { name: "distortion-reverse", a: b, b: a, expected: "B" },
  ] as const;
  const checks = [];
  for (const test of tests) {
    const evidence = await judge.compare({ brief, a: test.a, b: test.b });
    const passed =
      evidence.comparison.preference === test.expected &&
      evidence.comparison.confidence !== "low";
    checks.push({ name: test.name, expected: test.expected, passed, evidence });
  }
  const receipt = {
    schema: "typeaudio.audio-calibration",
    version: 1,
    createdAt: new Date().toISOString(),
    identity: judge.identity,
    passed: checks.every((c) => c.passed),
    checks,
    levelMatch: matched,
    professionalJudgmentValidated: false,
    humanAccepted: false,
  };
  await writeReceipt(join(directory, "calibration.json"), receipt);
  return receipt;
}
