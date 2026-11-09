// The page entry of `run-overhead.ts`: the three forms on WebGPU.

import { runOverhead, type OverheadRow } from './overhead.ts';

declare global {
  // eslint-disable-next-line no-var
  var runOverheadPage: (blocks: number) => Promise<OverheadRow[]>;
}

globalThis.runOverheadPage = (blocks) => runOverhead('webgpu', blocks);
