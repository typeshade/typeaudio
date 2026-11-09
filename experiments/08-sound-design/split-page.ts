// The split of the `cues` time by kind (docs/lanes.md, section 6, step 1): `run-split.ts` bundles this
// file and opens it in headless Chromium. For each kind it renders the fixture's first event of that
// kind, once as 1 lane and once as 9 lanes (the same event under nine ids, all at frame 0), and the
// whole fixture at frame 0 as 25 lanes. It reports the mean GPU time of the group that holds `cues`.

import { createDevice } from 'typeshade/runtime';
import { renderPlan, SAMPLE_RATE } from '../../src/render-plan.ts';
import { validatePlan, type PlanEvent } from '../../src/plan/index.ts';
import plan from './plan.json';
import { stemsOf } from './stems.ts';

export interface SplitRow {
  readonly kind: string;
  readonly lanes: number;
  /** The mean GPU time of the `cues` group over the timed blocks, in milliseconds. */
  readonly cuesMs: number;
  /** The median host time of a block, in milliseconds. */
  readonly blockMs: number;
}

const KINDS = [
  'whoosh',
  'impact',
  'shimmer',
  'riser',
  'wind',
  'drone',
  'footstep',
  'cloth',
  'voice',
] as const;

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

globalThis.runSplit = async (blocks: number): Promise<SplitRow[]> => {
  const sound = validatePlan(plan);
  const stems = stemsOf(sound, SAMPLE_RATE);
  const dev = await createDevice({ prefer: ['webgpu'] });
  const rows: SplitRow[] = [];
  const at0 = (e: PlanEvent): PlanEvent => ({ ...e, t: 0, sync: 'onset' });
  const cases: { kind: string; events: PlanEvent[] }[] = [
    { kind: 'all', events: sound.events.map(at0) },
  ];
  for (const kind of KINDS) {
    const first = sound.events.find((e) => e.kind === kind)!;
    for (const copies of [1, 9]) {
      cases.push({
        kind,
        events: Array.from({ length: copies }, (_, i) => at0({ ...first, id: `${first.id}-${i}` })),
      });
    }
  }
  for (const c of cases) {
    const p = { ...sound, events: c.events };
    // A short render first, so that the pipelines are built before the timed one.
    await renderPlan(dev, p, { stems, blocks: 3, guards: false });
    const r = await renderPlan(dev, p, { stems, blocks, guards: false });
    const cues = r.reports.map((rep) => {
      const g = rep.groups.find((x) => x.calls.includes('cues'));
      return (g?.gpuTime ?? NaN) / 1e6;
    });
    const ms = [...r.blockMs].sort((a, b) => a - b);
    rows.push({
      kind: c.kind,
      lanes: c.events.length,
      cuesMs: mean(cues),
      blockMs: ms[Math.floor(ms.length / 2)]!,
    });
  }
  return rows;
};

declare global {
  // eslint-disable-next-line no-var
  var runSplit: (blocks: number) => Promise<SplitRow[]>;
}
