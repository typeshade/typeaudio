import type { AudioComparison, AudioQualityBrief } from "./types.ts";
import { validateBrief } from "./validateBrief.ts";

/** Treat model text as untrusted data. It cannot supply source code or commands. */
export function validateComparison(
  value: unknown,
  input: AudioQualityBrief,
): AudioComparison {
  const brief = validateBrief(input),
    v = value as AudioComparison;
  const text = (x: unknown) =>
    typeof x === "string" && x.trim().length > 0 && x.length <= 1200;
  const side = (x: unknown) => x === "A" || x === "B";
  const result = (x: unknown) =>
    ["meets", "partial", "fails", "uncertain"].includes(String(x));
  if (
    !v ||
    !["A", "B", "tie", "inconclusive"].includes(v.preference) ||
    !["low", "medium", "high"].includes(v.confidence)
  )
    throw new TypeError("Invalid audio preference or confidence.");
  if (
    !Array.isArray(v.criteria) ||
    v.criteria.length !== brief.criteria.length ||
    new Set(v.criteria.map((c) => c?.id)).size !== brief.criteria.length ||
    v.criteria.some(
      (c) =>
        !c ||
        !brief.criteria.some((b) => b.id === c.id) ||
        !result(c.A) ||
        !result(c.B) ||
        !text(c.reason),
    )
  )
    throw new TypeError(
      "Every brief criterion needs exactly one audio-based assessment.",
    );
  if (
    !Array.isArray(v.observations) ||
    v.observations.length > 16 ||
    v.observations.some(
      (o) =>
        !o ||
        !side(o.side) ||
        !Number.isFinite(o.start) ||
        !Number.isFinite(o.end) ||
        o.start < 0 ||
        o.end < o.start ||
        o.end > brief.duration ||
        !brief.layers.includes(o.layer) ||
        !text(o.issue),
    )
  )
    throw new TypeError(
      "Audio observations require valid times and known layers.",
    );
  if (
    !Array.isArray(v.revisions) ||
    v.revisions.length > 4 ||
    new Set(v.revisions.map((r) => `${r?.side}:${r?.control}`)).size !==
      v.revisions.length ||
    v.revisions.some((r) => {
      const c = brief.controls.find((c) => c.id === r?.control);
      return (
        !c ||
        !side(r.side) ||
        !Number.isFinite(r.value) ||
        r.value < c.min ||
        r.value > c.max ||
        !text(r.reason)
      );
    })
  )
    throw new TypeError(
      "Audio revisions must name bounded controls; executable edits are not accepted.",
    );
  return {
    preference: v.preference,
    confidence: v.confidence,
    criteria: v.criteria.map(({ id, A, B, reason }) => ({ id, A, B, reason })),
    observations: v.observations.map(({ side, start, end, layer, issue }) => ({
      side,
      start,
      end,
      layer,
      issue,
    })),
    revisions: v.revisions.map(({ side, control, value, reason }) => ({
      side,
      control,
      value,
      reason,
    })),
  };
}
