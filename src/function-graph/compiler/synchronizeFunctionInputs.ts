import type { FunctionGraphDocument } from "../types.ts";
import { validateFunctionDocument } from "../validateDocument.ts";
import { readFunction } from "./readFunction.ts";
import { FunctionCompileError } from "./diagnostics.ts";

/** Opt-in source-edit preparation. Import and runtime compilation stay strict. */
export function synchronizeFunctionInputs(raw: unknown): FunctionGraphDocument {
  const graph = validateFunctionDocument(raw);
  for (const definition of graph.definitions) {
    const { entry } = readFunction(graph.modules, definition);
    const fail = (message: string): never => {
      throw new FunctionCompileError([
        {
          definition: definition.id,
          file: definition.module,
          line: (entry.span?.line ?? 0) + 1,
          column: (entry.span?.character ?? 0) + 1,
          message,
        },
      ]);
    };
    // Preserve stable IDs and authored audio semantics for existing source names.
    for (const [name, port] of Object.entries(definition.inputs)) {
      if (entry.params.some((p) => p.name === name)) continue;
      const connected = graph.nodes.some(
        (n) =>
          n.definition === definition.id &&
          n.inputs[port.id] &&
          n.inputs[port.id]!.kind !== "constant",
      );
      if (connected)
        fail(
          `${name}: disconnect this input from every instance before removing or renaming the parameter.`,
        );
      delete definition.inputs[name];
      for (const node of graph.nodes)
        if (node.definition === definition.id) delete node.inputs[port.id];
    }
    const ids = new Set(Object.values(definition.inputs).map((p) => p.id));
    for (const parameter of entry.params) {
      if (
        Object.hasOwn(definition.inputs, parameter.name) ||
        Object.hasOwn(definition.context ?? {}, parameter.name) ||
        definition.state?.parameter === parameter.name
      )
        continue;
      if (
        parameter.mode ||
        parameter.type.kind !== "scalar" ||
        !["f32", "i32", "u32", "bool"].includes(parameter.type.scalar)
      )
        fail(
          `${parameter.name}: new inputs need a scalar type. State needs an explicit initializer binding in the function document.`,
        );
      let id = parameter.name,
        suffix = 1;
      while (ids.has(id)) id = `${parameter.name.slice(0, 56)}_${suffix++}`;
      ids.add(id);
      definition.inputs[parameter.name] = {
        id,
        role: "control",
        rate: "block",
        default:
          parameter.type.kind === "scalar" && parameter.type.scalar === "bool"
            ? false
            : 0,
      };
    }
  }
  return validateFunctionDocument(graph);
}
