// A worker of `build.ts`, `renderMaster`: the true peak of one channel (`truePeakDb`).

import { truePeakDb } from './dsp.ts';

declare const self: Worker;

self.onmessage = (e: MessageEvent) => {
  self.postMessage(truePeakDb([e.data as Float64Array]));
};
