import type { SoundGraph } from "./types.ts";
/** The graph is required at runtime; optional typing accepts validated consumer patches. */
export interface GraphVoiceOptions {
  graph?: SoundGraph | null;
  volume: number;
}
