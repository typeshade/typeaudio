import { describe, expect, it } from "vitest";
import { compile, compileModuleJs } from "typeshade";
import { createCodegenRuntime } from "typeshade/runtime/internal";
import { FunctionGraphDsp } from "../../src/function-graph/runtime/index.ts";
import type { FunctionExecutable } from "../../src/function-graph/runtime/registry.ts";
import {
  example,
  install,
  render,
  accumulator,
  one,
  control,
  audio,
} from "./helpers.ts";

describe("prepared function execution", () => {
  it("writes samples synchronously and preserves exact PCM across block partitions", () => {
    const p = install(example());
    const a = render(new FunctionGraphDsp(p), 4800),
      b = render(new FunctionGraphDsp(p), 4800, 73),
      c = render(new FunctionGraphDsp(p), 4800, 1);
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a.some((x) => Math.abs(x) > 0.01)).toBe(true);
    const out = new Float32Array(128).fill(NaN),
      d = new FunctionGraphDsp(p);
    expect(d.process(out, 17)).toBe(true);
    expect(out.slice(0, 17).every(Number.isFinite)).toBe(true);
    expect(out.slice(17).every(Number.isNaN)).toBe(true);
    expect(() => d.process(out, 129)).toThrow();
    expect(() => d.process({ length: 128 } as Float32Array)).toThrow(
      /Float32Array/,
    );
  });
  it("matches unadapted compiler code through nested scalar and struct inout calls", () => {
    const g = accumulator(),
      p = install(g),
      d = new FunctionGraphDsp(p);
    const original = compile(g.modules["/unit.shade.ts"]!, {
      fileName: "/unit.shade.ts",
    });
    const cpu = compileModuleJs(original.module, { precision: "f32" }),
      state = cpu.fns.initialize!();
    const expected = Float32Array.from(
      { length: 4096 },
      () => cpu.fns.process!(state, 0.125) as number,
    );
    expect(render(d, 4096)).toEqual(expected);
    expect(p.artifacts[0]!.report.reusedInoutArrays).toBeGreaterThan(0);
  });
  it("reuses the writeback array for every nested call", () => {
    const p = install(accumulator()),
      rt = createCodegenRuntime();
    let execute: FunctionExecutable | undefined;
    new Function("globalThis", p.artifacts[0]!.code)({
      __typeaudioRegisterFunction: (
        _key: string,
        factory: (r: typeof rt) => FunctionExecutable,
      ) => {
        execute = factory(rt);
      },
    });
    const scratch = rt.inout.values,
      args = [execute!.initialize()!, 0.125];
    for (let i = 0; i < 4096; i++) execute!.invoke(args);
    expect(rt.inout.values).toBe(scratch);
    expect(p.artifacts[0]!.code).not.toMatch(/inout\.values\s*=\s*\[/);
  });
  it("keeps two instances and two voices independent", () => {
    const g = accumulator();
    g.nodes.push({
      id: "second",
      definition: "unit",
      inputs: { in: { kind: "constant", value: 0 } },
    });
    g.modules["/sum.shade.ts"] =
      '"use typeshade"; export function sum(a:f32,b:f32):f32 { return a+b; }';
    g.definitions.push({
      id: "sum",
      version: 1,
      module: "/sum.shade.ts",
      export: "sum",
      inputs: { a: audio("a"), b: audio("b") },
      output: audio("out"),
    });
    g.nodes.push({
      id: "sum",
      definition: "sum",
      inputs: {
        a: { kind: "connection", node: "first", port: "out" },
        b: { kind: "connection", node: "second", port: "out" },
      },
    });
    g.output.node = "sum";
    const p = install(g);
    expect(render(new FunctionGraphDsp(p), 64)).toEqual(
      render(new FunctionGraphDsp(install(accumulator())), 64),
    );
    const solo = install(accumulator()),
      a = new FunctionGraphDsp(solo),
      b = new FunctionGraphDsp(solo);
    render(a, 100);
    expect(render(b, 64)).toEqual(render(new FunctionGraphDsp(solo), 64));
  });
  it("changes named controls without resetting state and rejects invalid changes atomically", () => {
    const g = example(),
      p = install(g),
      a = new FunctionGraphDsp(p),
      b = new FunctionGraphDsp(p);
    expect(render(a, 256)).toEqual(render(b, 256));
    a.setParameter("strength", 0.25);
    b.setParameter("strength", 0.25);
    expect(() => a.setParameter("strength", 2)).toThrow(/range/);
    expect(() => a.setParameter("missing", 1)).toThrow(/Unknown/);
    expect(render(a, 256)).toEqual(render(b, 256));
    a.reset();
    b.reset();
    expect(render(a, 128)).toEqual(render(b, 128));
  });
  it("transfers compatible state by instance ID and resets on state version changes", () => {
    const g = accumulator(),
      p = install(g),
      a = new FunctionGraphDsp(p);
    render(a, 32);
    const replacement = new FunctionGraphDsp(p, { previous: a });
    expect(render(replacement, 64)).toEqual(render(a, 64));
    const changed = accumulator();
    changed.definitions[0]!.state!.version = 2;
    const reset = new FunctionGraphDsp(install(changed), { previous: a });
    expect(render(reset, 16)).toEqual(render(new FunctionGraphDsp(p), 16));
  });
  it("does not allow a stale artifact to execute changed source", () => {
    const p = install(example());
    p.document.modules["/gain.shade.ts"] += "\n// newer source";
    expect(() => new FunctionGraphDsp(p)).toThrow(/different source/);
  });
  it("bounds looping calls, silences a failed block and isolates other voices", () => {
    const g = one(
      '"use typeshade"; export function process(run: bool): f32 { let x: f32=0; while (run) { x += 1; } return 0.25; }',
      { run: control("run") },
    );
    g.parameters = [{ id: "run", name: "Run", type: "bool", value: true }];
    g.nodes[0]!.inputs.run = { kind: "parameter", parameter: "run" };
    const p = install(g),
      d = new FunctionGraphDsp(p),
      out = new Float32Array(128).fill(1);
    expect(d.process(out)).toBe(false);
    expect(out.every((x) => x === 0)).toBe(true);
    expect(String(d.fault)).toMatch(/budget/);
    expect(d.faultNode).toBe("first");
    const other = new FunctionGraphDsp(p);
    other.setParameter("run", false);
    expect(render(other, 4)).toEqual(
      new Float32Array([0.25, 0.25, 0.25, 0.25]),
    );
    d.setParameter("run", false);
    d.reset();
    expect(render(d, 4)).toEqual(new Float32Array([0.25, 0.25, 0.25, 0.25]));
  });
  it("rejects non-finite output and state without leaking invalid PCM", () => {
    const g = one(
        '"use typeshade"; export function process(input:f32):f32 { return sqrt(input); }',
        { input: { ...audio("in"), default: -1 } },
      ),
      d = new FunctionGraphDsp(install(g)),
      out = new Float32Array(128);
    expect(d.process(out)).toBe(false);
    expect(out.every((x) => x === 0)).toBe(true);
    const state = accumulator();
    state.modules["/unit.shade.ts"] = state.modules["/unit.shade.ts"]!.replace(
      "return advance(state, input);",
      "state.value = sqrt(-input); return 0;",
    );
    const failed = new FunctionGraphDsp(install(state));
    expect(failed.process(out)).toBe(false);
    expect(out.every((x) => x === 0)).toBe(true);
  });
  it("evaluates block-rate controls once per block and leaves disconnected instances idle", () => {
    const g = one(
      '"use typeshade"; export function process(value:f32):f32 { return value; }',
      { value: control("value") },
    );
    g.modules["/control.shade.ts"] =
      '"use typeshade"; export class Counter { n:f32=0; } export function init():Counter { return new Counter(); } export function control(state:inout<Counter>):f32 { state.n+=1; return state.n; }';
    g.definitions.push({
      id: "counter",
      version: 1,
      module: "/control.shade.ts",
      export: "control",
      inputs: {},
      output: control("out"),
      state: { parameter: "state", initializer: "init", version: 1 },
    });
    g.nodes.push({ id: "counter", definition: "counter", inputs: {} });
    g.nodes[0]!.inputs.value = {
      kind: "connection",
      node: "counter",
      port: "out",
    };
    g.modules["/unused.shade.ts"] =
      '"use typeshade"; export function unused(run:bool):f32 { while (run) {} return 0; }';
    g.definitions.push({
      id: "unused",
      version: 1,
      module: "/unused.shade.ts",
      export: "unused",
      inputs: { run: { ...control("run"), default: true } },
      output: audio("out"),
    });
    g.nodes.push({ id: "unused", definition: "unused", inputs: {} });
    const p = install(g),
      d = new FunctionGraphDsp(p);
    expect(p.order).not.toContain("unused");
    expect(render(d, 8, 4)).toEqual(new Float32Array([1, 1, 1, 1, 2, 2, 2, 2]));
  });
});
