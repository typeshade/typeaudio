import type { FunctionGraphDocument, InputBinding } from "./types.ts";
import type { FunctionDescriptor } from "./program.ts";
import { scalarValue } from "./scalarValue.ts";

export function validateFunctionConnections(
  g: FunctionGraphDocument,
  descriptors: FunctionDescriptor[],
) {
  const definitions = new Map(descriptors.map((d) => [d.id, d]));
  const nodes = new Map(g.nodes.map((n) => [n.id, n]));
  const parameters = new Map(g.parameters.map((p) => [p.id, p]));
  for (const n of g.nodes) {
    const d = definitions.get(n.definition);
    if (!d) throw new Error(`${n.id}: missing function descriptor.`);
    for (const id of Object.keys(n.inputs))
      if (!d.inputs.some((p) => p.id === id))
        throw new Error(`${n.id}.${id}: port no longer exists.`);
    for (const p of d.inputs) {
      const b: InputBinding | undefined = n.inputs[p.id];
      const label = `${n.id}.${p.id}`;
      if (!b) {
        if (p.default === undefined)
          throw new Error(`${label}: connect an input or provide a default.`);
        scalarValue(p.default, p.type, label);
        continue;
      }
      if (b.kind === "constant") {
        scalarValue(b.value, p.type, label);
        continue;
      }
      const actual =
        b.kind === "parameter"
          ? (() => {
              const param = parameters.get(b.parameter);
              if (!param) throw new Error(`${label}: missing parameter.`);
              return { ...param, role: "control", rate: "block" };
            })()
          : (() => {
              const source = nodes.get(b.node),
                from = source && definitions.get(source.definition)?.output;
              if (!from || from.id !== b.port)
                throw new Error(
                  `${label}: missing source node or output port.`,
                );
              return from;
            })();
      if (
        actual.type !== p.type ||
        actual.role !== p.role ||
        actual.rate !== p.rate ||
        (actual.unit ?? "") !== (p.unit ?? "")
      )
        throw new Error(
          `${label}: expected ${p.type} ${p.role}/${p.rate} ${p.unit ?? "unitless"}; got ${actual.type} ${actual.role}/${actual.rate} ${actual.unit ?? "unitless"}. Use an explicit conversion.`,
        );
    }
  }
  const outputNode = nodes.get(g.output.node),
    output = outputNode && definitions.get(outputNode.definition)?.output;
  if (
    !output ||
    output.id !== g.output.port ||
    output.role !== "audio" ||
    output.type !== "f32" ||
    output.rate !== "sample"
  )
    throw new Error(
      "This profile needs one f32 sample-rate mono audio output.",
    );
  const visiting = new Set<string>(),
    done = new Set<string>(),
    order: string[] = [];
  function visit(id: string) {
    if (visiting.has(id))
      throw new Error(
        `${id}: algebraic cycle; feedback needs an explicit supported delay.`,
      );
    if (done.has(id)) return;
    visiting.add(id);
    for (const b of Object.values(nodes.get(id)!.inputs))
      if (b.kind === "connection") visit(b.node);
    visiting.delete(id);
    done.add(id);
    order.push(id);
  }
  for (const n of g.nodes) visit(n.id);
  // Validate the whole document, but execute only dependencies of the output.
  done.clear();
  order.length = 0;
  visit(g.output.node);
  return order;
}
