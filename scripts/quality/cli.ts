import { resolve, join } from "node:path";
import { prepare } from "./prepare.ts";
import { runLoop } from "./runLoop.ts";
import { openaiAudio } from "./judge/openaiAudio.ts";
import { LocalOmni } from "./judge/localOmni.ts";

const [command, output, ...flags] = process.argv.slice(2);
if (
  !["prepare", "run", "evaluate"].includes(command ?? "") ||
  !output ||
  flags.length % 2
)
  throw new Error(
    "Usage: bun run quality <prepare|run|evaluate> DIRECTORY [--max-calls 13] [--max-revisions 2]",
  );
const options = { maxCalls: 13, maxRevisions: 2 };
const seen = new Set<string>();
for (let i = 0; i < flags.length; i += 2) {
  const flag = flags[i]!,
    value = Number(flags[i + 1]);
  if (
    seen.has(flag) ||
    !["--max-calls", "--max-revisions"].includes(flag) ||
    !Number.isInteger(value)
  )
    throw new Error("Invalid or duplicate evaluation budget option.");
  seen.add(flag);
  if (flag === "--max-calls") options.maxCalls = value;
  else options.maxRevisions = value;
}
if (
  options.maxCalls < 5 ||
  options.maxCalls > 25 ||
  options.maxRevisions < 0 ||
  options.maxRevisions > 4
)
  throw new RangeError("Use 5–25 calls and 0–4 revision rounds.");
const directory = resolve(output);
try {
  if (command !== "evaluate") {
    const prepared = await prepare(directory);
    console.log(
      JSON.stringify({
        status: "prepared",
        directory,
        candidates: prepared.candidates.map((c) => c.id),
        humanAccepted: false,
      }),
    );
  }
  if (command !== "prepare") {
    const apiKey = process.env.OPENAI_API_KEY,
      model = process.env.TYPEAUDIO_AUDIO_MODEL;
    const python = process.env.TYPEAUDIO_AUDIO_PYTHON;
    const judge = python
      ? await LocalOmni.start(python, join(directory, "local-model"))
      : apiKey && model
        ? openaiAudio({ apiKey, model })
        : undefined;
    const result = await (async () => {
      try {
        return await runLoop(directory, judge, options);
      } finally {
        if (judge instanceof LocalOmni) judge.close();
      }
    })();
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "blocked" || result.status === "interrupted")
      process.exitCode = 2;
  }
} catch {
  console.error(
    "Quality run failed. Check the new output directory, input receipts, FFmpeg and configuration. Existing artifacts are preserved.",
  );
  process.exitCode = 1;
}
