import { describe, expect, it } from "vitest";
import {
  compileFunctionGraph,
  FunctionCompileError,
} from "../../src/function-graph/compiler/index.ts";
import { FunctionGraphDsp } from "../../src/function-graph/runtime/index.ts";
import { validateFunctionDocument } from "../../src/function-graph/index.ts";
import {
  audio,
  control,
  example,
  install,
  one,
  render,
  accumulator,
} from "./helpers.ts";

describe("typed function authoring", () => {
  it("reflects actual function types, original names, state fields and source locations", () => {
    const g = example(),
      before = JSON.stringify(g),
      p = compileFunctionGraph(g);
    expect(JSON.stringify(g)).toBe(before);
    const d = p.artifacts[1]!.descriptor;
    expect(d.inputs.map((p) => [p.id, p.name, p.type, p.argument])).toEqual([
      ["in", "input", "f32", 1],
      ["pitch", "pitch", "f32", 2],
      ["damping", "damping", "f32", 3],
    ]);
    expect(d.state?.fields).toEqual([
      { name: "previous", type: "f32" },
      { name: "older", type: "f32" },
    ]);
    expect(d.location.file).toBe("/resonator.shade.ts");
    expect(d.location.line).toBeGreaterThan(5);
    expect(p.artifacts[2]!.report.functions).toEqual(["attack", "gain"]);
  });
  it("retains source locations for errors inside an imported module", () => {
    const g = example();
    g.modules["/math.shade.ts"] =
      '"use typeshade";\nexport function attack(time: f32): f32 { return missing; }';
    try {
      compileFunctionGraph(g);
      throw new Error("Expected compiler failure");
    } catch (e) {
      expect(e).toBeInstanceOf(FunctionCompileError);
      const d = (e as FunctionCompileError).diagnostics[0]!;
      expect(d.file).toBe("/math.shade.ts");
      expect(d.line).toBe(2);
      expect(d.message).toMatch(/missing/);
    }
  });
  it("reports missing imports and TypeShade type errors before installing a program", () => {
    const g = example();
    delete g.modules["/math.shade.ts"];
    expect(() => compileFunctionGraph(g)).toThrow(/math/);
    expect(() =>
      compileFunctionGraph(
        one('"use typeshade"; export function process(): f32 { return true; }'),
      ),
    ).toThrow();
  });
  it("keeps stable port IDs across parameter renames and signature reordering", () => {
    const g = example(),
      expected = render(new FunctionGraphDsp(install(g)));
    g.modules["/gain.shade.ts"] = g.modules["/gain.shade.ts"]!.replace(
      "input: f32, strength: f32",
      "amount: f32, signal: f32",
    ).replace("input * strength", "signal * amount");
    const d = g.definitions[2]!;
    d.inputs = { amount: d.inputs.strength!, signal: d.inputs.input! };
    const p = install(g);
    expect(p.artifacts[2]!.descriptor.inputs.map((p) => p.id)).toEqual([
      "strength",
      "in",
    ]);
    expect(render(new FunctionGraphDsp(p))).toEqual(expected);
  });
  it.each(["type", "role", "rate", "unit"])(
    "rejects a %s mismatch at the actual destination pin",
    (field) => {
      const g = example();
      if (field === "type") g.parameters[0]!.type = "u32";
      else if (field === "role")
        ((g.definitions[1]!.inputs.pitch!.role = "audio"),
          (g.definitions[1]!.inputs.pitch!.rate = "sample"));
      else if (field === "rate")
        g.definitions[1]!.inputs.pitch!.rate = "sample";
      else g.parameters[0]!.unit = "seconds";
      expect(() => compileFunctionGraph(g)).toThrow(/body.pitch: expected/);
    },
  );
  it("rejects missing ports, cycles and missing required bindings", () => {
    const g = example();
    g.nodes[1]!.inputs.in = { kind: "connection", node: "level", port: "out" };
    expect(() => compileFunctionGraph(g)).toThrow(/cycle/);
    g.nodes[1]!.inputs.in = {
      kind: "connection",
      node: "noise",
      port: "missing",
    };
    expect(() => compileFunctionGraph(g)).toThrow(/output port/);
    delete g.nodes[1]!.inputs.in;
    expect(() => compileFunctionGraph(g)).toThrow(/connect an input/);
  });
  it("rejects malformed source documents before compiling", () => {
    const g = example();
    g.nodes.push(g.nodes[0]!);
    expect(() => validateFunctionDocument(g)).toThrow(/duplicate/);
    expect(() =>
      validateFunctionDocument({ ...example(), version: 99 }),
    ).toThrow(/version/);
    const bad = example();
    bad.parameters[0]!.value = Infinity;
    expect(() => validateFunctionDocument(bad)).toThrow();
  });
  it("requires typed inout state and an initializer with the same result type", () => {
    const g = accumulator();
    g.modules["/unit.shade.ts"] = g.modules["/unit.shade.ts"]!.replace(
      "state: inout<State>, input: f32): f32 { return advance",
      "state: State, input: f32): f32 { return advance",
    );
    expect(() => compileFunctionGraph(g)).toThrow();
    const other = accumulator();
    other.definitions[0]!.state!.initializer = "process";
    expect(() => compileFunctionGraph(other)).toThrow(/initializer/);
  });
  it("allows pure helpers and bounded loops in a full TypeShade module", () => {
    const g = one(
      '"use typeshade"; function scale(v: f32): f32 { return v * 0.5; } export function process(): f32 { let x: f32 = 0; for (let i: u32=0; i<4; i++) { x += scale(0.25); } return x; }',
    );
    expect(Array.from(render(new FunctionGraphDsp(install(g)), 8))).toEqual(
      new Array(8).fill(0.5),
    );
  });
  it("refuses processing aggregate allocations with a profile diagnostic", () => {
    const g = one(
      '"use typeshade"; class Value { x: f32 = 1; } export function process(): f32 { const v = new Value(); return v.x; }',
    );
    expect(() => compileFunctionGraph(g)).toThrow(/allocates|helper/);
  });
  it("supports bool and integer control pins without treating events as floats", () => {
    const g = one(
      '"use typeshade"; export function process(enabled: bool, count: u32): f32 { if (enabled) return f32(count) * 0.125; return 0; }',
      { enabled: control("enabled"), count: control("count") },
    );
    g.nodes[0]!.inputs = {
      enabled: { kind: "constant", value: true },
      count: { kind: "constant", value: 2 },
    };
    const p = install(g);
    expect(p.artifacts[0]!.descriptor.inputs.map((p) => p.type)).toEqual([
      "bool",
      "u32",
    ]);
    expect(Array.from(render(new FunctionGraphDsp(p), 4))).toEqual([
      0.25, 0.25, 0.25, 0.25,
    ]);
    g.nodes[0]!.inputs.enabled = { kind: "constant", value: 1 };
    expect(() => compileFunctionGraph(g)).toThrow(/bool/);
  });
});
