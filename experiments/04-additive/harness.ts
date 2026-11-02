// Experiment 4, a 10,000-partial additive render with the fuse report read (docs/experiments.md,
// section 4): the blocks, shared by the CPU tier in Node (`node.ts`) and WebGPU and WebGL2 in a
// page (`browser.ts`). One block is one `dev.fuse()` scope, as `render()` runs one
// (docs/architecture.md, section 3):
//
//   additive(lanes, partials, B, sweep)   shape V: each partial retunes its filter, then writes its lane
//                                         (`additive64` or `additiveHost` in the `f64` and `host` variants)
//   <the sum of the lanes into mixed>     `mixdown`, or `sumFrame` per frame (`tree`), or `sumScatter`
//   gain(master, mixed, MASTER)           shape F
//   peak(master)                          shape R, a reduction at the end of the scope
//
// `lanes` and `mixed` are scratch arrays of the scope (`resident` keeps the lanes in a `Resident`
// the device makes once); the master is a `Resident`, read once per block. A block is timed with
// `performance.now()` from the `fuse` call to the host's read of the master and of the peak. The
// bank of partials stays on the device for the whole run.

import { createDevice, type Device, type DeviceInfo, type FuseReport, type Resident } from 'typeshade/runtime';
import { bank } from '../../src/bank.ts';
import { mixdown } from '../../src/kernels/mixdown.shade.ts';
import { gain } from '../../src/kernels/bus.shade.ts';
import { peak } from '../../src/kernels/meter.shade.ts';
import { additive, additive64, additiveHost, HostPartial, Partial, Partial64 } from './additive.shade.ts';
import { sumFrame, sumScatter } from './sums.shade.ts';
import { hostCoefficients } from './design.ts';
import { lanesInput, MASTER, SR, spec, sweepAt, tiersOf, type Options, type Row, type Variant } from './options.ts';

export interface VariantResult {
  readonly row: Row;
  /** The fuse report of the last block. */
  readonly report: FuseReport;
  /** Every block's master, warm-up blocks first, in order. */
  readonly out: Float32Array;
  /** The bank after the last block: per partial, the fields `refState` lists, flat. */
  readonly state: Float32Array;
  /** The peak of each block, from the meter. */
  readonly peaks: number[];
}

export interface Result {
  readonly info: DeviceInfo;
  /** Each tier the device skipped before the one it opened, with its reason. */
  readonly skipped: readonly { readonly tier: string; readonly reason: string }[];
  readonly results: { [V in Variant]?: VariantResult };
  /** The error of each variant that failed, which then has no result. */
  readonly errors: { [V in Variant]?: string };
}

/** Runs the variants of `o` and resolves to their rows; `progress` sees each block as it ends. */
export async function measure(
  o: Options,
  progress: (variant: Variant, block: number, ms: number) => void = () => {},
): Promise<Result> {
  const prefer = tiersOf(o.tier);
  const results: { [V in Variant]?: VariantResult } = {};
  const errors: { [V in Variant]?: string } = {};
  let info: DeviceInfo | undefined;
  let skipped: { tier: string; reason: string }[] = [];
  for (const variant of o.variants) {
    const dev = await createDevice({ prefer });
    info ??= dev.info;
    skipped = dev.skipped.map((s) => ({ tier: s.tier, reason: s.reason }));
    try {
      results[variant] = await run(dev, o, variant, (b, ms) => progress(variant, b, ms));
    } catch (error) {
      errors[variant] = error instanceof Error ? error.message : String(error);
    } finally {
      await dev.dispose();
    }
  }
  return { info: info!, skipped, results, errors };
}

