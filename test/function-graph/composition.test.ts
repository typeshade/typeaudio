import { expect, it } from "vitest";
import {
  compileFunctionGraph,
  applyFunctionComposition,
  projectFunctionComposition,
  compositionIdentity,
  renameFunctionInput,
} from "../../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../../src/function-graph/runtime/index.ts";
import { example, install, render } from "./helpers.ts";

it("projects genuine TypeShade calls, typed context/state and stable node IDs with identical PCM", () => {
  const g = example(),
    program = compileFunctionGraph(g),
    projection = projectFunctionComposition(program);
  expect(projection.source).toContain(
    "resonator(bodyState, noise, pitch, damping, sampleRate)",
  );
  expect(projection.source).toContain("noiseState: inout<NoiseState>");
  const applied = applyFunctionComposition(program, projection.source);
  expect(applied.program.document).toEqual(g);
  expect(
    render(new FunctionGraphDsp(install(applied.program.document))),
  ).toEqual(render(new FunctionGraphDsp(install(g))));
  expect(projection.nodes.body!.line).toBeGreaterThan(10);
});
it("maps edited calls to connections and constants, preserves identity across local variable rename", () => {
  const program = compileFunctionGraph(example()),
    source = projectFunctionComposition(program).source;
  const changed = source
    .replace("gain(body, strength, time)", "gain(noise, 0.1, time)")
    .replace("const level:", "const finalSignal:")
    .replace("return level;", "return finalSignal;");
  const next = applyFunctionComposition(program, changed).program;
  expect(next.document.nodes[2]!.id).toBe("level");
  expect(next.document.nodes[2]!.inputs).toEqual({
    in: { kind: "connection", node: "noise", port: "out" },
    strength: { kind: "constant", value: 0.1 },
  });
  expect(projectFunctionComposition(next, changed).source).toBe(changed);
});
it("projects visual reconnection without erasing comments or unrelated helper functions", () => {
  const program = compileFunctionGraph(example());
  const source =
    projectFunctionComposition(program)
      .source.replace(
        "  const level:",
        "  // Keep the transient note.\n  const level:",
      )
      .replace(
        "gain(body, strength, time)",
        "gain(/* keep gain intent */ body, strength, time)",
      ) + "\nexport function unrelated(value:f32):f32 { return value * 2; }\n";
  const next = structuredClone(program);
  next.document.nodes[2]!.inputs.in = {
    kind: "connection",
    node: "noise",
    port: "out",
  };
  const projected = projectFunctionComposition(next, source);
  expect(projected.source).toContain("Keep the transient note.");
  expect(projected.source).toContain("keep gain intent");
  expect(projected.source).toContain(
    "export function unrelated(value:f32):f32 { return value * 2; }",
  );
  expect(
    compositionIdentity(
      applyFunctionComposition(next, projected.source).program,
    ),
  ).toBe(compositionIdentity(next));
});
it("adds and removes call instances and preserves state ownership and comments", () => {
  const program = compileFunctionGraph(example()),
    source = projectFunctionComposition(program).source;
  const next = applyFunctionComposition(
    program,
    source.replace(
      "  return level;",
      "  // Second stage\n  const second: f32 = gain(level, 0.5, time);\n  return second;",
    ),
  ).program;
  expect(next.document.output.node).toBe("second");
  expect(next.document.nodes.at(-1)!.definition).toBe("gain");
  const projected = projectFunctionComposition(
    program,
    projectFunctionComposition(next).source.replace(
      "  const second:",
      "  // Preserve this deleted-stage note\n  const second:",
    ),
  );
  expect(projected.source).toContain("Preserve this deleted-stage note");
  expect(
    applyFunctionComposition(program, projected.source).program.document.nodes,
  ).toHaveLength(3);
  const shared = source.replace("bodyState, noise", "noiseState, noise");
  expect(() => applyFunctionComposition(program, shared)).toThrow();
});
it("rejects unsupported statements and audio-role mismatches at source locations", () => {
  const program = compileFunctionGraph(example()),
    source = projectFunctionComposition(program).source;
  expect(() =>
    applyFunctionComposition(
      program,
      source.replace("return level;", "if (time > 1) return 0; return level;"),
    ),
  ).toThrow(/Composition supports/);
  expect(() =>
    applyFunctionComposition(
      program,
      source.replace(
        "gain(body, strength, time)",
        "gain(body * 0.5, strength, time)",
      ),
    ),
  ).toThrow(/processing expressions/);
  expect(() =>
    applyFunctionComposition(
      program,
      source.replace("gain(body, strength, time)", "gain(body, pitch, time)"),
    ),
  ).toThrow(/linear-gain/);
  expect(() =>
    applyFunctionComposition(
      program,
      source.replace("return level;", "return missing;"),
    ),
  ).toThrow(/__typeaudio_network.shade.ts/);
});
it("renames a connected source parameter through TypeShade while preserving its wire, state and PCM", () => {
  const g = example(),
    before = JSON.stringify(g),
    next = renameFunctionInput(g, "resonator", "in", "excitationInput");
  expect(JSON.stringify(g)).toBe(before);
  expect(next.definitions[1]!.inputs.excitationInput!.id).toBe("in");
  expect(next.nodes).toEqual(g.nodes);
  expect(next.modules["/resonator.shade.ts"]).toContain(
    "excitationInput * 0.015",
  );
  expect(next.modules["/resonator.shade.ts"]).toContain(
    "function advance(state: inout<ResonatorState>, input: f32",
  );
  const previous = new FunctionGraphDsp(install(g));
  render(previous, 128);
  const replacement = new FunctionGraphDsp(install(next), { previous });
  expect(render(replacement)).toEqual(render(previous));
  expect(() => renameFunctionInput(g, "resonator", "in", "pitch")).toThrow(
    /already a parameter/,
  );
});
it("requires exported state only for the composition view and retains ordinary node playback", () => {
  const graph = example();
  graph.modules["/excitation.shade.ts"] = graph.modules[
    "/excitation.shade.ts"
  ]!.replace("export class NoiseState", "class NoiseState");
  const program = compileFunctionGraph(graph);
  expect(() => projectFunctionComposition(program)).toThrow(
    /Export NoiseState/,
  );
  expect(
    render(new FunctionGraphDsp(install(graph))).some((v) => v !== 0),
  ).toBe(true);
});
it("projects duplicate state instances and distinct modules exporting the same class name", () => {
  const graph = example();
  for (const [file, name] of [
    ["/excitation.shade.ts", "NoiseState"],
    ["/resonator.shade.ts", "ResonatorState"],
  ])
    graph.modules[file!] = graph.modules[file!]!.replaceAll(name!, "State");
  const program = compileFunctionGraph(graph);
  const source = projectFunctionComposition(program).source;
  const alias = /State as (\w+)/.exec(source)![1];
  expect(alias).toBeTruthy();
  graph.nodes.push({ ...structuredClone(graph.nodes[1]!), id: "secondBody" });
  const added = compileFunctionGraph(graph);
  const projected = projectFunctionComposition(
    added,
    source.replace("sampleRate: f32\n", "sampleRate: f32,\n"),
  );
  expect(projected.source).toContain(`secondBodyState: inout<${alias}>`);
  const applied = applyFunctionComposition(added, projected.source);
  expect(applied.program.document.nodes).toHaveLength(4);
  expect(
    render(new FunctionGraphDsp(install(applied.program.document))),
  ).toEqual(render(new FunctionGraphDsp(install(graph))));
});
it("projects valid domain identities that are reserved language words", () => {
  const graph = example();
  graph.nodes[2]!.id = "null";
  graph.output.node = "null";
  graph.parameters[0]!.id = "enum";
  graph.nodes[1]!.inputs.pitch = { kind: "parameter", parameter: "enum" };
  const program = compileFunctionGraph(graph);
  const source = projectFunctionComposition(program).source;
  expect(source).toContain("@typeaudioNode null");
  expect(source).toContain("@typeaudioControl enum");
  expect(
    compositionIdentity(applyFunctionComposition(program, source).program),
  ).toBe(compositionIdentity(program));
});
