// Experiment 5 on one tier of the host face (compiler surface §64 to §71): the partitioned
// convolution as the engine would run it, each array a `Resident` of one device and each block
// one `dev.fuse` plan of six calls. The page (`browser.ts`) runs it on WebGPU and on WebGL2, and
// Node (`node.ts`) on the CPU tier, where the pin refuses the FFT entry, which reaches a barrier
// (change 0092 is accepted, not implemented): there it runs the kernel check alone.

import { configure, createDevice, type Device, type DeviceInfo, type DeviceStatistics, type FuseReport, type Resident } from 'typeshade/runtime';
import { fftMediumTable } from '../03-fft/fft.shade.ts';
import { toBase64, twiddleTable } from '../03-fft/signals.ts';
import { accumulate, overlapAdd, pad, store } from './convolution.shade.ts';
import {
  CHECK_HEAD,
  CHECK_SLOT,
  FORWARD,
  FRAMES,
  INVERSE,
  JUMP_FROM,
  LEVELS,
  PARTITIONS,
  POINTS,
  TAIL_BLOCKS,
  TAIL_FIRST_BLOCK,
  checkInputs,
  impulseBlock,
  impulseResponse,
  noise,
  paddedPartitions,
  type Level,
} from './signals.ts';

export type Tier = 'webgpu' | 'webgl2' | 'cpu';
/** How an impulse's tail runs: every block (`full`), or block 0 and then from `JUMP_FROM` (`jump`). */
export type Tail = 'full' | 'jump';

export interface Options {
  readonly tier: Tier;
  /** The noise blocks to time, from the first. */
  readonly blocks: number;
  /** The impulses whose tails to run, and how. */
  readonly levels: readonly Level[];
  readonly tails: readonly Tail[];
  /** How long one block may take, in milliseconds, the transform of the partitions excepted. */
  readonly timeoutMs: number;
  /** How long the transform of the partitions may take, in milliseconds. */
  readonly prepareTimeoutMs: number;
  /** Whether to return the partitions' spectra, 7.3 MiB, for the comparison of the transforms. */
  readonly spectra: boolean;
}

/** What one block of the noise run took. */
export interface Timing {
  /** Host time from the input's write to the end of the output's read, in milliseconds. */
  readonly ms: number;
  /** The GPU time of each group of the block's plan, in nanoseconds, where the device measured it. */
  readonly gpu?: (number | null)[];
  readonly dispatches?: number;
  readonly submissions?: number;
}

/** An impulse's tail: the outputs of the blocks from `TAIL_FIRST_BLOCK` to the last. */
export interface TailRun {
  readonly level: Level;
  readonly tail: Tail;
  /** The blocks the run ran. */
  readonly blocks: number;
  /** base64 of the `f32` outputs of blocks `TAIL_FIRST_BLOCK` to `TAIL_BLOCKS - 1`. */
  readonly output?: string;
  /** The host time of each block, in milliseconds. */
  readonly ms?: number[];
  readonly failed?: string;
}

/** The kernel check: each kernel function called once on seeded inputs, as plain calls. */
export interface KernelCheck {
  readonly name: string;
  /** base64 of what the call wrote: the whole output, or the slot `store` writes. */
  readonly output?: string;
  /** `store`: the values outside the slot that changed. */
  readonly outside?: number;
  /** `fuse`: the report of the plan, where it ran. */
  readonly report?: FuseReport;
  readonly ms?: number;
  readonly refused?: string;
}

