// Renders plans of the engine on WebGPU, in a page: `store.ts` bundles this file, opens it in
// headless Chromium (SwiftShader) and calls `renderPlans`. One device renders every plan.

import { createDevice } from 'typeshade/runtime';
import { renderPlan } from '../../src/render-plan.ts';
import { toBase64 } from '../03-fft/signals.ts';

declare global {
  // eslint-disable-next-line no-var
  var renderPlans: (plans: unknown[]) => Promise<{ mix: string; ms: number }[]>;
}

globalThis.renderPlans = async (plans) => {
  const dev = await createDevice({ prefer: ['webgpu'] });
  try {
    const out: { mix: string; ms: number }[] = [];
    for (const plan of plans) {
      const start = performance.now();
      const r = await renderPlan(dev, plan);
      out.push({
        mix: toBase64(Float32Array.from([...r.mix[0]!, ...r.mix[1]!])),
        ms: performance.now() - start,
      });
    }
    return out;
  } finally {
    await dev.dispose();
  }
};