async function run(
  dev: Device,
  o: Options,
  variant: Variant,
  progress: (block: number, ms: number) => void,
): Promise<VariantResult> {
  const P = o.partials;
  const B = o.frames;
  const specs = spec(P);
  const args = (s: (typeof specs)[number]) => [s.f, s.level, s.cutoff, s.q, s.attack, s.decay, s.sustain, SR] as const;
  // One bank per concrete class (decision D2): the variant's partials, built with `new` on the host.
  const partials =
    variant === 'f64'
      ? bank(dev, specs.map((s) => new Partial64(...args(s))))
      : variant === 'host'
        ? bank(dev, specs.map((s) => new HostPartial(...args(s))))
        : bank(dev, specs.map((s) => new Partial(...args(s))));
  const master: Resident<Float32Array> = dev.array(B, 'f32');
  // `host`: the coefficients of each block, designed on the host and written before the scope.
  const designed = new Float32Array(P * 5);
  const coefficients: Resident<Float32Array> | undefined = variant === 'host' ? dev.array(P * 5, 'f32') : undefined;
  // `resident`: the lanes on the device for the whole run, written again by every block.
  const held: Resident<Float32Array> | undefined = variant === 'resident' ? dev.array(P * B, 'f32') : undefined;
  const total = o.warmup + o.blocks;
  const out = new Float32Array(total * B);
  const times: number[] = [];
  const peaks: number[] = [];
  const reports: FuseReport[] = [];
  let first = 0;
  for (let b = 0; b < total; b++) {
    const sweep = sweepAt(b);
    let meter: Promise<number> | undefined;
    const start = performance.now();
    if (coefficients !== undefined) coefficients.write(hostCoefficients(specs, sweep, designed));
    const report = await dev.fuse((scope) => {
      const lanes = held ?? scope.scratch(P * B);
      const mixed = scope.scratch(B);
      // At the pin the view spells a kernel's `array<Partial64>` with the fields of the struct, all
      // public, and the class `Partial64` with the `protected` coefficients of `Lowpass64`, a class of
      // the same file, so tsc refuses the bank of `new Partial64()` at the call (TS2769). Compiler
      // proposal 0116, item 3 (decision D7), implemented after the pin, spells the parameter with
      // the class. The casts stand in until the pin moves.
      if (variant === 'f64') {
        additive64(lanes, partials.instances as unknown as Extract<Parameters<typeof additive64>[1], Resident<unknown>>, B, sweep);
      } else if (variant === 'host') {
        additiveHost(lanes, partials.instances as unknown as Extract<Parameters<typeof additiveHost>[1], Resident<unknown>>, coefficients!, B);
      } else {
        additive(lanes, partials.instances as Resident<Partial[]>, B, sweep);
      }
      if (variant === 'tree') {
        for (let n = 0; n < B; n++) sumFrame(mixed, lanes, n, P, B);
      } else if (variant === 'scatter') {
        sumScatter(mixed, lanes, P, B);
      } else {
        mixdown(mixed, lanes, P, B);
      }
      gain(master, mixed, MASTER);
      meter = peak(master);
    });
    const block = await master.read();
    const loudest = await meter!;
    const ms = performance.now() - start;
    out.set(block, b * B);
    peaks.push(loudest);
    if (b === 0) first = ms;
    if (b >= o.warmup) {
      times.push(ms);
      reports.push(report);
    }
    progress(b, ms);
  }
  // The read gives each instance's fields as plain objects (docs/compiler-asks.md, N); the filter's
  // coefficients are `protected` in the view, so they are read by name.
  const read = (await partials.read()) as unknown as {
    osc: { phase: number; inc: number };
    env: { rise: number; fall: number };
    filter: Record<'b0' | 'b1' | 'b2' | 'a1' | 'a2' | 'z1' | 'z2', number>;
  }[];
  const state = new Float32Array(
    read.flatMap((p) => [
      p.osc.phase,
      p.osc.inc,
      p.env.rise,
      p.env.fall,
      p.filter.b0,
      p.filter.b1,
      p.filter.b2,
      p.filter.a1,
      p.filter.a2,
      p.filter.z1,
      p.filter.z2,
    ]),
  );
  dev.release(master);
  if (coefficients !== undefined) dev.release(coefficients);
  if (held !== undefined) dev.release(held);
  const last = reports[reports.length - 1]!;
  const gpu = reports.map((r) => r.groups.reduce((s, g) => s + (g.gpuTime ?? 0), 0));
  const measured = reports.every((r) => r.groups.some((g) => g.gpuTime !== undefined));
  const span = (xs: number[]): readonly [number, number] => [Math.min(...xs), Math.max(...xs)];
  // Each group's mean GPU time, where every timed block planned the same groups.
  const shape = JSON.stringify(last.groups.map((g) => g.calls));
  const alike = reports.every((r) => JSON.stringify(r.groups.map((g) => g.calls)) === shape);
  const groupGpuMs =
    measured && alike
      ? last.groups.map((_, i) => reports.reduce((s, r) => s + (r.groups[i]!.gpuTime ?? 0), 0) / reports.length / 1e6)
      : undefined;
  return {
    row: {
      ...stats(times),
      variant,
      tier: last.tier,
      partials: P,
      frames: B,
      firstMs: first,
      ...(measured ? { gpuMs: gpu.reduce((s, x) => s + x, 0) / gpu.length / 1e6 } : {}),
      ...(groupGpuMs === undefined ? {} : { groupGpuMs }),
      dispatches: span(reports.map((r) => r.dispatches)),
      submissions: span(reports.map((r) => r.submissions)),
    },
    report: last,
    out,
    state,
    peaks,
  };
}

