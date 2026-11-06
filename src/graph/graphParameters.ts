import type { SoundGraph } from "./types.ts";
import { orderedNodes } from "./orderGraph.ts";
export function graphValues(g: SoundGraph): Float32Array {
  return new Float32Array([
    ...g.parameters.map((p) => p.value),
    ...orderedNodes(g).flatMap((n) => [n.values[0] ?? 0, n.values[1] ?? 0]),
  ]);
}
