import impact from "../../fixtures/function-graph/impact.json";
import { compileFunctionGraph } from "../../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../../src/function-graph/runtime/index.ts";
import type {
  FunctionGraphDocument,
  PortMetadata,
} from "../../src/function-graph/types.ts";
import { validateFunctionDocument } from "../../src/function-graph/validateDocument.ts";

export const audio = (id: string): PortMetadata => ({
  id,
  role: "audio",
  rate: "sample",
  unit: "amplitude",
});
export const control = (id: string): PortMetadata => ({
  id,
  role: "control",
  rate: "block",
});
export const example = () => validateFunctionDocument(impact);
export function install(g: FunctionGraphDocument) {
  const program = compileFunctionGraph(g);
  // Only trusted compiler output; project JSON never contains executable JavaScript.
  for (const artifact of program.artifacts) new Function(artifact.code)();
  return program;
}
export function render(dsp: FunctionGraphDsp, length = 2048, block = 128) {
  const pcm = new Float32Array(length),
    out = new Float32Array(block);
  for (let at = 0; at < length; at += block) {
    const n = Math.min(block, length - at);
    if (!dsp.process(out, n)) throw dsp.fault;
    pcm.set(out.subarray(0, n), at);
  }
  return pcm;
}
export function one(
  source: string,
  inputs: Record<string, PortMetadata> = {},
): FunctionGraphDocument {
  return {
    schema: "typeaudio.function-graph",
    version: 1,
    modules: { "/unit.shade.ts": source },
    definitions: [
      {
        id: "unit",
        version: 1,
        module: "/unit.shade.ts",
        export: "process",
        inputs,
        output: audio("out"),
      },
    ],
    nodes: [{ id: "first", definition: "unit", inputs: {} }],
    parameters: [],
    output: { node: "first", port: "out" },
  };
}
export function accumulator() {
  const g = one(
    `"use typeshade";
export class State { value: f32 = 0; }
export function initialize(): State { return new State(); }
function bump(value: inout<f32>, increment: f32): f32 { value += increment; return value; }
function advance(state: inout<State>, input: f32): f32 { const first: f32 = bump(state.value, input); return first + bump(state.value, input); }
export function process(state: inout<State>, input: f32): f32 { return advance(state, input); }
`,
    { input: { ...audio("in"), default: 0.125 } },
  );
  g.definitions[0]!.state = {
    parameter: "state",
    initializer: "initialize",
    version: 1,
  };
  return g;
}
