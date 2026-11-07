import type { FunctionGraphProgram } from "../../program.ts";

/** Presentation order and omitted defaults do not change the executable composition. */
export function compositionIdentity(program: FunctionGraphProgram): string {
  const descriptors = new Map(
    program.artifacts.map((a) => [a.descriptor.id, a.descriptor]),
  );
  return JSON.stringify({
    output: program.document.output,
    nodes: [...program.document.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({
        id: n.id,
        definition: n.definition,
        inputs: descriptors
          .get(n.definition)!
          .inputs.map((p) => [
            p.id,
            (() => {
              const b = n.inputs[p.id];
              return !b || b.kind === "constant"
                ? ["constant", b?.value ?? p.default]
                : b.kind === "parameter"
                  ? ["parameter", b.parameter]
                  : ["connection", b.node, b.port];
            })(),
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      })),
  });
}