export interface Result {
  readonly tier: Tier;
  readonly info?: DeviceInfo;
  /** The device's tier and the tiers it skipped. */
  readonly device?: { readonly tier: string; readonly skipped: readonly { tier: string; reason: string }[] };
  readonly limits?: Readonly<Record<string, number>>;
  /** Why the convolution did not run on this tier, as a whole. */
  readonly refused?: string;
  /** The transform of the partitions: its host time, and the spectra if asked. */
  readonly prepare?: { readonly ms: number; readonly spectra?: string };
  /** What the device counted of its arrays after the transform of the partitions and the engine's arrays. */
  readonly statistics?: { readonly held: DeviceStatistics; readonly end: DeviceStatistics };
  /** Whether each block ran as one fuse plan, or as plain calls since fuse refused it, with why. */
  readonly plan?: { readonly fused: boolean; readonly refusal?: string };
  /** The fuse report of the first and of the last noise block. */
  readonly reports?: { readonly first?: FuseReport; readonly last?: FuseReport };
  readonly timings?: Timing[];
  /** base64 of the noise run's `f32` output, block after block. */
  readonly noise?: string;
  /** Why the noise run stopped before its last block. */
  readonly noiseFailed?: string;
  readonly tails?: TailRun[];
  readonly checks: KernelCheck[];
  /** WebGPU: the transform and the noise run again on a device with no `timestamp-query`. */
  readonly bare?: {
    readonly features?: string[];
    readonly prepareMs?: number;
    readonly timings?: Timing[];
    readonly noise?: string;
    readonly plan?: { readonly fused: boolean; readonly refusal?: string };
    readonly report?: FuseReport;
    readonly failed?: string;
  };
  /** The calls that did not return in time, and the calls after them that were not run. */
  readonly unfinished?: string;
}

/** `p`, or a rejection once `ms` milliseconds pass without it. */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new Timeout(`${what} did not return within ${String(ms / 1000)} s`)), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

class Timeout extends Error {}

/** The engine's arrays on one device: the spectra, the delay line, the overlap-add's tail, scratch. */
class Engine {
  readonly line: Resident<Float32Array>;
  readonly tail: Resident<Float32Array>;
  readonly input: Resident<Float32Array>;
  readonly padded: Resident<Float32Array>;
  readonly spectrum: Resident<Float32Array>;
  readonly sum: Resident<Float32Array>;
  readonly frames: Resident<Float32Array>;
  readonly out: Resident<Float32Array>;
  /** Whether a block runs as one fuse plan; false once fuse refused one. */
  fused = true;
  refusal: string | undefined;

  constructor(
    readonly dev: Device,
    readonly spectra: Resident<Float32Array>,
    readonly twiddles: Resident<Float32Array>,
  ) {
    this.line = dev.array(PARTITIONS * POINTS * 2, 'f32');
    this.tail = dev.array(FRAMES, 'f32');
    this.input = dev.array(FRAMES, 'f32');
    this.padded = dev.array(POINTS * 2, 'f32');
    this.spectrum = dev.array(POINTS * 2, 'f32');
    this.sum = dev.array(POINTS * 2, 'f32');
    this.frames = dev.array(POINTS * 2, 'f32');
    this.out = dev.array(FRAMES, 'f32');
  }

  /** Zeros the delay line and the overlap-add's tail, as a new engine holds them. */
  reset(): void {
    this.line.write(new Float32Array(PARTITIONS * POINTS * 2));
    this.tail.write(new Float32Array(FRAMES));
  }

  /**
   * The six calls of a block whose newest spectrum goes to slot `slot`, in order, and what each
   * returned: the promise a call gives inside a fuse scope and outside one (surface §71). The view
   * types a call whose written arrays are all Residents as returning nothing.
   */
  calls(slot: number): unknown[] {
    return [
      pad(this.padded, this.input),
      fftMediumTable({ transform: FORWARD, src: this.padded, dst: this.spectrum, twiddles: this.twiddles }, 1),
      store(this.line, this.spectrum, slot),
      accumulate(this.sum, this.line, this.spectra, slot, PARTITIONS),
      fftMediumTable({ transform: INVERSE, src: this.sum, dst: this.frames, twiddles: this.twiddles }, 1),
      overlapAdd(this.out, this.tail, this.frames),
    ];
  }

  /** Runs block `k` of input `x` and resolves to its output, its host time and its fuse report. */
  async block(k: number, x: Float32Array): Promise<{ y: Float32Array; ms: number; report?: FuseReport }> {
    const slot = k % PARTITIONS;
    const start = performance.now();
    this.input.write(x);
    let report: FuseReport | undefined;
    if (this.fused) {
      let pending: unknown[] = [];
      try {
        report = await this.dev.fuse(() => {
          pending = this.calls(slot);
        });
      } catch (e) {
        // The plan failed before any call ran (surface §71): run the block as plain calls.
        this.fused = false;
        this.refusal = String(e);
      }
      // The plan's own promise carries its error; each call's promise rejects with it too.
      for (const p of pending) if (p instanceof Promise) p.catch(() => {});
    }
    if (!this.fused) {
      // Plain calls: a call that fails rejects its own promise, and a later call that reads what it
      // would have written runs on what the array held before. Each promise is awaited, so a failed
      // call stops the block with its sentence.
      await Promise.all(this.calls(slot));
    }
    const y = await this.out.read();
    return { y, ms: performance.now() - start, ...(report === undefined ? {} : { report }) };
  }
}

