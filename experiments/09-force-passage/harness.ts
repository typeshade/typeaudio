// Experiment 9 on one tier (docs/experiments.md, section 9): the plan of the force passage through
// `renderPlan`, every block timed. The page (`page.ts`) and Node (`node.ts`) share it. The mix, the
// reverb's return and the stems come back as base64 of their `f32`s, left then right.

import { createDevice, type DeviceInfo } from 'typeshade/runtime';
import { BLOCK_BUDGET_MS, renderPlan, type Rendered } from '../../src/render-plan.ts';
import { LAYERS } from '../../src/plan/index.ts';
import { toBase64 } from '../03-fft/signals.ts';
import { timingOf, tiersOf, type BlockTiming, type Tier } from '../08-sound-design/options.ts';
import plan from './plan.json';

export interface Options {
  readonly tier: Tier;
  /** The blocks to render, from the first; 0 is every block of the clip. */
  readonly blocks: number;
  /** Whether to return the stems and the reverb's return beside the mix. */
  readonly stems: boolean;
}

export interface Result {
  readonly tier: string;
  readonly requested: Tier;
  readonly info?: DeviceInfo;
  readonly failed?: string;
  readonly frames?: number;
  readonly sampleRate?: number;
  readonly timing?: BlockTiming;
  readonly hostMs?: number;
  readonly reverbPrepareMs?: number;
  readonly master?: Rendered['master'];
  readonly placed?: Rendered['placed'];
  /** The groups of the last block's fuse plan: the calls, the tier and why. */
  readonly groups?: { calls: string; tier: string; why?: string }[];
  /** base64 of `f32`s, the left channel then the right. */
  readonly mix?: string;
  readonly wet?: string;
  readonly layers?: Record<string, string>;
}

const packed = (x: readonly Float32Array[]): string =>
  toBase64(Float32Array.from([...x[0]!, ...x[1]!]));

/** Renders the plan on `o.tier` and resolves to the result; a failure is its `failed`. */
export async function renderTier(
  o: Options,
  progress: (line: string) => void = () => {},
): Promise<Result> {
  let dev;
  try {
    dev = await createDevice({ prefer: tiersOf(o.tier) });
  } catch (e) {
    return { tier: o.tier, requested: o.tier, failed: `createDevice: ${String(e)}` };
  }
  try {
    const start = performance.now();
    const r = await renderPlan(dev, plan, o.blocks > 0 ? { blocks: o.blocks } : {});
    const hostMs = performance.now() - start;
    const timing = timingOf(r.blockMs, BLOCK_BUDGET_MS);
    progress(
      `${o.tier}: ${timing.blocks} blocks, median ${timing.ms.median.toFixed(2)} ms, ${timing.realTime.toFixed(3)}x real time, ${(hostMs / 1000).toFixed(1)} s`,
    );
    const last = r.reports[r.reports.length - 1]!;
    return {
      tier: r.tier,
      requested: o.tier,
      info: dev.info,
      frames: r.frames,
      sampleRate: r.sampleRate,
      timing,
      hostMs,
      reverbPrepareMs: r.reverbPrepareMs,
      master: r.master,
      placed: r.placed,
      groups: last.groups.map((g) => ({
        calls: g.calls.join('+'),
        tier: g.tier,
        ...(g.why === undefined ? {} : { why: g.why }),
      })),
      mix: packed(r.mix),
      ...(o.stems
        ? {
            wet: packed(r.wet),
            layers: Object.fromEntries(LAYERS.map((l) => [l, packed(r.stems[l])])),
          }
        : {}),
    };
  } catch (e) {
    return { tier: dev.tier, requested: o.tier, info: dev.info, failed: String(e) };
  } finally {
    await dev.dispose();
  }
}
