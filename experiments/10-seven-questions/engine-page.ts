// Renders plans of the engine on WebGPU, in a page: `store.ts` bundles this file, opens it in
// headless Chromium (SwiftShader) and calls `renderPlans`. One device renders every plan. Each
// render comes back as its two parts: the sound without the room (`dry`) and the room (`wet`).

import { createDevice } from 'typeshade/runtime';
import { renderPlan } from '../../src/render-plan.ts';
import { toBase64 } from '../03-fft/signals.ts';

declare global {
  // eslint-disable-next-line no-var
  var renderPlans: (
    plans: unknown[],
  ) => Promise<{ dry: string; wet: string; ms: number; normalizeDb: number }[]>;
}

globalThis.renderPlans = async (plans) => {
  const dev = await createDevice({ prefer: ['webgpu'] });
  try {
    const out: { dry: string; wet: string; ms: number; normalizeDb: number }[] = [];
    for (const plan of plans) {
      const start = performance.now();
      const r = await renderPlan(dev, plan);
      out.push({
        dry: toBase64(Float32Array.from([...r.dry[0]!, ...r.dry[1]!])),
        wet: toBase64(Float32Array.from([...r.wet[0]!, ...r.wet[1]!])),
        ms: performance.now() - start,
        normalizeDb: r.master.normalizeDb,
      });
    }
    return out;
  } finally {
    await dev.dispose();
  }
};
