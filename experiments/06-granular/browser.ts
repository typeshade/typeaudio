// Experiment 6 on WebGPU or WebGL2, in a page: `run.ts` bundles this file, opens it in headless
// Chromium and calls `runGranular` with the tier. Each arm is logged as it is done.
//
// The page counts the reads of the device: each `mapAsync` of a WebGPU buffer, and each
// `readPixels` and `getBufferSubData` of a WebGL2 context, whoever makes them. A block that reads
// nothing back counts none.

import { createDevice } from 'typeshade/runtime';
import { clockStep } from '../01-round-trip/clock.ts';
import { measure, type Options, type Probes } from './harness.ts';

declare global {
  // eslint-disable-next-line no-var
  var runGranular: (options: Options) => Promise<unknown>;
}

let reads = 0;
/** Counts each call of `name` on `proto`, then makes it. */
function count(proto: object | undefined, name: string): void {
  if (proto === undefined) return;
  const holder = proto as Record<string, unknown>;
  const original = holder[name];
  if (typeof original !== 'function') return;
  holder[name] = function (this: unknown, ...args: unknown[]): unknown {
    reads++;
    return (original as (...a: unknown[]) => unknown).apply(this, args);
  };
}
const scope = globalThis as unknown as Record<string, { prototype: object } | undefined>;
count(scope['GPUBuffer']?.prototype, 'mapAsync');
count(scope['WebGL2RenderingContext']?.prototype, 'readPixels');
count(scope['WebGL2RenderingContext']?.prototype, 'getBufferSubData');

/** A WebGPU device of the default adapter, requested with no feature: no `timestamp-query`. */
async function bareDevice(): Promise<{ dev: Awaited<ReturnType<typeof createDevice>>; release: () => void }> {
  type Gpu = { requestAdapter(): Promise<{ requestDevice(): Promise<{ destroy(): void }> } | null> };
  const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
  const adapter = await gpu?.requestAdapter();
  if (adapter === undefined || adapter === null) throw new Error('browser.ts: there is no WebGPU adapter.');
  const device = await adapter.requestDevice();
  const dev = await createDevice({ device } as unknown as Parameters<typeof createDevice>[0]);
  return { dev, release: () => device.destroy() };
}

globalThis.runGranular = async (options) => {
  const probes: Probes = {
    deviceReads: () => reads,
    ...(options.tier === 'webgpu' ? { streamDevice: bareDevice } : {}),
  };
  const result = await measure(options, probes, (row) => {
    console.log(
      `${options.tier} ${row.arm}: median ${row.ms.median.toFixed(3)} ms, p99 ${row.ms.p99.toFixed(3)} ms, ${row.alive.median} grains alive, ${row.deviceReads ?? 0} device reads`,
    );
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
