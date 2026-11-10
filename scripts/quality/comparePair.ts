import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chooseCandidate } from "../../src/quality/index.ts";
import type { AudioQualityBrief } from "../../src/quality/types.ts";
import type { AudioJudge } from "./judge/types.ts";
import { matchPair } from "./audio/matchPair.ts";
import { writeReceipt } from "./receipts.ts";
import type { RenderedCandidate } from "./column/renderCandidate.ts";

/** Keep names and source code out of the judge's input; only anonymous PCM and the brief enter. */
export async function comparePair(
  judge: AudioJudge,
  brief: AudioQualityBrief,
  incumbent: RenderedCandidate,
  challenger: RenderedCandidate,
  directory: string,
) {
  await mkdir(directory);
  const matched = await matchPair(incumbent.path, challenger.path, directory);
  const a = await readFile(matched.outputs[0]!.path),
    b = await readFile(matched.outputs[1]!.path);
  const forward = await judge.compare({ brief, a, b });
  const reverse = await judge.compare({ brief, a: b, b: a });
  const decision = chooseCandidate(
    brief,
    forward.comparison,
    reverse.comparison,
  );
  const result = {
    incumbent: incumbent.id,
    challenger: challenger.id,
    matched,
    forward,
    reverse,
    decision,
  };
  await writeReceipt(join(directory, "comparison.json"), result);
  return result;
}
