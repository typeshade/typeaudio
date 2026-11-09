// The browser check's second page: the layered render of a short plan on WebGPU and on the CPU tier,
// in one page. It renders an `impact`, a `whoosh` and a `shimmer` through the whole spatial chain,
// the reverb included, with the guards off so that the numbers are the chain's (the master is
// host-side and the same on both). `run.ts` holds the two to each other.

import { createDevice } from 'typeshade/runtime';
import { renderPlan } from '../../src/index.ts';

export interface SpatialSide {
  readonly tier: string;
  readonly effects: [number[], number[]];
  readonly wet: [number[], number[]];
  readonly groups: string[];
  readonly dispatches: number;
  readonly submissions: number;
  readonly blockMs: number[];
}

declare global {
  // eslint-disable-next-line no-var
  var spatialBoth: () => Promise<SpatialSide[]>;
}

const PLAN = {
  version: 1,
  clip: { duration: 1, fps: 24 },
  scene: {
    room: { size: [6, 8, 3], material: 'fabric' },
    listener: { position: [0, 1.6, 0], yaw: 0 },
  },
  master: { lufs: -23, truePeak: -1 },
  seed: 5,
  picture: { cuts: [], motion: [] },
  events: [
    {
      id: 'hit',
      t: 0.05,
      kind: 'impact',
      layer: 'effects',
      intensity: 0.9,
      position: { x: -0.5, y: 0, distance: 6 },
      macros: { weight: 0.6, decay: 0.2, crack: 0.5 },
    },
    {
      id: 'sweep',
      t: 0.15,
      kind: 'whoosh',
      layer: 'effects',
      intensity: 0.7,
      position: { x: 0.6, y: 0, distance: 3 },
      macros: { speed: 0.5, brightness: 0.6 },
      duration: 0.3,
    },
    {
      id: 'chime',
      t: 0.3,
      kind: 'shimmer',
      layer: 'effects',
      intensity: 0.6,
      position: { x: 0, y: 0, distance: 10 },
      macros: { density: 0.5, height: 0.5 },
      duration: 0.25,
    },
  ],
};

globalThis.spatialBoth = async () => {
  const sides: SpatialSide[] = [];
  for (const tier of ['webgpu', 'cpu'] as const) {
    const dev = await createDevice({ prefer: [tier] });
    try {
      const r = await renderPlan(dev, PLAN, { guards: false, binaural: true, blocks: 30 });
      const last = r.reports[r.reports.length - 1]!;
      sides.push({
        tier: r.tier,
        effects: [[...r.stems.effects[0]], [...r.stems.effects[1]]],
        wet: [[...r.wet[0]], [...r.wet[1]]],
        groups: last.groups.map((g) => `${g.calls.join('+')}${g.fused ? ' (fused)' : ''}`),
        dispatches: last.dispatches,
        submissions: last.submissions,
        blockMs: r.blockMs,
      });
    } finally {
      await dev.dispose();
    }
  }
  return sides;
};
