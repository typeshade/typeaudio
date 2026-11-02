// Experiment 6, a granular scheduler on `push` and device-resident counts (docs/experiments.md,
// section 6): the timing and the renders, shared by the CPU tier in Node (`node.ts`) and WebGPU
// and WebGL2 in a page (`browser.ts`).
//
// One block is one `fuse` plan of the engine's three grain kernels and the harness's two:
//
//   cull   keeps the grains of the other list that still sound, and stores their count;
//   tally  stores that count in the log;
//   spawn  appends the block's new grains after it, a push after a held length (change 0094);
//   tally  stores the new count in the log;
//   play   renders the list into the block, reading its count on the device;
//   keep   copies the block into the tape.
//
// The two lists and their counts are Residents, swapped each block, and so are the log and the
// tape: the counts move from kernel to kernel on the device, and nothing is read back until the
// last block. Each arm (`options.ts`) renders the same seed on a new device; the harness reads the
// tape, the log and the last list once, after the last block.

import { createDevice, type Device, type DeviceInfo, type FuseReport } from 'typeshade/runtime';
import { Cloud, Grain } from '../../src/units/grain.shade.ts';
import { cull, play, spawn } from '../../src/kernels/grains.shade.ts';
import { explain } from '../../src/explain.ts';
import { keep, tally } from './measure.shade.ts';
import { CLOUD, statsOf, tiersOf, type Arm, type Options, type Row } from './options.ts';
import { base64, diff, digest, listDiff, logDiff, type Diff, type GrainFields } from './compare.ts';

export { ARMS, DEFAULTS, type Arm, type Options, type Row } from './options.ts';

/** What the host of the harness can add on its tier. */
export interface Probes {
  /** The reads of the device so far, where the host can count them (a page can). */
  readonly deviceReads?: () => number;
  /** The device of the `stream` arm, where it is not the tier's default: on WebGPU, one without
   *  `timestamp-query`, so that a plan maps nothing back. `release` frees what `open` made. */
  readonly streamDevice?: () => Promise<{ readonly dev: Device; readonly release: () => void }>;
}

/** One arm, with what it read after its last block. */
export interface ArmResult {
  readonly row: Row;
  readonly info: DeviceInfo;
  /** The fuse report of the last block. */
  readonly report: FuseReport;
  /** `explain()` of the engine over the timed blocks' reports. */
  readonly explain: string;
  readonly tape: Float32Array;
  readonly log: Uint32Array;
  /** The grains of the last block's list, in its order. */
  readonly list: readonly GrainFields[];
}

/** The cloud of the run (`options.ts`, `CLOUD`). */
export const cloudOf = (o: Options): Cloud =>
  new Cloud(o.sr)
    .density(o.density)
    .lengths(CLOUD.shortest, CLOUD.longest)
    .pitches(CLOUD.low, CLOUD.high)
    .level(CLOUD.level)
    .seed(o.seed);

