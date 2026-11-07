import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { proposeRevision } from "../../src/quality/index.ts";
import { loadPrepared } from "./loadPrepared.ts";
import { budgetJudge } from "./judge/budget.ts";
import { calibrate } from "./judge/calibrate.ts";
import { comparePair } from "./comparePair.ts";
import { renderCandidate } from "./column/renderCandidate.ts";
import { writeReceipt } from "./receipts.ts";
import type { AudioJudge } from "./judge/types.ts";

export async function runLoop(
  directory: string,
  judge: AudioJudge | undefined,
  options: { maxCalls: number; maxRevisions: number },
) {
  if (
    !Number.isInteger(options.maxCalls) ||
    options.maxCalls < 5 ||
    options.maxCalls > 25 ||
    !Number.isInteger(options.maxRevisions) ||
    options.maxRevisions < 0 ||
    options.maxRevisions > 4
  )
    throw new RangeError("Use 5–25 calls and 0–4 revision rounds.");
  const { brief, candidates } = await loadPrepared(directory);
  const audit = join(directory, "evaluation");
  await mkdir(audit);
  const result = {
    schema: "typeaudio.quality-result",
    version: 1,
    status: "blocked",
    phase: "configuration",
    bestCandidate: candidates[0]!.id,
    modelSelected: false,
    modelCriteriaMet: false,
    humanAccepted: false,
    professionalJudgmentValidated: false,
    calls: 0,
    reason:
      "No audio evaluator is configured. Prepared candidates remain unranked.",
    options,
    startedAt: new Date().toISOString(),
    completedAt: "",
  };
  if (!judge) {
    result.completedAt = new Date().toISOString();
    await writeReceipt(join(audit, "result.json"), result);
    return result;
  }
  const requests = join(audit, "requests");
  await mkdir(requests);
  const bounded = budgetJudge(judge, requests, options.maxCalls);
  let best = candidates[0]!,
    pair: Awaited<ReturnType<typeof comparePair>> | undefined;
  try {
    result.phase = "calibration";
    const calibration = await calibrate(
      bounded,
      best.path,
      join(audit, "calibration"),
    );
    if (!calibration.passed) {
      result.reason =
        "Evaluator failed basic audio discrimination or order stability. No candidate was selected.";
    } else {
      result.phase = "comparison";
      for (const candidate of candidates.slice(1)) {
        if (bounded.remaining < 2) break;
        pair = await comparePair(
          bounded,
          brief,
          best,
          candidate,
          join(audit, `compare-${candidate.id}`),
        );
        if (pair.decision.advance) {
          best = candidate;
          result.modelSelected = true;
          result.modelCriteriaMet = pair.decision.modelCriteriaMet;
        }
        result.bestCandidate = best.id;
      }
      for (
        let round = 1;
        pair && round <= options.maxRevisions && bounded.remaining >= 2;
        round++
      ) {
        const side = pair.challenger === best.id ? "B" : "A";
        const revision = proposeRevision(
          brief,
          best.controls,
          pair.forward.comparison,
          pair.reverse.comparison,
          side,
        );
        if (!revision.changes.length) break;
        result.phase = "revision";
        await writeReceipt(join(audit, `revision-${round}.json`), {
          parent: best.id,
          ...revision,
        });
        const candidate = await renderCandidate(
          brief,
          revision.controls,
          `revision-${round}`,
          directory,
          best.seed,
        );
        pair = await comparePair(
          bounded,
          brief,
          best,
          candidate,
          join(audit, `compare-revision-${round}`),
        );
        if (!pair.decision.advance) break;
        best = candidate;
        result.bestCandidate = best.id;
        result.modelSelected = true;
        result.modelCriteriaMet = pair.decision.modelCriteriaMet;
      }
      result.status = result.modelSelected ? "model-selected" : "inconclusive";
      result.reason = result.modelSelected
        ? "Order-consistent model preference recorded; human listening review remains required."
        : "No candidate earned an order-consistent improvement. Preserve the original candidate.";
      result.phase = "complete";
    }
  } catch {
    result.status = "interrupted";
    result.reason =
      "Evaluation or revision failed. Keep the last recorded candidate; inspect the append-only receipts.";
  }
  result.calls = bounded.attempts;
  result.completedAt = new Date().toISOString();
  await writeReceipt(join(audit, "result.json"), result);
  return result;
}