/** The GPU time of each group of a report, null where the device did not measure it. */
const gpuOf = (r: FuseReport): (number | null)[] => r.groups.map((g) => g.gpuTime ?? null);

/** The transform of the partitions on `dev`, once: the spectra and the twiddles, as Residents. */
async function prepareOn(
  dev: Device,
  o: Options,
  read: boolean,
): Promise<{ spectra: Resident<Float32Array>; twiddles: Resident<Float32Array>; ms: number; bits?: string }> {
  const partitions = dev.array(paddedPartitions(impulseResponse()));
  const spectra = dev.array(PARTITIONS * POINTS * 2, 'f32');
  const twiddles = dev.array(twiddleTable(POINTS));
  const start = performance.now();
  await within(
    (async () => {
      await fftMediumTable({ transform: FORWARD, src: partitions, dst: spectra, twiddles }, PARTITIONS);
      await dev.wait();
    })(),
    o.prepareTimeoutMs,
    'the transform of the partitions',
  );
  const ms = performance.now() - start;
  const bits = read ? toBase64(await spectra.read()) : undefined;
  dev.release(partitions);
  return { spectra, twiddles, ms, ...(bits === undefined ? {} : { bits }) };
}

/** The noise run on `engine`: `o.blocks` blocks from the first, each timed. */
async function noiseOn(
  engine: Engine,
  o: Options,
  progress: (line: string) => void,
  label: string,
): Promise<{ timings: Timing[]; y: Float32Array; first?: FuseReport; last?: FuseReport }> {
  const x = noise(o.blocks);
  const y = new Float32Array(o.blocks * FRAMES);
  const timings: Timing[] = [];
  let first: FuseReport | undefined;
  let last: FuseReport | undefined;
  for (let k = 0; k < o.blocks; k++) {
    const b = await within(engine.block(k, x.subarray(k * FRAMES, (k + 1) * FRAMES)), o.timeoutMs, `${label} noise block ${k}`);
    y.set(b.y, k * FRAMES);
    const r = b.report;
    if (r !== undefined) {
      if (first === undefined) first = r;
      last = r;
    }
    timings.push({
      ms: b.ms,
      ...(r === undefined ? {} : { gpu: gpuOf(r), dispatches: r.dispatches, submissions: r.submissions }),
    });
    if (k === 0 || (k + 1) % 100 === 0) progress(`${label} noise block ${k}: ${b.ms.toFixed(2)} ms`);
  }
  return { timings, y, ...(first === undefined ? {} : { first }), ...(last === undefined ? {} : { last }) };
}

/** A device that `browser.ts` makes for WebGPU with no feature requested: no `timestamp-query`. */
export type BareDevice = () => Promise<{ dev: Device; release: () => void }>;

/**
 * Runs the convolution on `o.tier`: the transform of the partitions, the timed noise blocks, the
 * impulses' tails, then the kernel check. With `bare` (WebGPU), the transform and the noise run
 * again on a device with no `timestamp-query`, whose plans read nothing back but the output (compiler
 * issue #986). `progress` sees a line for each stage.
 */