/** Runs one arm on a new device and resolves to its row and what it read. */
export async function runArm(o: Options, arm: Arm, probes: Probes = {}): Promise<ArmResult> {
  const own = arm === 'stream' && probes.streamDevice !== undefined ? await probes.streamDevice() : undefined;
  const dev = own?.dev ?? (await createDevice({ prefer: tiersOf(o.tier) }));
  try {
    const total = o.warmup + o.blocks;
    const cloud = cloudOf(o);
    const blank = (): Grain[] => Array.from({ length: o.capacity }, () => new Grain(0, 1, 0, 0));
    const lists = [dev.array(blank()), dev.array(blank())] as const;
    const counts = [dev.array(new Uint32Array(1)), dev.array(new Uint32Array(1))] as const;
    const tape = dev.array(total * o.block, 'f32');
    const log = dev.array(2 * total, 'u32');
    const plan = (b: number): Promise<FuseReport> =>
      dev.fuse((scope) => {
        const [cur, prev] = b % 2 === 0 ? ([0, 1] as const) : ([1, 0] as const);
        const start = b * o.block;
        const bus = scope.scratch(o.block);
        cull(lists[cur], counts[cur], lists[prev], counts[prev], start);
        tally(log, 2 * b, counts[cur]);
        spawn({ array: lists[cur], length: counts[cur] }, cloud, start, o.block);
        tally(log, 2 * b + 1, counts[cur]);
        play(bus, lists[cur], counts[cur], start);
        keep(tape, bus, start);
      });

    // The warm-up, fenced, the first block timed apart: it builds the pipelines.
    let at = performance.now();
    await plan(0);
    await dev.wait();
    const firstMs = performance.now() - at;
    for (let b = 1; b < o.warmup; b++) {
      await plan(b);
      await dev.wait();
    }

    const readsBefore = probes.deviceReads?.();
    const bytesBefore = dev.statistics.readBytes;
    const reports: FuseReport[] = [];
    const times: number[] = [];
    let streamMs: number | undefined;
    if (arm === 'stream') {
      const t0 = performance.now();
      for (let b = o.warmup; b < total; b++) {
        at = performance.now();
        reports.push(await plan(b));
        times.push(performance.now() - at);
      }
      await dev.wait();
      streamMs = (performance.now() - t0) / o.blocks;
    } else {
      for (let b = o.warmup; b < total; b++) {
        at = performance.now();
        reports.push(await plan(b));
        await dev.wait();
        times.push(performance.now() - at);
      }
    }
    const deviceReads = readsBefore === undefined ? undefined : probes.deviceReads!() - readsBefore;
    const readBytes = dev.statistics.readBytes - bytesBefore;

    // The one read of the run.
    const last = (total - 1) % 2;
    const [tapeValues, logValues, listValues, countValues] = await Promise.all([
      tape.read(),
      log.read(),
      lists[last].read(),
      counts[last].read(),
    ]);
    const kept: number[] = [];
    const alive: number[] = [];
    let largest = 0;
    for (let b = 0; b < total; b++) {
      largest = Math.max(largest, logValues[2 * b + 1]!);
      if (b < o.warmup) continue;
      kept.push(logValues[2 * b]!);
      alive.push(logValues[2 * b + 1]!);
    }
    const spawned = alive.map((a, i) => a - kept[i]!);
    const timed = reports.filter((r) => r.groups.some((g) => g.gpuTime !== undefined));
    const gpu = timed.map((r) => r.groups.reduce((s, g) => s + (g.gpuTime ?? 0), 0) / 1e6);
    const lastReport = reports[reports.length - 1]!;
    const row: Row = {
      arm,
      tier: lastReport.tier,
      blocks: o.blocks,
      firstMs,
      ms: statsOf(times),
      ...(streamMs === undefined ? {} : { streamMs }),
      ...(gpu.length === reports.length
        ? {
            gpuMs: statsOf(gpu),
            gpuByGroup: lastReport.groups.map((g, i) => ({
              calls: g.calls.join('+'),
              ms: timed.reduce((s, r) => s + (r.groups[i]?.gpuTime ?? 0), 0) / timed.length / 1e6,
            })),
          }
        : {}),
      alive: statsOf(alive),
      kept: statsOf(kept),
      spawned: statsOf(spawned),
      grainsPerSecond: spawned.reduce((s, x) => s + x, 0) / ((o.blocks * o.block) / o.sr),
      largest,
      dispatches: [...new Set(reports.map((r) => r.dispatches))].sort((a, b) => a - b),
      submissions: [...new Set(reports.map((r) => r.submissions))].sort((a, b) => a - b),
      readBytes,
      ...(deviceReads === undefined ? {} : { deviceReads }),
    };
    const count = Math.min(countValues[0]!, o.capacity);
    return {
      row,
      info: dev.info,
      report: lastReport,
      explain: explain(reports),
      tape: tapeValues,
      log: logValues,
      list: (listValues as readonly GrainFields[]).slice(0, count).map(({ start, length, inc, peak }) => ({ start, length, inc, peak })),
    };
  } finally {
    await dev.dispose();
    own?.release();
  }
}

