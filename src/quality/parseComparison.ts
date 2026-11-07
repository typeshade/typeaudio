import type { AudioQualityBrief } from "./types.ts";
import { validateComparison } from "./validateComparison.ts";

/** Accept one JSON object, optionally wrapped in a single Markdown JSON fence. */
export function parseComparison(text: string, brief: AudioQualityBrief) {
  if (text.length > 30_000)
    throw new Error("Audio comparison text exceeds its limit.");
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(text.trim());
  return validateComparison(JSON.parse(fenced ? fenced[1]! : text), brief);
}