export async function runTier(o: Options, progress: (line: string) => void = () => {}, bare?: BareDevice): Promise<Result> {
  // On WebGL2 a call that tier cannot run falls to the CPU tier, as in experiment 1: the kernel
  // functions that write an `array<vec2>` have no WebGL2 loop (the kernel check records why).
  const prefer: Tier[] = o.tier === 'webgl2' ? ['webgl2', 'cpu'] : [o.tier];
  configure({ prefer });
  const checks: KernelCheck[] = [];
  let dev: Device;
  try {
    // A pool of 0 bytes frees a released array at once, so the statistics count what the engine holds.
    dev = await createDevice({ prefer, poolBytes: 0 });
  } catch (e) {
    progress(`${o.tier}: no device (${String(e)})`);
    return { tier: o.tier, refused: `createDevice(): ${String(e)}`, checks: await kernelChecks(progress, o.tier === 'cpu') };
  }
  const info = dev.info;
  const device = { tier: dev.tier, skipped: dev.skipped };
  const limits = dev.limits;
  let unfinished: string | undefined;
  try {
    // 1. The transform of the partitions, once.
    let prepared: Awaited<ReturnType<typeof prepareOn>>;
    try {
      prepared = await prepareOn(dev, o, o.spectra);
      progress(`${o.tier} the transform of ${PARTITIONS} partitions: ${prepared.ms.toFixed(1)} ms`);
    } catch (e) {
      if (e instanceof Timeout) unfinished = e.message;
      progress(`${o.tier} the transform of the partitions: ${String(e)}`);
      return {
        tier: o.tier,
        info,
        device,
        limits,
        refused: `the transform of the partitions: ${String(e)}`,
        checks: unfinished === undefined ? await kernelChecks(progress, o.tier === 'cpu') : checks,
        ...(unfinished === undefined ? {} : { unfinished }),
      };
    }
    const prepare = { ms: prepared.ms, ...(prepared.bits === undefined ? {} : { spectra: prepared.bits }) };
    const engine = new Engine(dev, prepared.spectra, prepared.twiddles);
    const held = dev.statistics;

    // 2. The noise run, timed block by block.
    let run: Awaited<ReturnType<typeof noiseOn>> = { timings: [], y: new Float32Array(0) };
    let failed: string | undefined;
    try {
      run = await noiseOn(engine, o, progress, o.tier);
    } catch (e) {
      if (e instanceof Timeout) unfinished = e.message;
      failed = String(e);
      progress(`${o.tier} the noise run: ${failed}`);
    }

    // 3. The impulses' tails.
    const tails: TailRun[] = [];
    for (const level of o.levels) {
      for (const tail of o.tails) {
        if (unfinished !== undefined || failed !== undefined) {
          tails.push({ level, tail, blocks: 0, failed: `not run: ${unfinished ?? failed}` });
          continue;
        }
        engine.reset();
        const order = tail === 'full'
          ? Array.from({ length: TAIL_BLOCKS }, (_, k) => k)
          : [0, ...Array.from({ length: TAIL_BLOCKS - JUMP_FROM }, (_, i) => JUMP_FROM + i)];
        const out = new Float32Array((TAIL_BLOCKS - TAIL_FIRST_BLOCK) * FRAMES);
        const ms: number[] = [];
        try {
          for (const k of order) {
            const b = await within(engine.block(k, impulseBlock(k, LEVELS[level])), o.timeoutMs, `${level} ${tail} block ${k}`);
            ms.push(b.ms);
            if (k >= TAIL_FIRST_BLOCK) out.set(b.y, (k - TAIL_FIRST_BLOCK) * FRAMES);
          }
          tails.push({ level, tail, blocks: order.length, output: toBase64(out), ms });
          progress(`${o.tier} the ${level} impulse's tail, ${tail}: ${order.length} blocks`);
        } catch (e) {
          if (e instanceof Timeout) unfinished = e.message;
          tails.push({ level, tail, blocks: ms.length, failed: String(e) });
          progress(`${o.tier} the ${level} impulse's tail, ${tail}: ${String(e)}`);
        }
      }
    }
    const end = dev.statistics;
    if (unfinished === undefined) {
      // The kernel check runs on the tier alone, so that a call it cannot run is refused with why.
      configure({ prefer: [o.tier] });
      checks.push(...(await kernelChecks(progress, false)));
      configure({ prefer });
    }

    // 4. The same transform and noise run on a device with no timestamp-query.
    let bareRun: Result['bare'];
    if (bare !== undefined && unfinished === undefined && failed === undefined) {
      const made = await bare();
      try {
        const p = await prepareOn(made.dev, o, false);
        const e = new Engine(made.dev, p.spectra, p.twiddles);
        const r = await noiseOn(e, o, progress, `${o.tier} (no timestamp-query)`);
        bareRun = {
          features: [...(made.dev.info.webgpu?.features ?? [])],
          prepareMs: p.ms,
          timings: r.timings,
          noise: toBase64(r.y),
          plan: { fused: e.fused, ...(e.refusal === undefined ? {} : { refusal: e.refusal }) },
          ...(r.last === undefined ? {} : { report: r.last }),
        };
      } catch (err) {
        if (err instanceof Timeout) unfinished = err.message;
        bareRun = { failed: String(err) };
      } finally {
        if (unfinished === undefined) {
          await made.dev.dispose();
          made.release();
        }
      }
    }
    return {
      tier: o.tier,
      info,
      device,
      limits,
      prepare,
      statistics: { held, end },
      plan: { fused: engine.fused, ...(engine.refusal === undefined ? {} : { refusal: engine.refusal }) },
      reports: { ...(run.first === undefined ? {} : { first: run.first }), ...(run.last === undefined ? {} : { last: run.last }) },
      timings: run.timings,
      noise: toBase64(run.y),
      ...(failed === undefined ? {} : { noiseFailed: failed }),
      tails,
      checks,
      ...(bareRun === undefined ? {} : { bare: bareRun }),
      ...(unfinished === undefined ? {} : { unfinished }),
    };
  } finally {
    // A call that did not return holds the device: leave it, as experiment 3 leaves a stuck tier.
    if (unfinished === undefined) {
      await dev.dispose();
      configure({});
    }
  }
}

