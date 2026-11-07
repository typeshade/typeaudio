import { expect, it } from "vitest";
import { compileFunctionGraph, synchronizeFunctionInputs } from "../../src/function-graph/compiler/index.ts";
import { example, one, control } from "./helpers.ts";

it("adds compiler-typed scalar inputs without changing existing IDs, bindings or caller data", () => {
  const graph = example();
  graph.modules["/gain.shade.ts"] = graph.modules["/gain.shade.ts"]!.replace("strength: f32", "strength: f32, offset: f32, enabled: bool");
  const before = JSON.stringify(graph), next = synchronizeFunctionInputs(graph);
  const program = compileFunctionGraph(next), d = program.artifacts[2]!.descriptor;
  expect(JSON.stringify(graph)).toBe(before);
  expect(next.nodes).toEqual(graph.nodes);
  expect(d.inputs.slice(-2).map(p => [p.name, p.type, p.role, p.default])).toEqual([
    ["offset", "f32", "control", 0], ["enabled", "bool", "control", false],
  ]);
  expect(next.definitions[2]!.inputs.input!.id).toBe(graph.definitions[2]!.inputs.input!.id);
  expect(() => compileFunctionGraph(graph)).toThrow(/offset/);
});

it("refuses to drop wired or exposed inputs and validates incompatible type edits", () => {
  const graph = example();
  graph.modules["/gain.shade.ts"] = '"use typeshade"; export function gain(time: f32): f32 { return 0; }';
  expect(() => synchronizeFunctionInputs(graph)).toThrow(/disconnect.*every instance/);
  const typed = example();
  typed.modules["/gain.shade.ts"] = typed.modules["/gain.shade.ts"]!.replace("strength: f32", "strength: i32").replace("input * strength", "input * f32(strength)");
  expect(() => compileFunctionGraph(synchronizeFunctionInputs(typed))).toThrow(/expected i32/);
});

it("removes unconnected constants and avoids stable-ID collisions for new inputs", () => {
  const graph = one('"use typeshade"; export function process(existing: f32, old: f32): f32 { return existing; }', {
    existing: { ...control("old"), default: 1 }, gone: { ...control("removed"), default: 0 },
  });
  graph.nodes[0]!.inputs.removed = { kind: "constant", value: 2 };
  const next = synchronizeFunctionInputs(graph);
  expect(next.nodes[0]!.inputs.removed).toBeUndefined();
  expect(next.definitions[0]!.inputs.existing!.id).toBe("old");
  expect(next.definitions[0]!.inputs.old!.id).toBe("old_1");
  expect(() => compileFunctionGraph(next)).not.toThrow();
});
