// The browser check's page: the same plan rendered on WebGPU and on the CPU tier, in one page.
// `run.ts` opens it in headless Chromium and holds the two renders, the two banks and the WebGPU
// fuse report to what they should be.

import { createDevice, type FuseReport } from 'typeshade/runtime';
import { bank, explain, plan, render, Voice } from '../../src/index.ts';

export interface Side {
  readonly tier: string;
  readonly out: number[];
  readonly state: number[];
  readonly peak: number;
  readonly reports: readonly FuseReport[];
  readonly explain: string;
}

declare global {
  // eslint-disable-next-line no-var
  var renderBoth: (voices: number, frames: number, block: number) => Promise<Side[]>;
}

const SR = 48000;

globalThis.renderBoth = async (voices, frames, block) => {
  const sides: Side[] = [];
  for (const tier of ['webgpu', 'cpu'] as const) {
    const dev = await createDevice({ prefer: [tier] });
    try {
      const instances = Array.from(
        { length: voices },
        (_, v) => new Voice(55 * (1 + v / 4), 600 + 90 * v, 0.6 + (v % 5) * 0.2, SR),
      );
      const voicesBank = bank(dev, instances);
      // A gentle drive, so that tanh works in its curved region and not at its ceiling.
      const p = plan(voicesBank, { drive: 2 / voices, gain: 0.8 });
      const first = await render(p, { frames, block });
      const second = await render(p, { frames, block });
      const state = (await voicesBank.read()).flatMap((v) => [
        v.osc.phase,
        v.filter.z1,
        v.filter.z2,
      ]);
      sides.push({
        tier: dev.tier,
        out: [...first, ...second],
        state,
        peak: p.peak,
        reports: p.reports,
        explain: explain(p.reports),
      });
    } finally {
      await dev.dispose();
    }
  }
  return sides;
};
