import { join } from "node:path";
import { validateComparison } from "../../../src/quality/index.ts";
import { sha256, writeReceipt } from "../receipts.ts";
import type { AudioJudge, JudgeInput } from "./types.ts";

/** Count attempts, including failed requests; retain the request before network access. */
export function budgetJudge(
  judge: AudioJudge,
  directory: string,
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 5 || limit > 25)
    throw new RangeError("Use a 5–25 call budget.");
  let attempts = 0,
    resolvedModel: string | undefined;
  const identity = structuredClone(judge.identity);
  return {
    identity,
    get attempts() {
      return attempts;
    },
    get remaining() {
      return limit - attempts;
    },
    async compare(input: JudgeInput) {
      if (attempts >= limit)
        throw new Error("Audio evaluation call budget exhausted.");
      const id = String(++attempts).padStart(2, "0");
      const hashes = { A: sha256(input.a), B: sha256(input.b) };
      await writeReceipt(join(directory, `${id}.request.json`), {
        identity,
        inputSha256: hashes,
        brief: input.brief,
        instruction: input.instruction ?? null,
        requestedAt: new Date().toISOString(),
      });
      try {
        const evidence = await judge.compare(input);
        if (
          JSON.stringify(evidence.identity) !== JSON.stringify(identity) ||
          evidence.inputSha256.A !== hashes.A ||
          evidence.inputSha256.B !== hashes.B ||
          !evidence.resolvedModel ||
          (resolvedModel && resolvedModel !== evidence.resolvedModel)
        )
          throw new Error(
            "Evaluator identity, resolved model or audio hashes changed. Recalibrate in a new run.",
          );
        resolvedModel = evidence.resolvedModel;
        const validated = {
          ...evidence,
          comparison: validateComparison(evidence.comparison, input.brief),
        };
        await writeReceipt(join(directory, `${id}.response.json`), validated);
        return validated;
      } catch (error) {
        // Do not serialize provider exception objects, headers or response bodies.
        await writeReceipt(join(directory, `${id}.failure.json`), {
          status: "failed",
          inputSha256: hashes,
          identity,
          reason:
            "Request failed or returned invalid evidence. Preserve the previous candidate.",
        });
        throw error;
      }
    },
  };
}
