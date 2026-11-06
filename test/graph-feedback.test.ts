import { describe, expect, it } from "vitest";
import impact from "../fixtures/feedback/impact.json";
import tone from "../fixtures/feedback/tone.json";
import { compileGraph } from "../src/graph/compiler/index.ts";
import { graphKey, graphValues, validateGraph } from "../src/graph/index.ts";
import { GraphDsp, graphKernel } from "../src/graph/runtime.ts";
import {
  validateReproduction,
  replayGraph,
  summarizeReplay,
} from "../src/feedback/index.ts";

function install(raw: unknown) {
  const input = validateReproduction(raw);
  const program = compileGraph(input.graph);
  // Only trusted compiler output is evaluated; imported JSON never supplies this code.
  new Function(program.code)();
  return { input, program };
}

describe("Web → TypeAudio → TypeShade feedback", () => {
  it.each([impact, tone])(
    "replays the shared $capture fixture deterministically",
    (raw) => {
      const { input } = install(raw);
      const a = replayGraph(input),
        b = replayGraph(input);
      expect(a.pcm).toEqual(b.pcm);
      expect(a.invalidSamples).toBe(0);
      expect(a.updates).toBe(
        input.events.filter((e) => e.type !== "retrigger").length,
      );
      const summary = summarizeReplay(a);
      expect(summary.peak).toBeGreaterThan(0.01);
      expect(summary.rms).toBeGreaterThan(0.001);
      expect(summary.compute).toBeNull();
    },
  );

  it("fills output synchronously and preserves seeded state across arbitrary kernel blocks", () => {
    const { input, program } = install(impact);
    const kernel = graphKernel(program.key);
    const run = (block: number) => {
      const all = new Float32Array(4800),
        out = new Float32Array(block);
      const state = new Float32Array(input.graph.nodes.length * 4);
      const clock = new Uint32Array(input.graph.nodes.length + 1);
      const values = graphValues(input.graph);
      for (let at = 0; at < all.length; at += block) {
        const frames = Math.min(block, all.length - at);
        out.fill(NaN);
        expect(kernel(out, state, clock, values, frames)).toBeUndefined();
        expect(out.subarray(0, frames).every(Number.isFinite)).toBe(true);
        all.set(out.subarray(0, frames), at);
      }
      expect(clock[0]).toBe(all.length);
      return all;
    };
    expect(run(128)).toEqual(run(4800));
    expect(run(73)).toEqual(run(4800));
  });

  it("matches an independent xorshift reference, including f32 rounding", () => {
    const input = validateReproduction(impact);
    const noise = input.graph.nodes.find((node) => node.kind === "noise")!;
    const output = input.graph.nodes.find((node) => node.kind === "output")!;
    noise.values[0] = 11;
    output.inputs.input = noise.id;
    input.graph.nodes = [noise, output];
    const { program } = install(input);
    const out = new Float32Array(128),
      state = new Float32Array(8),
      clock = new Uint32Array(3);
    graphKernel(program.key)(out, state, clock, graphValues(input.graph), 128);
    let seed = 11;
    const expected = Float32Array.from({ length: 128 }, () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return Math.fround(Math.fround(Math.fround(seed >>> 0) / 2147483648) - 1);
    });
    expect(out).toEqual(expected);
    expect(out).not.toEqual(new Float32Array(128));
  });

  it("applies frame-stamped parameter changes without resetting earlier samples", () => {
    const { input } = install(tone);
    const actual = replayGraph(input);
    const control = replayGraph({ ...input, capture: "snapshot", events: [] });
    expect(actual.pcm.slice(0, 1024)).toEqual(control.pcm.slice(0, 1024));
    expect(actual.pcm.slice(1024, 2048)).not.toEqual(
      control.pcm.slice(1024, 2048),
    );
    const noRetrigger = replayGraph({
      ...input,
      events: input.events.slice(0, 2),
    });
    expect(actual.pcm.slice(0, 3072)).toEqual(noRetrigger.pcm.slice(0, 3072));
    expect(actual.pcm.slice(3072)).not.toEqual(noRetrigger.pcm.slice(3072));
  });

  it("preserves state when only editor metadata changes", () => {
    const { input } = install(tone);
    const a = new GraphDsp(input),
      b = new GraphDsp(input);
    const out = new Float32Array(128),
      reference = new Float32Array(128);
    a.process(out);
    b.process(reference);
    const moved = structuredClone(input.graph);
    moved.nodes.reverse();
    moved.nodes[0]!.x += 100;
    moved.nodes[0]!.name = "Moved";
    expect(graphKey(moved)).toBe(graphKey(input.graph));
    a.update({ graph: moved, volume: input.volume });
    a.process(out);
    b.process(reference);
    expect(out).toEqual(reference);
    expect(a.frames).toBe(256);
    expect(() => a.process(new Float32Array(129))).toThrow(/1–128/);
    expect(() => a.process(out, 128, new Float32Array(1))).toThrow(/buffers/);
    expect(() => a.update({ graph: moved, volume: NaN })).toThrow(/volume/);
  });

  it("refuses unsafe Code and reports the source node before installation", () => {
    for (const code of [
      "while (true) {}",
      "out = window.location;",
      "const a = [1,2]; out = a[0];",
      "out = missing;",
    ]) {
      const input = validateReproduction(impact);
      input.graph.nodes.find((node) => node.kind === "code")!.code = code;
      expect(() => compileGraph(input.graph), code).toThrow(/Code|line/);
    }
    const graph = validateGraph(impact.graph);
    graph.nodes.find((node) => node.kind === "code")!.inputs.input = "filter";
    expect(() => compileGraph(graph)).toThrow(/cycle/);
  });

  it("rejects invalid versions, timing and parameters and strips unrelated payloads", () => {
    for (const bad of [
      { ...impact, backend: "webgpu" },
      { ...impact, frames: Infinity },
      { ...impact, versions: { ...impact.versions, typeshade: "main" } },
      { ...tone, events: [{ frame: 4800, type: "retrigger" }] },
      { ...tone, events: [...tone.events].reverse() },
      {
        ...tone,
        events: [{ frame: 0, type: "parameters", values: [NaN, 0, 0, 0] }],
      },
    ])
      expect(() => validateReproduction(bad)).toThrow();
    const clean = validateReproduction({
      ...impact,
      javascript: "throw 1",
      media: "private",
    });
    expect(clean).not.toHaveProperty("javascript");
    expect(clean).not.toHaveProperty("media");
  });

  it("reports slow DSP calls without presenting them as measured output underruns", () => {
    const { input } = install(impact);
    let calls = 0;
    const result = replayGraph(
      { ...input, frames: 256 },
      () => [0, 0.1, 1, 11][calls++]!,
    );
    expect(summarizeReplay(result).compute).toMatchObject({
      blocks: 2,
      p99Ms: 10,
      maxMs: 10,
      overBudgetBlocks: 1,
    });
    expect(summarizeReplay(result).compute!.scope).toContain("excludes");
  });
});
