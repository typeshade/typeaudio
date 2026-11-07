import type {
  AudioComparison,
  AudioQualityBrief,
  PairDecision,
} from "./types.ts";
import { validateComparison } from "./validateComparison.ts";

/** First comparison: incumbent=A, challenger=B. Second comparison swaps their audio. */
export function chooseCandidate(
  brief: AudioQualityBrief,
  forward: AudioComparison,
  reverse: AudioComparison,
): PairDecision {
  const a = validateComparison(forward, brief),
    b = validateComparison(reverse, brief);
  const decision = (
    advance: boolean,
    reason: string,
    modelCriteriaMet = false,
  ): PairDecision => ({
    advance,
    reason,
    modelCriteriaMet,
    humanAccepted: false,
  });
  if (a.confidence === "low" || b.confidence === "low")
    return decision(
      false,
      "Low-confidence comparison; preserve the incumbent.",
    );
  if (a.preference !== "B" || b.preference !== "A")
    return decision(
      false,
      "No order-consistent preference for the challenger.",
    );
  for (const c of brief.criteria.filter((c) => c.required)) {
    const x = a.criteria.find((v) => v.id === c.id)!,
      y = b.criteria.find((v) => v.id === c.id)!;
    const rank = { meets: 2, partial: 1, fails: 0, uncertain: -1 };
    if ([x.A, x.B, y.A, y.B].includes("uncertain"))
      return decision(false, `Required criterion is uncertain: ${c.id}.`);
    if (rank[x.B] < rank[x.A] || rank[y.A] < rank[y.B])
      return decision(false, `Required criterion regressed: ${c.id}.`);
  }
  const met = brief.criteria
    .filter((c) => c.required)
    .every(
      (c) =>
        a.criteria.find((v) => v.id === c.id)!.B === "meets" &&
        b.criteria.find((v) => v.id === c.id)!.A === "meets",
    );
  return decision(
    true,
    "Both presentation orders prefer the challenger without a required-criterion regression.",
    met,
  );
}
