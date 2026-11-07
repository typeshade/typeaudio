import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeWav, encodeWav } from "../audio/wav.ts";
import { sha256, writeReceipt } from "../receipts.ts";

/** A short actual-audio diagnostic. Its result cannot select a production candidate. */
const [source, output] = process.argv.slice(2),
  python = process.env.TYPEAUDIO_AUDIO_PYTHON;
const layout = process.env.TYPEAUDIO_AUDIO_LAYOUT ?? "paired";
if (!["paired", "sequence"].includes(layout))
  throw new Error("Use paired or sequence audio layout.");
if (!source || !output || !python)
  throw new Error(
    "Set TYPEAUDIO_AUDIO_PYTHON; use quality:probe CANDIDATE_DIRECTORY OUTPUT_DIRECTORY.",
  );
const directory = resolve(output);
await mkdir(directory);
const audible = await readFile(join(resolve(source), "mix.wav")),
  pcm = decodeWav(audible);
const silent = encodeWav({
  ...pcm,
  channels: pcm.channels.map((c) => new Float32Array(c.length)),
});
const prompt =
  'Listen to both audio clips. Return only JSON with keys "audible" ("A", "B", "both", or "neither") and "description" (one short sentence describing the audible sound). Do not infer sound from labels.';
const cases = [
  { a: audible, b: silent, expected: "A" },
  { a: silent, b: audible, expected: "B" },
  { a: audible, b: audible, expected: "both" },
];
await writeFile(join(directory, "audible.wav"), audible, { flag: "wx" });
await writeFile(join(directory, "silence.wav"), silent, { flag: "wx" });
await writeReceipt(join(directory, "request.json"), {
  prompt,
  layout,
  maxTokens: 160,
  cases: cases.map((c) => ({
    expected: c.expected,
    inputSha256: { A: sha256(c.a), B: sha256(c.b) },
  })),
});
const child = spawn(
  python,
  [
    fileURLToPath(new URL("./omni.py", import.meta.url)),
    "--trace-dir",
    directory,
    "--layout",
    layout,
  ],
  { stdio: ["pipe", "pipe", "inherit"] },
);
let text = "",
  timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  child.kill();
}, 300_000);
child.stdout.on("data", (data) => {
  text += data.toString();
  if (text.length > 200_000) child.kill();
});
child.stdin.end(
  cases
    .map((c, i) =>
      JSON.stringify({
        id: i + 1,
        prompt,
        a: c.a.toString("base64"),
        b: c.b.toString("base64"),
        maxTokens: 160,
      }),
    )
    .join("\n") + "\n",
);
let code: number | null = null;
try {
  code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
} finally {
  clearTimeout(timer);
  child.kill();
}
await writeFile(join(directory, "raw-output.jsonl"), text, { flag: "wx" });
const records = text
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const checks = cases.map((c, i) => {
  const evidence = records.find((r) => r.id === i + 1);
  let answer: { audible?: string; description?: string } = {};
  try {
    answer = JSON.parse(evidence?.text ?? "{}");
  } catch {
    /* Keep malformed evidence; fail the diagnostic. */
  }
  return {
    expected: c.expected,
    answer,
    passed: Boolean(
      evidence?.finished &&
        answer.audible === c.expected &&
        evidence.inputSha256?.A === sha256(c.a) &&
        evidence.inputSha256?.B === sha256(c.b),
    ),
    evidence,
  };
});
const receipt = {
  schema: "typeaudio.local-audio-probe",
  version: 1,
  createdAt: new Date().toISOString(),
  runtime: records[0]?.identity,
  completed: code === 0 && !timedOut,
  timedOut,
  passed: code === 0 && !timedOut && checks.every((c) => c.passed),
  checks,
  humanAccepted: false,
  modelSelected: false,
};
await writeReceipt(join(directory, "probe.json"), receipt);
console.log(
  JSON.stringify(
    {
      completed: receipt.completed,
      passed: receipt.passed,
      checks: checks.map((c) => ({
        expected: c.expected,
        answer: c.answer,
        passed: c.passed,
      })),
    },
    null,
    2,
  ),
);
if (!receipt.passed) process.exitCode = 2;
