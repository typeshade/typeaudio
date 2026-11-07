import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  FunctionDefinition,
  FunctionGraphDocument,
  FunctionInstance,
  InputBinding,
} from "../../../src/function-graph/types.ts";
import type { AudioQualityBrief } from "../../../src/quality/types.ts";
import { validateControls, type ColumnControls } from "./controls.ts";

const audio = { role: "audio", rate: "sample", unit: "amplitude" } as const;
const control = { role: "control", rate: "block" } as const;
const constant = (value: number): InputBinding => ({ kind: "constant", value });
const parameter = (id: string): InputBinding => ({
  kind: "parameter",
  parameter: id,
});
const connection = (node: string): InputBinding => ({
  kind: "connection",
  node,
  port: "out",
});

export function createColumn(
  brief: AudioQualityBrief,
  input: ColumnControls,
  seed = 2026,
): FunctionGraphDocument {
  const values = validateControls(brief, input);
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
    throw new RangeError("Seed must be a nonzero u32.");
  const modules: Record<string, string> = {};
  for (const name of ["contact", "mode", "fragment", "mix"]) {
    const path = fileURLToPath(
      new URL(
        `../../../fixtures/quality/column-impact/${name}.shade.ts`,
        import.meta.url,
      ),
    );
    modules[`/${name}.shade.ts`] = readFileSync(path, "utf8").replace(
      "seed: u32 = 2026",
      `seed: u32 = ${seed}`,
    );
  }
  function definition(
    id: string,
    module: string,
    name: string,
    inputs: string[],
    controls: string[],
    state?: string,
  ): FunctionDefinition {
    return {
      id,
      version: 1,
      module: `/${module}.shade.ts`,
      export: name,
      inputs: Object.fromEntries([
        ...inputs.map((id) => [id, { id, ...audio }]),
        ...controls.map((id) => [id, { id, ...control }]),
      ]),
      output: { id: "out", ...audio },
      ...(state
        ? { state: { parameter: "state", initializer: state, version: 1 } }
        : {}),
    };
  }
  const definitions = [
    {
      ...definition(
        "contact",
        "contact",
        "contact",
        [],
        ["hardness", "level"],
        "createContact",
      ),
      context: { time: "time" as const },
    },
    {
      ...definition(
        "mode",
        "mode",
        "mode",
        ["input"],
        ["frequency", "mass", "decay", "weight"],
        "createMode",
      ),
      context: { sampleRate: "sampleRate" as const },
    },
    {
      ...definition(
        "fragment",
        "fragment",
        "fragment",
        [],
        ["onset", "spacing", "frequency", "size", "level"],
        "createFragment",
      ),
      context: { time: "time" as const, sampleRate: "sampleRate" as const },
    },
    definition(
      "sum-six",
      "mix",
      "sumSix",
      ["a", "b", "c", "d", "e", "f"],
      ["level"],
    ),
    definition(
      "sum-eight",
      "mix",
      "sumEight",
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      ["level"],
    ),
    definition("mix", "mix", "mix", ["contact", "body", "fracture"], []),
  ];
  const nodes: FunctionInstance[] = [
    {
      id: "contact",
      definition: "contact",
      inputs: {
        hardness: parameter("hardness"),
        level: parameter("contact-level"),
      },
    },
  ];
  [113, 179, 283, 461, 727, 1171].forEach((frequency, i) =>
    nodes.push({
      id: `mode-${i}`,
      definition: "mode",
      inputs: {
        input: connection("contact"),
        frequency: constant(frequency),
        mass: parameter("mass"),
        decay: parameter("body-decay"),
        weight: constant(0.18 / (1 + i * 0.65)),
      },
    }),
  );
  nodes.push({
    id: "body",
    definition: "sum-six",
    inputs: {
      ...Object.fromEntries(
        ["a", "b", "c", "d", "e", "f"].map((p, i) => [
          p,
          connection(`mode-${i}`),
        ]),
      ),
      level: parameter("body-level"),
    },
  });
  let random = seed >>> 0;
  const next = () => {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    return (random >>> 0) / 0x100000000;
  };
  [0.032, 0.079, 0.147, 0.263, 0.431, 0.706, 1.103, 1.52].forEach(
    (onset, i) => {
      nodes.push({
        id: `fragment-${i}`,
        definition: "fragment",
        inputs: {
          onset: constant(onset * (0.82 + next() * 0.36)),
          spacing: parameter("fragment-spacing"),
          frequency: constant(340 + i * 137 + next() * 210),
          size: constant(1 / (1 + i * 0.5)),
          level: constant((0.65 + next() * 0.35) / (1 + i * 0.6)),
        },
      });
    },
  );
  nodes.push({
    id: "fracture",
    definition: "sum-eight",
    inputs: {
      ...Object.fromEntries(
        ["a", "b", "c", "d", "e", "f", "g", "h"].map((p, i) => [
          p,
          connection(`fragment-${i}`),
        ]),
      ),
      level: parameter("fracture-level"),
    },
  });
  nodes.push({
    id: "mix",
    definition: "mix",
    inputs: {
      contact: connection("contact"),
      body: connection("body"),
      fracture: connection("fracture"),
    },
  });
  return {
    schema: "typeaudio.function-graph",
    version: 1,
    modules,
    definitions,
    nodes,
    parameters: brief.controls
      .filter((c) => c.id !== "room-send")
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: "f32",
        min: c.min,
        max: c.max,
        value: values[c.id]!,
      })),
    output: { node: "mix", port: "out" },
  };
}
