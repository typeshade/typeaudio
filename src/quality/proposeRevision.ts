import type { AudioComparison, AudioQualityBrief, AudioSide } from "./types.ts";
import { validateComparison } from "./validateComparison.ts";

/** Apply only edits corroborated in both orders, within 5% of the declared control range. */
export function proposeRevision(
  brief: AudioQualityBrief,
  current: Record<string, number>,
  forward: AudioComparison,
  reverse: AudioComparison,
  side: AudioSide,
) {
  const a = validateComparison(forward, brief),
    b = validateComparison(reverse, brief);
  if (a.confidence === "low" || b.confidence === "low")
    return { controls: { ...current }, changes: [] };
  const other = side === "A" ? "B" : "A",
    controls = { ...current };
  const changes: {
    control: string;
    before: number;
    after: number;
    reasons: string[];
  }[] = [];
  for (const x of a.revisions.filter((r) => r.side === side)) {
    const y = b.revisions.find(
      (r) => r.side === other && r.control === x.control,
    );
    const spec = brief.controls.find((c) => c.id === x.control)!;
    if (!y || Math.abs(x.value - y.value) > (spec.max - spec.min) * 0.05)
      continue;
    const value = (x.value + y.value) / 2;
    if (
      !Number.isFinite(current[x.control]) ||
      Math.abs(value - current[x.control]!) < 1e-6
    )
      continue;
    changes.push({
      control: x.control,
      before: current[x.control]!,
      after: value,
      reasons: [x.reason, y.reason],
    });
    controls[x.control] = value;
  }
  return { controls, changes };
}
