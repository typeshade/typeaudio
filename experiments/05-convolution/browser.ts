// Experiment 5 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runConvolution` with the tier. Each stage is logged as it is done.
//
// On WebGPU the page also makes a device of the default adapter with no feature requested, so no
// `timestamp-query`: a plan on a device with the feature reads its timestamps back before it
// resolves (compiler issue #986), and the time per block on the bare device has no such read.

import { createDevice } from 'typeshade/runtime';
import { runTier, type BareDevice, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runConvolution: (options: Options) => Promise<unknown>;
}

/** A WebGPU device of the default adapter, requested with no feature: no `timestamp-query`. */
const bareDevice: BareDevice = async () => {
  type Gpu = { requestAdapter(): Promise<{ requestDevice(): Promise<{ destroy(): void }> } | null> };
  const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
  const adapter = await gpu?.requestAdapter();
  if (adapter === undefined || adapter === null) throw new Error('browser.ts: there is no WebGPU adapter.');
  const device = await adapter.requestDevice();
  const dev = await createDevice({ device, poolBytes: 0 });
  return { dev, release: () => device.destroy() };
};

globalThis.runConvolution = async (options) => {
  const result = await runTier(options, (line) => console.log(line), options.tier === 'webgpu' ? bareDevice : undefined);
  return { environment: { userAgent: navigator.userAgent, crossOriginIsolated: globalThis.crossOriginIsolated }, ...result };
};
