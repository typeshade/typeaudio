// Experiment 3 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runFft` with the tier. Each call is logged as it is done.

import { runTier, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runFft: (options: Options) => Promise<unknown>;
}

globalThis.runFft = async (options) => {
  const result = await runTier(options, (line) => console.log(line));
  return { environment: { userAgent: navigator.userAgent }, ...result };
};
