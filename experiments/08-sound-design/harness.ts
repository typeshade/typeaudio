// Experiment 8 on one tier (docs/experiments.md, section 8): the layered render of `plan.json`, timed
// block by block against the budget of a block; the same blocks rendered twice, to count the values
// that differ; and two variants of the plan that differ in one correction, rendered cold and warm.
// It is shared by the CPU tier in Node (`node.ts`) and WebGPU and WebGL2 in a page (`browser.ts`).

import { createDevice, type Device, type DeviceInfo } from 'typeshade/runtime';
import { BLOCK_BUDGET_MS, renderPlan, SAMPLE_RATE, type Rendered } from '../../src/render-plan.ts';
import { BLOCK } from '../../src/spatial/room.ts';
import { validatePlan, type SoundPlan } from '../../src/plan/index.ts';
import { toBase64 } from '../03-fft/signals.ts';
import plan from './plan.json';
import { stemsOf } from './stems.ts';
import { timingOf, tiersOf, type BlockTiming, type Options } from './options.ts';

export { DEFAULTS, tiersOf, type Options, type Tier } from './options.ts';

/** The correction of the note's example: every whoosh a little darker and louder. */
export const CORRECTION = {
  kind: 'whoosh',
  set: { macros: { brightness: 0.4 }, intensity: 0.85 },
} as const;

/** The plan with the correction applied to every event of its kind and no other. */
export function corrected(p: SoundPlan): SoundPlan {
  return {
    ...p,
    events: p.events.map((e) =>
      e.kind === CORRECTION.kind
        ? {
            ...e,
            intensity: CORRECTION.set.intensity,
            macros: { ...e.macros, ...CORRECTION.set.macros },
          }
        : e,
    ),
  };
}

export interface GroupSummary {
  readonly calls: string;
  readonly fused: boolean;
  /** The tier the group ran on, and why it ran on a later tier than the plan's, where the report says. */
  readonly tier: string;
  readonly dispatches: number;
  readonly why?: string;
  /** The mean GPU time of the group over the blocks, in milliseconds, where the device measured it. */
  readonly gpuMs?: number;
}

export interface FullRun {
  readonly blocks: number;
  readonly frames: number;
  readonly timing: BlockTiming;
  /** The tier the fuse report names, and what the first and the last block's plan was. */
  readonly reportTier: string;
  readonly dispatches: { readonly first: number; readonly last: number };
  readonly submissions: number;
  readonly groups: readonly GroupSummary[];
  readonly master: Rendered['master'];
  readonly hostMs: number;
  /** The transform of the reverb's partitions before the first block, in milliseconds. */
  readonly reverbPrepareMs: number;
  /** base64 of the mix's `f32`s: the left channel, then the right. */
  readonly mix?: string;
}

export interface VariantRun {
  readonly seconds: number;
  readonly blocks: number;
  /** The wall time of each render in milliseconds: variant A, then variant B. */
  readonly ms: readonly [number, number];
  readonly pairMs: number;
}

export interface Result {
  readonly tier: string;
  readonly requested: string;
  readonly info?: DeviceInfo;
  readonly device?: {
    readonly tier: string;
    readonly skipped: readonly { tier: string; reason: string }[];
  };
  readonly limits?: Readonly<Record<string, number>>;
  readonly full?: FullRun;
  readonly repeat?: { readonly blocks: number; readonly values: number; readonly differ: number };
  /** A device made for the pair, so the first render builds the pipelines (cold), then the pair again (warm). */
  readonly variants?: { readonly cold: VariantRun; readonly warm: VariantRun };
  /** A step that stopped, with the sentence it stopped on, word for word. */
  readonly failed: { readonly step: string; readonly message: string }[];
}

/** The number of values of `a` and `b` whose bits differ. */
function differing(a: readonly Float32Array[], b: readonly Float32Array[]): number {
  let n = 0;
  a.forEach((x, c) => {
    const y = b[c]!;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) n++;
  });
  return n;
}

/**
 * Runs experiment 8 on `o.tier`. `keep` receives the render of the full run, which Node's entry
 * analyzes. A step that throws is recorded in `failed` and the next step runs.
 */
