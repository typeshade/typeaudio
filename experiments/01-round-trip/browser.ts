// Experiment 1 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runExperiment` with the tier. Each row is logged as it is done.

import { clockStep } from './clock.ts';
import { measure, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runExperiment: (options: Options) => Promise<unknown>;
}

globalThis.runExperiment = async (options) => {
  const result = await measure(options, (row) => {
    console.log(`${options.tier} ${row.variant} ${row.frames}: median ${row.medianMs.toFixed(3)} ms`);
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
