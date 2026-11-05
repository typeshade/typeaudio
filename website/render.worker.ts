import { createDevice } from 'typeshade/runtime';
import { bank, Voice, plan, render, explain } from '../src/index.ts';
import { frequencies, type Settings } from './audio.ts';
self.onmessage = async ({ data: settings }: MessageEvent<Settings>) => {
  const started = performance.now();
  try {
    const dev = await createDevice({ prefer: [settings.backend] });
    try {
      if (dev.tier !== settings.backend) throw new Error(`Requested ${settings.backend}, but the device selected ${dev.tier}. Select CPU explicitly to use the reference backend.`);
      const voices = bank(dev, frequencies(settings).map(f => new Voice(f, settings.cutoff, 0.7, 48000)));
      const p = plan(voices, { drive: settings.drive / settings.voices, gain: 0.35 });
      const samples = await render(p, { frames: Math.round(48000 * settings.duration), block: 1024 });
      if (!samples.every(Number.isFinite)) throw new Error('The engine returned non-finite samples. Try a different preset.');
      const result = { samples, tier: dev.tier, peak: p.peak, milliseconds: performance.now() - started, report: explain(p.reports) };
      self.postMessage(result, { transfer: [samples.buffer] });
    } finally { await dev.dispose(); }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
