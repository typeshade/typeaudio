// Experiment 4 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runAdditive` with the tier. It returns every block and the bank as base64,
// for the runner to hold to the reference. Progress is logged ten times a variant.

import { clockStep } from '../01-round-trip/clock.ts';
import { toBase64 } from './compare.ts';
import { measure, sumCheck, tierProbe } from './harness.ts';
import type { Options } from './options.ts';

declare global {
  // eslint-disable-next-line no-var
  var runAdditive: (options: Options) => Promise<unknown>;
}

globalThis.runAdditive = async (options) => {
  const total = options.warmup + options.blocks;
  const every = Math.max(1, Math.round(total / 10));
  const result = await measure(options, (variant, b, ms) => {
    if (b % every === 0 || b === total - 1) console.log(`${options.tier} ${variant} block ${b}: ${ms.toFixed(1)} ms`);
  });
  const variants: Record<string, unknown> = {};
  for (const [variant, r] of Object.entries(result.results)) {
    variants[variant] = { row: r.row, report: r.report, out: toBase64(r.out), state: toBase64(r.state), peaks: r.peaks };
  }
  for (const [variant, error] of Object.entries(result.errors)) variants[variant] = { error };
  let sums: unknown;
  let tiers: Record<string, string> | undefined;
  if (options.sums) {
    const got = await sumCheck(options);
    sums = { gather: toBase64(got.gather), tree: toBase64(got.tree), scatter: toBase64(got.scatter), reports: got.reports };
    tiers = await tierProbe(options);
  }
  return {
    environment: {
      userAgent: navigator.userAgent,
      crossOriginIsolated: globalThis.crossOriginIsolated,
      clockStepMs: clockStep(),
    },
    info: result.info,
    skipped: result.skipped,
    variants,
    ...(sums === undefined ? {} : { sums }),
    ...(tiers === undefined ? {} : { tiers }),
  };
};
