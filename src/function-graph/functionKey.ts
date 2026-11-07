import type { FunctionDefinition } from "./types.ts";
/** Full identity, not a collision-prone content hash. Layout/instance controls are excluded. */
export function functionKey(
  modules: Record<string, string>,
  definition: FunctionDefinition,
) {
  return JSON.stringify([
    "function-cpu-v1@87af4eb0d9d15f02b66b8341b72cab0944290472",
    Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)),
    definition,
  ]);
}
