import { compile } from "typeshade";
import type { SoundGraph } from "../types.ts";
import type { GraphProgram } from "../program.ts";
import { validateGraph } from "../validateGraph.ts";
import { graphKey } from "../graphIdentity.ts";
import { emitGraphSource } from "./emitGraphSource.ts";
import { generateGraphKernel } from "./generateGraphKernel.ts";
export function compileGraph(raw: SoundGraph): GraphProgram {
  const graph = validateGraph(raw),
    key = graphKey(graph),
    { source, codeRanges, nodes } = emitGraphSource(graph),
    compiled = compile(source, { fileName: "sound-graph.shade.ts" });
  const errors = compiled.diagnostics.filter((d) => d.category === "error");
  if (errors.length)
    throw new Error(
      errors
        .map((d) => {
          const line = d.line ?? 0,
            range = codeRanges.find((r) => line > r.start && line <= r.end);
          return `${range ? `${range.name}, line ${line - range.start}` : "Graph"}: ${d.message}`;
        })
        .join("\n"),
    );

  return {
    key,
    source,
    nodes,
    code: generateGraphKernel(compiled.module, key),
  };
}
