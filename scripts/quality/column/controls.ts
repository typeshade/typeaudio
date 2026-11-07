import type { AudioQualityBrief } from "../../../src/quality/types.ts";

export type ColumnControls = Record<string, number>;
export const COLUMN_CANDIDATES: { id: string; controls: ColumnControls }[] = [
  {
    id: "dense",
    controls: {
      mass: 1.65,
      hardness: 0.5,
      "body-decay": 0.22,
      "contact-level": 0.65,
      "body-level": 0.8,
      "fracture-level": 0.32,
      "fragment-spacing": 1.1,
      "room-send": 0.18,
    },
  },
  {
    id: "brittle",
    controls: {
      mass: 0.9,
      hardness: 0.86,
      "body-decay": 0.11,
      "contact-level": 0.85,
      "body-level": 0.6,
      "fracture-level": 0.58,
      "fragment-spacing": 0.74,
      "room-send": 0.12,
    },
  },
  {
    id: "resonant",
    controls: {
      mass: 1.3,
      hardness: 0.66,
      "body-decay": 0.3,
      "contact-level": 0.72,
      "body-level": 0.9,
      "fracture-level": 0.24,
      "fragment-spacing": 1.25,
      "room-send": 0.28,
    },
  },
];

export function validateControls(
  brief: AudioQualityBrief,
  input: ColumnControls,
): ColumnControls {
  if (!input || Object.keys(input).length !== brief.controls.length)
    throw new Error("Every declared control must be present.");
  const result: ColumnControls = {};
  for (const c of brief.controls) {
    const value = input[c.id];
    if (!Number.isFinite(value) || value! < c.min || value! > c.max)
      throw new RangeError(`Invalid control: ${c.id}.`);
    result[c.id] = value!;
  }
  return result;
}
