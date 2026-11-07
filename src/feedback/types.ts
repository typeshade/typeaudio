import type { SoundGraph } from "../graph/types.ts";

export interface FeedbackVersions {
  web: string | null;
  typeaudio: string;
  typeshade: string;
  dirty: boolean;
}

export type GraphEvent =
  | { frame: number; type: "parameters"; values: number[] }
  | { frame: number; type: "volume"; value: number }
  | { frame: number; type: "retrigger" };

/** Source-only reproduction. It never contains executable JavaScript or user media. */
export interface GraphReproduction {
  format: "typeaudio.graph-reproduction";
  version: 1;
  capture: "snapshot" | "sequence";
  versions: FeedbackVersions;
  environment: { userAgent: string; platform: string };
  backend: "cpu";
  sampleRate: 48000;
  blockFrames: number;
  frames: number;
  volume: number;
  graph: SoundGraph;
  events: GraphEvent[];
}