/** What a tier's run gives the runner. */
export interface Result {
  readonly info: DeviceInfo;
  readonly rows: Row[];
  /** For each arm: the last block's fuse report, `explain()`, and the digests of what it read. */
  readonly arms: Record<string, { report: FuseReport; explain: string; info: DeviceInfo; tape: string; log: string }>;
  /** The renders of the same seed against the first arm's: the tape value by value, and the
   *  elements of the log and the grains of the last list that differ. */
  readonly same: Record<string, { tape: Diff; log: number; list: number }>;
  /** The first arm's tape in base 64, its log and its last list, for the runner to hold the tiers to one another. */
  readonly tape: string;
  readonly log: number[];
  readonly list: readonly GrainFields[];
  /** On WebGL2: what a device of that tier alone refuses, word for word. */
  readonly refusals?: Record<string, string>;
}

/** Runs every arm of `o` and resolves to the tier's result; `progress` sees each row when it is done. */
export async function measure(o: Options, probes: Probes = {}, progress: (row: Row) => void = () => {}): Promise<Result> {
  const results: ArmResult[] = [];
  for (const arm of o.arms) {
    const r = await runArm(o, arm, probes);
    progress(r.row);
    results.push(r);
  }
  const first = results[0]!;
  const arms: Result['arms'] = {};
  const same: Result['same'] = {};
  for (const r of results) {
    arms[r.row.arm] = {
      report: r.report,
      explain: r.explain,
      info: r.info,
      tape: await digest(r.tape),
      log: await digest(r.log),
    };
    if (r !== first) {
      same[r.row.arm] = {
        tape: diff(first.tape, r.tape),
        log: logDiff(first.log, r.log),
        list: listDiff(first.list, r.list),
      };
    }
  }
  return {
    info: first.info,
    rows: results.map((r) => r.row),
    arms,
    same,
    tape: base64(first.tape),
    log: [...first.log],
    list: first.list,
    ...(o.tier === 'webgl2' ? { refusals: await refusals(o) } : {}),
  };
}

/**
 * What a device of WebGL2 alone refuses (method step 4): each kernel of a block called on its own,
 * and the block's plan, each on new arrays, with the error's message word for word, or "ran".
 */
export async function refusals(o: Options): Promise<Record<string, string>> {
  const dev = await createDevice({ prefer: ['webgl2'] });
  const found: Record<string, string> = { tier: dev.tier };
  const blank = (): Grain[] => Array.from({ length: o.capacity }, () => new Grain(0, 1, 0, 0));
  const cloud = cloudOf(o);
  const attempt = async (name: string, run: () => Promise<unknown>): Promise<void> => {
    try {
      await run();
      found[name] = 'ran';
    } catch (e) {
      found[name] = e instanceof Error ? e.message : String(e);
    }
  };
  try {
    await attempt('cull', async () => {
      const count = dev.array(new Uint32Array(1));
      cull(dev.array(blank()), count, dev.array(blank()), dev.array(new Uint32Array(1)), 0);
      await count.read();
    });
    await attempt('spawn', async () => {
      const count = dev.array(new Uint32Array(1));
      spawn({ array: dev.array(blank()), length: count }, cloud, 0, o.block);
      await count.read();
    });
    await attempt('play', async () => {
      const out = dev.array(o.block, 'f32');
      play(out, dev.array(blank()), dev.array(new Uint32Array(1)), 0);
      await out.read();
    });
    await attempt('keep', async () => {
      const tape = dev.array(o.block, 'f32');
      keep(tape, dev.array(o.block, 'f32'), 0);
      await tape.read();
    });
    await attempt('tally', async () => {
      const log = dev.array(2, 'u32');
      tally(log, 0, dev.array(new Uint32Array(1)));
      await log.read();
    });
    await attempt('plan', async () => {
      const lists = [dev.array(blank()), dev.array(blank())] as const;
      const counts = [dev.array(new Uint32Array(1)), dev.array(new Uint32Array(1))] as const;
      const tape = dev.array(o.block, 'f32');
      const log = dev.array(2, 'u32');
      await dev.fuse((scope) => {
        const bus = scope.scratch(o.block);
        cull(lists[0], counts[0], lists[1], counts[1], 0);
        tally(log, 0, counts[0]);
        spawn({ array: lists[0], length: counts[0] }, cloud, 0, o.block);
        tally(log, 1, counts[0]);
        play(bus, lists[0], counts[0], 0);
        keep(tape, bus, 0);
      });
    });
  } finally {
    await dev.dispose();
  }
  return found;
}
