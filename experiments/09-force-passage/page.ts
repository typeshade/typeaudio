// Experiment 9 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `renderForce` with the tier.

import { renderTier, type Options } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var renderForce: (options: Options) => Promise<unknown>;
}

globalThis.renderForce = async (options) => ({
  environment: {
    userAgent: navigator.userAgent,
    crossOriginIsolated: globalThis.crossOriginIsolated,
  },
  ...(await renderTier(options, (line) => console.log(line))),
});
