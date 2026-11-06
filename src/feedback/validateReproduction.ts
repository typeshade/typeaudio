import { validateGraph } from "../graph/validateGraph.ts";
import type { GraphEvent, GraphReproduction } from "./types.ts";

const integer = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
const volume = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= 1;
const revision = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const text = (value: unknown) =>
  typeof value === "string" && value.length <= 1024;

export function validateReproduction(raw: unknown): GraphReproduction {
  const r = raw as GraphReproduction;
  if (
    !r ||
    r.format !== "typeaudio.graph-reproduction" ||
    r.version !== 1 ||
    !["snapshot", "sequence"].includes(r.capture) ||
    r.backend !== "cpu" ||
    r.sampleRate !== 48000 ||
    !integer(r.blockFrames, 1, 128) ||
    !integer(r.frames, 1, 480000) ||
    !volume(r.volume) ||
    !Array.isArray(r.events) ||
    r.events.length > 4096 ||
    (r.capture === "snapshot" && r.events.length !== 0)
  )
    throw new Error("Invalid graph reproduction settings.");
  const versions = r.versions;
  if (
    !versions ||
    !(versions.web === null || revision(versions.web)) ||
    !revision(versions.typeaudio) ||
    !revision(versions.typeshade) ||
    typeof versions.dirty !== "boolean"
  )
    throw new Error("Record full Web, TypeAudio and TypeShade revisions.");
  if (
    !r.environment ||
    !text(r.environment.userAgent) ||
    !text(r.environment.platform)
  )
    throw new Error("Invalid reproduction environment.");
  const graph = validateGraph(r.graph);
  let previous = -1;
  const events: GraphEvent[] = r.events.map((event) => {
    if (
      !event ||
      !integer(event.frame, 0, r.frames - 1) ||
      event.frame < previous
    )
      throw new Error(
        "Reproduction events must be ordered by frame inside the render.",
      );
    previous = event.frame;
    if (event.type === "retrigger")
      return { type: event.type, frame: event.frame };
    if (event.type === "volume" && volume(event.value))
      return { type: event.type, frame: event.frame, value: event.value };
    if (
      event.type === "parameters" &&
      Array.isArray(event.values) &&
      event.values.length === 4 &&
      event.values.every(
        (v, i) =>
          Number.isFinite(v) &&
          v >= graph.parameters[i]!.min &&
          v <= graph.parameters[i]!.max,
      )
    )
      return {
        type: event.type,
        frame: event.frame,
        values: [...event.values],
      };
    throw new Error("Invalid reproduction event.");
  });
  // Construct the allowed shape explicitly; generated code, media and unrelated document data are dropped.
  return {
    format: r.format,
    version: 1,
    capture: r.capture,
    versions: {
      web: versions.web,
      typeaudio: versions.typeaudio,
      typeshade: versions.typeshade,
      dirty: versions.dirty,
    },
    environment: {
      userAgent: r.environment.userAgent,
      platform: r.environment.platform,
    },
    backend: "cpu",
    sampleRate: 48000,
    blockFrames: r.blockFrames,
    frames: r.frames,
    volume: r.volume,
    graph,
    events,
  };
}
