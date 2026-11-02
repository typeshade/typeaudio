// Experiment 1, the round trip per block size (docs/experiments.md, section 1): the timing, shared
// by the CPU tier in Node (`node.ts`) and WebGPU in a page (`browser.ts`). One block is timed with
// `performance.now()` from the call to the host's read of the result, in four ways:
//
// - `call`: the kernel called with a host `Float32Array`, which the call reads back into;
// - `resident`: the output a `Resident`, the call queued and the output read once per block;
// - `budget`: as `resident`, on a device made with `createDevice({ timeBudgetMs })`, the call run as
//   one chunk, `dev.fuse(body, { chunk })`, which the device fences, times and learns a rate from;
// - `engine`: the engine's own block, `render()` of a bank of voices, one `fuse` plan per block.
//
// On WebGL2 a call that tier cannot run falls to the CPU tier: the voices' loop writes at
// `v * block + n` and the meter reduces, and WebGL2 runs neither (compiler surface §65).

import { configure, createDevice, type DeviceInfo, type FuseReport } from 'typeshade/runtime';
import { partials } from './partials.shade.ts';
import { bank, plan, render } from '../../src/index.ts';
import { Voice } from '../../src/kernels/synth.shade.ts';
import { tiersOf, type Options, type Row, type Variant } from './options.ts';

export { SIZES, VARIANTS, type Options, type Row, type Variant } from './options.ts';

export interface Result {
  readonly info: DeviceInfo;
  readonly rows: Row[];
  /** `engine`: the fuse report of the last block of the largest size. */
  readonly report?: FuseReport;
}

const SR = 48000;
const F0 = 110;

/** Runs the experiment and resolves to its rows; `progress` sees each row when it is done. */
export async function measure(o: Options, progress: (row: Row) => void = () => {}): Promise<Result> {
  const prefer = tiersOf(o.tier);
  configure({ prefer });
  const rows: Row[] = [];
  const add = (row: Row): void => {
    rows.push(row);
    progress(row);
  };
  const probe = await createDevice({ prefer });
  const info = probe.info;
  await probe.dispose();
  let report: FuseReport | undefined;
  for (const variant of o.variants) {
    if (variant === 'call') {
      for (const n of o.sizes) {
        const out = new Float32Array(n);
        const t = await time(o, async (i) => {
          await partials(out, i * n, F0, SR);
        });
        add(row(variant, info.tier, n, t));
      }
    } else if (variant === 'resident' || variant === 'budget') {
      const dev = await createDevice(
        variant === 'budget' ? { prefer, timeBudgetMs: o.budgetMs } : { prefer },
      );
      try {
        for (const n of o.sizes) {
          const out = dev.array(n, 'f32');
          const key = `partials-${n}`;
          let ran: string = dev.tier;
          const t = await time(
            o,
            variant === 'resident'
              ? async (i) => {
                  partials(out, i * n, F0, SR);
                  await out.read();
                }
              : async (i) => {
                  const chunk = await dev.fuse(
                    () => {
                      partials(out, i * n, F0, SR);
                    },
                    { chunk: { key, units: n } },
                  );
                  ran = chunk.tier;
                  await out.read();
                },
          );
          const rate = dev.chunkRates[key];
          add({
            ...row(variant, ran, n, t),
            ...(variant === 'budget' && rate !== undefined ? { chunkMs: rate.msPerUnit * n } : {}),
          });
          dev.release(out);
        }
      } finally {
        await dev.dispose();
      }
    } else {
      const dev = await createDevice({ prefer });
      try {
        const voices = bank(
          dev,
          Array.from({ length: o.voices }, (_, v) => new Voice(F0 * (1 + v / 8), 2400, 0.7, SR)),
        );
        const p = plan(voices, { drive: 1.5, gain: 1 / o.voices });
        for (const n of o.sizes) {
          const reports: FuseReport[] = [];
          const t = await time(o, async () => {
            await render(p, { frames: n, block: n });
            reports.push(p.reports[0]!);
          });
          const timed = reports.slice(o.warmup);
          const gpu = timed.map((r) => r.groups.reduce((s, g) => s + (g.gpuTime ?? 0), 0));
          const measured = timed.every((r) => r.groups.some((g) => g.gpuTime !== undefined));
          report = timed[timed.length - 1];
          add({
            ...row(variant, report?.tier ?? dev.tier, n, t),
            ...(measured && gpu.length > 0
              ? { gpuMs: gpu.reduce((s, x) => s + x, 0) / gpu.length / 1e6 }
              : {}),
            dispatches: report?.dispatches ?? 0,
          });
        }
      } finally {
        await dev.dispose();
      }
    }
  }
  return { info, rows, ...(report === undefined ? {} : { report }) };
}

interface Times {
  readonly first: number;
  readonly times: number[];
}

/** Runs `block` for the warm-up, the first apart, then times `o.blocks` blocks one by one. */
async function time(o: Options, block: (i: number) => Promise<void>): Promise<Times> {
  let start = performance.now();
  await block(0);
  const first = performance.now() - start;
  for (let i = 1; i < o.warmup; i++) await block(i);
  const times: number[] = [];
  for (let i = 0; i < o.blocks; i++) {
    start = performance.now();
    await block(o.warmup + i);
    times.push(performance.now() - start);
  }
  return { first, times };
}

/** The statistics of one size: the median and the 99th percentile by nearest rank. */
function row(variant: Variant, tier: string, frames: number, t: Times): Row {
  const sorted = [...t.times].sort((a, b) => a - b);
  const rank = (p: number): number => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
  return {
    variant,
    tier,
    frames,
    blocks: sorted.length,
    firstMs: t.first,
    medianMs: rank(50),
    p99Ms: rank(99),
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    meanMs: sorted.reduce((s, x) => s + x, 0) / sorted.length,
  };
}
