// The scene study, in a worker: renders the accepted force passage of experiment 10 on the
// viewer's own device. Each store entry the composition needs is rendered by the engine on
// WebGPU, then `compose` lays the accepted sounds on the bed, as `compose-run.ts` does in Node.

import { createDevice, type Device } from 'typeshade/runtime';
import { renderPlan } from '../src/render-plan.ts';
import {
  compose,
  withVariant,
  type Composition,
  type Variant,
} from '../experiments/10-seven-questions/compose.ts';
import { planOf } from '../experiments/10-seven-questions/plans.ts';
import type { Parts, StoreEntry } from '../experiments/10-seven-questions/store.ts';
import module from '../experiments/10-seven-questions/module-4.json';

/** The variant of `module-4.json` that the owner accepted on 2026-11-10. */
export const ACCEPTED = 'slow-many-ordered';

const entries = import.meta.glob<StoreEntry>('../experiments/10-seven-questions/store/*.json', {
  eager: true,
  import: 'default',
});
const byName = new Map(Object.values(entries).map((e) => [e.name, e]));
const read = (name: string): StoreEntry => {
  const entry = byName.get(name);
  if (!entry) throw new Error(`no store entry "${name}"`);
  return entry;
};

export interface StudyResult {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly tier: string;
  /** Each engine render: the entry, its seconds of sound, and the milliseconds it took. */
  readonly renders: { name: string; seconds: number; ms: number }[];
  readonly composeMs: number;
  readonly totalMs: number;
}

self.onmessage = async () => {
  const started = performance.now();
  let dev: Device | undefined;
  try {
    dev = await createDevice({ prefer: ['webgpu'] });
    if (dev.tier !== 'webgpu')
      throw new Error(`WebGPU is required; the device selected ${dev.tier}.`);
    const renders: StudyResult['renders'] = [];
    const kept = new Map<string, Promise<Parts>>();
    const parts = (name: string): Promise<Parts> => {
      let p = kept.get(name);
      if (!p) {
        p = (async () => {
          const t = performance.now();
          const r = await renderPlan(dev!, planOf(read(name), read));
          renders.push({ name, seconds: r.frames / r.sampleRate, ms: performance.now() - t });
          self.postMessage({ progress: `Rendered ${name} on the engine.` });
          return { dry: r.dry, wet: r.wet, normalizeDb: r.master.normalizeDb };
        })();
        kept.set(name, p);
      }
      return p;
    };
    const c = module as unknown as Composition & { variants: Record<string, Variant> };
    const t = performance.now();
    const before = renders.length;
    const [left, right] = await compose(withVariant(c, c.variants[ACCEPTED]!), { read, parts });
    const renderMs = renders.slice(before).reduce((sum, r) => sum + r.ms, 0);
    const result: StudyResult = {
      left,
      right,
      tier: dev.tier,
      renders,
      composeMs: performance.now() - t - renderMs,
      totalMs: performance.now() - started,
    };
    self.postMessage(result, { transfer: [left.buffer, right.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    await dev?.dispose();
  }
};
