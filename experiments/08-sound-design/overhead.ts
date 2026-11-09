// The three forms of the `cues` kernel on one tier (docs/lanes.md, "Step 1b: the overhead"): the
// kernel of `experiments/08-sound-design/cue.shade.ts`, the hoisted, wide and narrow forms of `overhead.shade.ts`.
// Each form runs 1 lane and 9 lanes of the fixture's first `whoosh`, under other ids, for 40 blocks
// after 3 blocks of warm-up. A row holds the mean GPU time of the call's group where the device
// measured one (WebGPU) and the median host time of the block's `fuse` scope.

import { createDevice, type Device } from 'typeshade/runtime';
import { bank } from '../../src/bank.ts';
import { Cue, cues } from './cue.shade.ts';
import { eventKey } from '../../src/kinds/make.ts';
import { makeCue } from './cue.ts';
import { validatePlan } from '../../src/plan/index.ts';
import { BLOCK } from '../../src/spatial/room.ts';
import { SAMPLE_RATE } from '../../src/render-plan.ts';
import plan from './plan.json';
import {
  NarrowCue,
  cuesHoisted,
  cuesInlined,
  cuesNarrow,
  cuesOneBranch,
  cuesWide,
} from './overhead.shade.ts';

export type Form = 'cues' | 'hoisted' | 'wide' | 'oneBranch' | 'inlined' | 'narrow';

export interface OverheadRow {
  readonly form: Form;
  readonly lanes: number;
  /** The mean GPU time of the call, in milliseconds; absent where the tier measures none. */
  readonly gpuMs?: number;
  /** The median host time of the block's `fuse` scope, in milliseconds. */
  readonly hostMs: number;
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

async function measure(
  dev: Device,
  form: Form,
  lanes: number,
  blocks: number,
): Promise<OverheadRow> {
  const sound = validatePlan(plan);
  const first = sound.events.find((e) => e.kind === 'whoosh')!;
  const made = Array.from({ length: lanes }, (_, i) => {
    const e = { ...first, id: `${first.id}-${i}` };
    const m = makeCue(e, { sr: SAMPLE_RATE, key: eventKey(sound.seed, e.id) });
    m.cue.start = 0;
    m.cue.end = m.length;
    return m;
  });
  const out = dev.array(lanes * BLOCK, 'f32');
  const inputs = dev.array(lanes * BLOCK, 'f32');
  const cueBank = bank<Cue>(
    dev,
    made.map((m) => m.cue),
  );
  const narrowBank = bank<NarrowCue>(
    dev,
    made.map((m) => {
      const n = new NarrowCue();
      n.start = m.cue.start;
      n.end = m.cue.end;
      n.whoosh = m.cue.whoosh;
      return n;
    }),
  );
  const call = (): void => {
    if (form === 'cues') cues(out, cueBank.instances, inputs, BLOCK);
    else if (form === 'hoisted') cuesHoisted(out, cueBank.instances, inputs, BLOCK);
    else if (form === 'inlined') cuesInlined(out, cueBank.instances, inputs, BLOCK);
    else if (form === 'oneBranch') cuesOneBranch(out, cueBank.instances, BLOCK);
    else if (form === 'wide') cuesWide(out, cueBank.instances, BLOCK);
    else cuesNarrow(out, narrowBank.instances, BLOCK);
  };
  const gpu: number[] = [];
  const host: number[] = [];
  try {
    for (let b = 0; b < 3 + blocks; b++) {
      const t0 = performance.now();
      const report = await dev.fuse(call);
      await out.read();
      const ms = performance.now() - t0;
      if (b >= 3) {
        host.push(ms);
        const g = report.groups[0]?.gpuTime;
        if (g !== undefined) gpu.push(g / 1e6);
      }
    }
  } finally {
    dev.release(out);
    dev.release(inputs);
  }
  host.sort((a, b) => a - b);
  return {
    form,
    lanes,
    ...(gpu.length > 0 ? { gpuMs: mean(gpu) } : {}),
    hostMs: host[Math.floor(host.length / 2)]!,
  };
}

/** Runs the three forms, 1 lane and 9 lanes each, on `tier`. */
export async function runOverhead(tier: 'webgpu' | 'cpu', blocks: number): Promise<OverheadRow[]> {
  const dev = await createDevice({ prefer: [tier] });
  const rows: OverheadRow[] = [];
  for (const form of ['cues', 'hoisted', 'wide', 'oneBranch', 'inlined', 'narrow'] as const)
    for (const lanes of [1, 9]) rows.push(await measure(dev, form, lanes, blocks));
  return rows;
}
