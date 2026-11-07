import type { GraphNode } from "./types.ts";
import type { SoundGraph } from "./types.ts";
/** Evaluate every node once; reject cycles before they can reach audio processing. */
export function orderedNodes(g: SoundGraph): GraphNode[] {
  const result: GraphNode[] = [],
    active = new Set<string>(),
    done = new Set<string>(),
    map = new Map(g.nodes.map((n) => [n.id, n]));
  function visit(n: GraphNode) {
    if (active.has(n.id))
      throw new Error(
        "This connection creates a cycle. Feedback requires a dedicated delay node.",
      );
    if (done.has(n.id)) return;
    active.add(n.id);
    // The compile key ignores object insertion order, so evaluation and parameter
    // layout must use the same canonical port order after JSON round trips.
    for (const [, id] of Object.entries(n.inputs).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const source = map.get(id);
      if (!source) throw new Error("Missing graph source.");
      visit(source);
    }
    active.delete(n.id);
    done.add(n.id);
    result.push(n);
  }
  for (const n of [...g.nodes].sort((a, b) => a.id.localeCompare(b.id)))
    visit(n);
  return result;
}