export async function runTier(
  o: Options,
  progress: (line: string) => void = () => {},
  keep?: (r: Rendered) => void,
): Promise<Result> {
  const failed: { step: string; message: string }[] = [];
  const sound = validatePlan(plan);
  const stems = stemsOf(sound, SAMPLE_RATE);
  const prefer = tiersOf(o.tier);
  let dev: Device;
  try {
    dev = await createDevice({ prefer });
  } catch (e) {
    return {
      tier: o.tier,
      requested: o.tier,
      failed: [{ step: 'createDevice', message: String(e) }],
    };
  }
  const info = dev.info;
  const device = { tier: dev.tier, skipped: dev.skipped };
  const limits = dev.limits;
  let full: FullRun | undefined;
  let repeat: Result['repeat'];
  let variants: Result['variants'];
  try {
    // 1. The plan, rendered through the whole chain, every block timed.
    try {
      const start = performance.now();
      const r = await renderPlan(dev, plan, {
        stems,
        ...(o.blocks > 0 ? { blocks: o.blocks } : {}),
      });
      const hostMs = performance.now() - start;
      const last = r.reports[r.reports.length - 1]!;
      full = {
        blocks: r.blockMs.length,
        frames: r.frames,
        timing: timingOf(r.blockMs, BLOCK_BUDGET_MS),
        reportTier: r.tier,
        dispatches: { first: r.reports[0]!.dispatches, last: last.dispatches },
        submissions: last.submissions,
        groups: last.groups.map((g, i) => {
          const times = r.reports.flatMap((rep) => rep.groups[i]?.gpuTime ?? []);
          return {
            calls: g.calls.join('+'),
            fused: g.fused,
            tier: g.tier,
            dispatches: g.dispatches,
            ...(g.why === undefined ? {} : { why: g.why }),
            ...(times.length === 0
              ? {}
              : { gpuMs: times.reduce((a, b) => a + b, 0) / times.length / 1e6 }),
          };
        }),
        master: r.master,
        hostMs,
        reverbPrepareMs: r.reverbPrepareMs,
        ...(o.returnMix ? { mix: toBase64(Float32Array.from([...r.mix[0], ...r.mix[1]])) } : {}),
      };
      progress(
        `${o.tier} full render: ${full.blocks} blocks, median ${full.timing.ms.median.toFixed(2)} ms, p95 ${full.timing.ms.p95.toFixed(2)} ms, ${full.timing.over} over ${BLOCK_BUDGET_MS.toFixed(2)} ms, ${(hostMs / 1000).toFixed(1)} s`,
      );
      keep?.(r);
    } catch (e) {
      failed.push({ step: 'full render', message: String(e) });
      progress(`${o.tier} full render: ${String(e)}`);
    }
    // 2. The same blocks twice, on the same device: the values that differ.
    try {
      const blocks = o.repeatBlocks;
      const a = await renderPlan(dev, plan, { stems, blocks });
      const b = await renderPlan(dev, plan, { stems, blocks });
      repeat = { blocks, values: 2 * a.frames, differ: differing(a.mix, b.mix) };
      progress(`${o.tier} repeat: ${repeat.differ} of ${repeat.values} values differ`);
    } catch (e) {
      failed.push({ step: 'repeat', message: String(e) });
    }
  } finally {
    await dev.dispose();
  }
  // 3. Two variants, on a device of their own: the pair cold, then the pair warm. 0 seconds skips it.
  if (o.variantSeconds > 0)
    try {
      const vdev = await createDevice({ prefer });
      try {
        const blocks = Math.ceil((o.variantSeconds * SAMPLE_RATE) / BLOCK);
        const pair = async (): Promise<VariantRun> => {
          const times: number[] = [];
          for (const p of [sound, corrected(sound)]) {
            const t = performance.now();
            await renderPlan(vdev, p, { stems, blocks });
            times.push(performance.now() - t);
          }
          return {
            seconds: o.variantSeconds,
            blocks,
            ms: [times[0]!, times[1]!],
            pairMs: times[0]! + times[1]!,
          };
        };
        const cold = await pair();
        progress(
          `${o.tier} variants cold: ${(cold.pairMs / 1000).toFixed(2)} s for ${o.variantSeconds} s each`,
        );
        const warm = await pair();
        progress(`${o.tier} variants warm: ${(warm.pairMs / 1000).toFixed(2)} s`);
        variants = { cold, warm };
      } finally {
        await vdev.dispose();
      }
    } catch (e) {
      failed.push({ step: 'variants', message: String(e) });
    }
  return {
    tier: dev.tier,
    requested: o.tier,
    info,
    device,
    limits,
    ...(full === undefined ? {} : { full }),
    ...(repeat === undefined ? {} : { repeat }),
    ...(variants === undefined ? {} : { variants }),
    failed,
  };
}
