// Experiment 1 on WebGPU, in a page: `run.ts` bundles this file, opens it in headless Chromium and
// calls `runExperiment`. Each row is logged as it is done.

import { clockStep } from './clock.ts';
import { measure, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runExperiment: (options: Options) => Promise<unknown>;
}

globalThis.runExperiment = async (options) => {
  const result = await measure({ ...options, tier: 'webgpu' }, (row) => {
    console.log(`webgpu ${row.variant} ${row.frames}: median ${row.medianMs.toFixed(3)} ms`);
  });
  return {
    environment: {
      userAgent: navigator.userAgent,
      crossOriginIsolated: globalThis.crossOriginIsolated,
      clockStepMs: clockStep(),
    },
    ...result,
  };
};
