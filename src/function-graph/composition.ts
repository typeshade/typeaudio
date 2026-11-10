import type { FunctionLocation } from "./program.ts";

/** The composition is an editable source projection, never an audio-thread program. */
export const FUNCTION_COMPOSITION_PATH = "/__typeaudio_network.shade.ts";
export interface FunctionComposition {
  source: string;
  nodes: Record<string, FunctionLocation>;
}
