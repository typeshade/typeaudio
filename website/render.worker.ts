import { createDevice } from 'typeshade/runtime';
import { explain } from '../src/explain.ts';
import { renderPatch } from './designer-render.ts';
import { finishPcm, validatePatch, type RenderRequest } from './designer.ts';
self.onmessage = async ({ data }: MessageEvent<RenderRequest>) => {
  const started = performance.now();
  try {
    const patch = validatePatch(data.patch);
    if (!['cpu','webgpu'].includes(data.backend)) throw new Error('Select CPU or WebGPU.');
    const dev = await createDevice({ prefer: [data.backend] });
    try {
      if (dev.tier !== data.backend) throw new Error(`Requested ${data.backend}, but selected ${dev.tier}. Select CPU explicitly to use it.`);
      const result = await renderPatch(dev, patch);
      const { dry, wet } = finishPcm(result.samples, patch);
      if (!wet.every(Number.isFinite) || !dry.every(Number.isFinite)) throw new Error('Non-finite audio output. Reset the patch and retry.');
      const peak = wet.reduce((m, value) => Math.max(m, Math.abs(value)), 0);
      const effects = [patch.delay ? 'feedback delay' : '', patch.reverb ? 'Schroeder reverb' : ''].filter(Boolean);
      const report = explain(result.reports) + '\n\n' + (effects.length ? `CPU post-processing: ${effects.join(' → ')}. Effect tails are bounded and faded.` : 'Delay and reverb bypassed.') + '\nOutput gain and WAV export run on the CPU.';
      self.postMessage({ dry, wet, tier: dev.tier, peak, milliseconds: performance.now() - started, report }, { transfer: [dry.buffer,wet.buffer] });
    } finally { await dev.dispose(); }
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