/**
 * Calls each kernel function once with host arrays, which the call reads back into, on the tiers
 * `configure` set: the CPU tier in Node, WebGPU or WebGL2 in the page. Then the FFT entry, which
 * the CPU tier refuses at the pin. With `cpuPlan`, one block as a fuse plan on a CPU device, whose
 * report or refusal is recorded.
 */
export async function kernelChecks(progress: (line: string) => void, cpuPlan: boolean): Promise<KernelCheck[]> {
  const out: KernelCheck[] = [];
  const run = async (name: string, call: () => Promise<unknown>, output: () => Float32Array, outside?: () => number): Promise<void> => {
    const start = performance.now();
    try {
      await call();
      const ms = performance.now() - start;
      out.push({ name, output: toBase64(output()), ms, ...(outside === undefined ? {} : { outside: outside() }) });
      progress(`check ${name}: ${ms.toFixed(1)} ms`);
    } catch (e) {
      out.push({ name, refused: String(e) });
      progress(`check ${name}: refused: ${String(e)}`);
    }
  };
  const i = checkInputs();
  const padded = new Float32Array(POINTS * 2);
  await run('pad', () => pad(padded, i.input), () => padded);
  const line = i.line.slice();
  await run(
    'store',
    () => store(line, i.spectrum, CHECK_SLOT),
    () => line.slice(CHECK_SLOT * POINTS * 2, (CHECK_SLOT + 1) * POINTS * 2),
    () => {
      let changed = 0;
      for (let j = 0; j < line.length; j++) {
        const inSlot = j >= CHECK_SLOT * POINTS * 2 && j < (CHECK_SLOT + 1) * POINTS * 2;
        if (!inSlot && !Object.is(line[j], i.line[j])) changed++;
      }
      return changed;
    },
  );
  const sum = new Float32Array(POINTS * 2);
  await run('accumulate', () => accumulate(sum, i.line, i.spectra, CHECK_HEAD, PARTITIONS), () => sum);
  const frames = new Float32Array(FRAMES);
  const tail = i.tail.slice();
  await run('overlapAdd', () => overlapAdd(frames, tail, i.block), () => {
    const both = new Float32Array(2 * FRAMES);
    both.set(frames);
    both.set(tail, FRAMES);
    return both;
  });
  const dst = new Float32Array(POINTS * 2);
  await run(
    'fftMediumTable',
    () => fftMediumTable({ transform: FORWARD, src: i.block, dst, twiddles: twiddleTable(POINTS) }, 1),
    () => dst,
  );
  if (cpuPlan) {
    // One block as a fuse plan on a CPU device: the plan holds the FFT entry, which reaches a barrier.
    try {
      const cpu = await createDevice({ prefer: ['cpu'], poolBytes: 0 });
      try {
        const engine = new Engine(cpu, cpu.array(i.spectra), cpu.array(twiddleTable(POINTS)));
        engine.input.write(i.input);
        const report = await cpu.fuse(() => engine.calls(0));
        out.push({ name: 'fuse', report });
        progress(`check fuse: ran, ${JSON.stringify(report)}`);
      } finally {
        await cpu.dispose();
      }
    } catch (e) {
      out.push({ name: 'fuse', refused: String(e) });
      progress(`check fuse: refused: ${String(e)}`);
    }
  }
  return out;
}
