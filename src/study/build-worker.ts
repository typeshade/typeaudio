// A worker of `build.ts`: it collects the scene's parts once, then makes the parts it is sent, one
// at a time, and sends their layers back. Each part runs the same code it runs anywhere else. It
// also reads cache files (`load`), with no scene.

import type { Mix } from './mix.ts';
import { readFileSync } from 'node:fs';
import { collect, decode, encode, pack, unpack, type Collector, type PartLayers } from './build.ts';

declare const self: Worker;

let state: { m: Mix; c: Collector } | null = null;
let packFiles = true;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'init'; entry: string; exportName: string; pack: boolean }
    | { type: 'run'; name: string }
    | { type: 'load'; name: string; path: string };
  try {
    if (msg.type === 'load') {
      const layers = decode(unpack(readFileSync(msg.path)));
      self.postMessage({ type: 'loaded', name: msg.name, layers }, [...buffersOf(layers)]);
      return;
    }
    if (msg.type === 'init') {
      packFiles = msg.pack;
      state = await collect(msg.entry, msg.exportName);
      self.postMessage({ type: 'ready' });
      return;
    }
    const s = performance.now();
    const layers = state!.c.run(state!.m, msg.name);
    const seconds = (performance.now() - s) / 1000;
    const file = packFiles ? pack(encode(layers)) : new Uint8Array(0);
    const buffers = buffersOf(layers);
    buffers.add(file.buffer as ArrayBuffer);
    self.postMessage({ type: 'done', name: msg.name, layers, seconds, file }, [...buffers]);
  } catch (err) {
    self.postMessage({ type: 'error', error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
  }
};

function buffersOf(layers: PartLayers): Set<ArrayBuffer> {
  const out = new Set<ArrayBuffer>();
  for (const [, l] of layers) for (const a of [...l.dry, ...l.wet]) out.add(a.buffer as ArrayBuffer);
  return out;
}
