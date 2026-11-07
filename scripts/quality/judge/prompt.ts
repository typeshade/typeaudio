import type { AudioQualityBrief } from "../../../src/quality/types.ts";

export const PROMPT_VERSION = "typeaudio-audio-comparison-1";

export function comparisonPrompt(
  brief: AudioQualityBrief,
  instruction = "",
): string {
  return `Evaluate the two attached AUDIO signals. Names A and B are anonymous presentation labels.
Do not infer quality from labels, code, file size, or the design description. Listen to actual audio.
If you cannot access the audio, return preference=inconclusive, confidence=low, and uncertain criteria.
Judge this effects-only brief. No dialogue or music is required. Do not reward loudness alone.
Brief: ${JSON.stringify(brief)}
Additional evaluation instruction: ${instruction || "Compare material plausibility, contact hierarchy, weight, fragment motion and space."}
Return ONLY one JSON object:
{"preference":"A|B|tie|inconclusive","confidence":"low|medium|high",
"criteria":[{"id":"exact brief criterion ID","A":"meets|partial|fails|uncertain","B":"meets|partial|fails|uncertain","reason":"specific audible evidence"}],
"observations":[{"side":"A|B","start":0.0,"end":0.1,"layer":"one brief layer ID","issue":"time-specific audible issue"}],
"revisions":[{"side":"A|B","control":"one brief control ID","value":0.5,"reason":"bounded hypothesis to test"}]}
Include every criterion exactly once. Times are seconds within the attached clip.
Use at most 16 observations and 4 revisions. Only propose the listed controls within their ranges.
Revisions are hypotheses, not proof of improvement. Do not output code, URLs, commands, or claims of human approval.`;
}
