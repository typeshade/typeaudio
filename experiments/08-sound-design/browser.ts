// Experiment 8 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runSoundDesign` with the tier.

import { runTier, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runSoundDesign: (options: Options) => Promise<unknown>;
}

globalThis.runSoundDesign = async (options) => {
  const result = await runTier(options, (line) => console.log(line));
  return {
    environment: {
      userAgent: navigator.userAgent,
      crossOriginIsolated: globalThis.crossOriginIsolated,
    },
    ...result,
  };
};
