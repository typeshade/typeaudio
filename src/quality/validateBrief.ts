import type { AudioQualityBrief } from "./types.ts";

export function validateBrief(value: unknown): AudioQualityBrief {
  const b = value as AudioQualityBrief;
  const id = (v: unknown) =>
    typeof v === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(v);
  const text = (v: unknown) =>
    typeof v === "string" && v.length > 0 && v.length <= 2000;
  if (
    !b ||
    b.schema !== "typeaudio.quality-brief" ||
    b.version !== 1 ||
    !id(b.id) ||
    !text(b.description)
  )
    throw new TypeError("Invalid audio quality brief identity.");
  if (!Number.isFinite(b.duration) || b.duration < 0.1 || b.duration > 10)
    throw new RangeError("Quality comparisons require 0.1–10 seconds.");
  if (
    !Array.isArray(b.layers) ||
    !b.layers.length ||
    b.layers.length > 16 ||
    b.layers.some((v) => !id(v)) ||
    new Set(b.layers).size !== b.layers.length
  )
    throw new TypeError("The brief needs unique layer IDs.");
  if (
    !Array.isArray(b.criteria) ||
    !b.criteria.length ||
    b.criteria.length > 12 ||
    b.criteria.some(
      (v) =>
        !v ||
        !id(v.id) ||
        !text(v.description) ||
        typeof v.required !== "boolean",
    ) ||
    new Set(b.criteria.map((v) => v.id)).size !== b.criteria.length
  )
    throw new TypeError("The brief needs unique, described criteria.");
  if (
    !Array.isArray(b.controls) ||
    b.controls.length > 16 ||
    b.controls.some(
      (v) =>
        !v ||
        !id(v.id) ||
        !text(v.name) ||
        !Number.isFinite(v.min) ||
        !Number.isFinite(v.max) ||
        v.min >= v.max,
    ) ||
    new Set(b.controls.map((v) => v.id)).size !== b.controls.length
  )
    throw new TypeError("The brief needs bounded, unique controls.");
  return structuredClone(b);
}
