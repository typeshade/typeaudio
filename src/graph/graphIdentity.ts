import type { SoundGraph } from "./types.ts";
export function graphKey(g: SoundGraph): string {
  return JSON.stringify(
    [...g.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => [
        n.id,
        n.kind,
        n.code,
        Object.entries(n.inputs).sort(([a], [b]) => a.localeCompare(b)),
        n.bypass,
      ]),
  );
}