/** The three sums of one block of fixed lanes, and the fuse report of each (`sumCheck`). */
export interface SumCheck {
  readonly gather: Float32Array;
  readonly tree: Float32Array;
  readonly scatter: Float32Array;
  readonly reports: { readonly gather: FuseReport; readonly tree: FuseReport; readonly scatter: FuseReport };
}

/**
 * The sums alone, on one block of fixed lanes (`lanesInput`), so that every tier adds the same
 * values: `mixdown`, `sumFrame` once per frame and `sumScatter`, each in a scope of its own, on a
 * device of the tiers of `o`. The runner holds each to the plain-JavaScript sum of the same order.
 */
export async function sumCheck(o: Pick<Options, 'tier' | 'partials' | 'frames'>): Promise<SumCheck> {
  const P = o.partials;
  const B = o.frames;
  const dev = await createDevice({ prefer: tiersOf(o.tier) });
  try {
    const lanes = dev.array(lanesInput(P, B));
    const sum = async (body: (out: Resident<Float32Array>) => void): Promise<[Float32Array, FuseReport]> => {
      const out = dev.array(B, 'f32');
      const report = await dev.fuse(() => body(out));
      const got = await out.read();
      dev.release(out);
      return [got, report];
    };
    const [gather, g] = await sum((out) => mixdown(out, lanes, P, B));
    const [tree, t] = await sum((out) => {
      for (let n = 0; n < B; n++) sumFrame(out, lanes, n, P, B);
    });
    const [scatter, s] = await sum((out) => sumScatter(out, lanes, P, B));
    return { gather, tree, scatter, reports: { gather: g, tree: t, scatter: s } };
  } finally {
    await dev.dispose();
  }
}

/**
 * The tier each kernel of the plans runs on, on a device of the tiers of `o`: each kernel called
 * alone in a scope of its own, at 64 partials of 64 frames, whose report's `tier` is then the
 * call's own. A plan's report names only its best tier (docs/compiler-asks.md, P), so the record
 * reads each group's tier from here, and checks it against the dispatches the plan counts.
 */
export async function tierProbe(o: Pick<Options, 'tier'>): Promise<Record<string, string>> {
  const P = 64;
  const B = 64;
  const dev = await createDevice({ prefer: tiersOf(o.tier) });
  const tiers: Record<string, string> = {};
  try {
    const specs = spec(P);
    const args = (s: (typeof specs)[number]) => [s.f, s.level, s.cutoff, s.q, s.attack, s.decay, s.sustain, SR] as const;
    const partials = bank(dev, specs.map((s) => new Partial(...args(s))));
    const partials64 = bank(dev, specs.map((s) => new Partial64(...args(s))));
    const host = bank(dev, specs.map((s) => new HostPartial(...args(s))));
    const coefficients = dev.array(hostCoefficients(specs, 1, new Float32Array(P * 5)));
    const lanes = dev.array(lanesInput(P, B));
    const out = dev.array(P * B, 'f32');
    const bus = dev.array(B, 'f32');
    const calls: Record<string, () => void> = {
      additive: () => additive(out, partials.instances, B, 1),
      additive64: () =>
        additive64(out, partials64.instances as unknown as Extract<Parameters<typeof additive64>[1], Resident<unknown>>, B, 1),
      additiveHost: () =>
        additiveHost(out, host.instances as unknown as Extract<Parameters<typeof additiveHost>[1], Resident<unknown>>, coefficients, B),
      mixdown: () => mixdown(bus, lanes, P, B),
      sumFrame: () => sumFrame(bus, lanes, 0, P, B),
      sumScatter: () => sumScatter(bus, lanes, P, B),
      gain: () => gain(bus, lanes, MASTER),
      peak: () => void peak(lanes),
    };
    for (const [name, call] of Object.entries(calls)) {
      try {
        tiers[name] = (await dev.fuse(call)).tier;
      } catch (error) {
        tiers[name] = `failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  } finally {
    await dev.dispose();
  }
  return tiers;
}

/** The statistics of the timed blocks: the median and the 99th percentile by nearest rank. */
function stats(times: readonly number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const rank = (p: number): number => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
  return {
    blocks: sorted.length,
    medianMs: rank(50),
    p99Ms: rank(99),
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    meanMs: sorted.reduce((s, x) => s + x, 0) / sorted.length,
  };
}
