import type { SoundGraph } from "./types.ts";
import { DEFINITIONS } from "./catalog.ts";
import { orderedNodes } from "./orderGraph.ts";
const number = (v: unknown, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`Graph value must be between ${min} and ${max}.`);
  return v;
};

export function validateGraph(raw: unknown): SoundGraph {
  const g = raw as SoundGraph;
  if (
    !g ||
    g.version !== 1 ||
    !Array.isArray(g.nodes) ||
    !g.nodes.length ||
    g.nodes.length > 16 ||
    !Array.isArray(g.parameters) ||
    g.parameters.length !== 4
  )
    throw new Error("A graph needs 1–16 nodes and four exposed parameters.");
  const ids = new Set<string>();
  const nodes = g.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(n.id) ||
      ids.has(n.id) ||
      !Object.hasOwn(DEFINITIONS, n.kind) ||
      typeof n.name !== "string" ||
      !n.name.trim() ||
      n.name.length > 40 ||
      typeof n.bypass !== "boolean" ||
      !n.inputs ||
      typeof n.inputs !== "object" ||
      Array.isArray(n.inputs) ||
      typeof n.code !== "string" ||
      n.code.length > 1800
    )
      throw new Error("Invalid graph node.");
    const def = DEFINITIONS[n.kind];
    ids.add(n.id);
    if (!Array.isArray(n.values) || n.values.length !== def.controls.length)
      throw new Error("Invalid node parameters.");
    const values = n.values.map((v, i) => {
      const c = def.controls[i]!;
      number(v, c.min, c.max);
      if (c.step === 1 && !Number.isInteger(v))
        throw new Error(`${c.name} must be a whole number.`);
      return v;
    });
    const inputs: Record<string, string> = {};
    for (const [port, id] of Object.entries(n.inputs)) {
      if (!Object.hasOwn(def.inputs, port) || typeof id !== "string")
        throw new Error("Invalid graph connection.");
      inputs[port] = id;
    }
    if (n.kind === "output" && n.bypass)
      throw new Error("The output cannot be bypassed.");
    return {
      id: n.id,
      kind: n.kind,
      name: n.name,
      x: number(n.x, -10000, 10000),
      y: number(n.y, -10000, 10000),
      inputs,
      values,
      code: n.kind === "code" ? n.code : "",
      bypass: n.bypass,
    };
  });
  if (
    nodes.filter((n) => n.kind === "output").length !== 1 ||
    nodes.filter((n) => n.kind === "code").length > 2
  )
    throw new Error(
      "A graph needs one Output and supports up to two Code nodes.",
    );
  for (const n of nodes)
    for (const [port, id] of Object.entries(n.inputs)) {
      const from = nodes.find((n) => n.id === id);
      if (
        !from ||
        from.kind === "output" ||
        DEFINITIONS[from.kind].output !== DEFINITIONS[n.kind].inputs[port]
      )
        throw new Error(
          "Connect audio to audio, and controls to control inputs.",
        );
    }
  const parameters = g.parameters.map((p) => {
    if (
      !p ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 32
    )
      throw new Error("Name each exposed parameter.");
    number(p.min, -16000, 16000);
    number(p.max, -16000, 16000);
    if (p.min >= p.max)
      throw new Error("Parameter maximum must exceed its minimum.");
    return {
      name: p.name,
      min: p.min,
      max: p.max,
      value: number(p.value, p.min, p.max),
    };
  });
  const result = { version: 1 as const, nodes, parameters };
  orderedNodes(result);
  return result;
}
