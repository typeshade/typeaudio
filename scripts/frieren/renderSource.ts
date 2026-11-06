import { compileGraph } from '../../src/graph/compiler/index.ts';
import { GraphDsp } from '../../src/graph/runtime.ts';
import { createGraph } from './createGraph.ts';
import type { Layer } from './types.ts';

const installed = new Set<string>();

/** Offline source generation through the pinned TypeShade compiler and GraphDsp. */
export function renderSource(layer: Layer, code: string) {
  const graph = createGraph(layer, code);
  const program = compileGraph(graph);
  if (!installed.has(program.key)) { new Function(program.code)(); installed.add(program.key); }
  const dsp = new GraphDsp({ graph, volume: 0.7 });
  const pcm = new Float32Array(Math.round(layer.duration * 48000));
  const block = new Float32Array(128);
  let peak = 0;
  for (let offset = 0; offset < pcm.length; offset += block.length) {
    const count = Math.min(block.length, pcm.length - offset);
    dsp.process(block, count);
    for (let i = 0; i < count; i++) {
      peak = Math.max(peak, Math.abs(block[i]));
      // Apply a 5 ms end taper to avoid terminating a stochastic source discontinuously.
      pcm[offset + i] = block[i] * Math.min(1, (pcm.length - 1 - offset - i) / 240);
    }
  }
  if (dsp.invalidSamples || peak >= 0.999 || peak < 1e-8)
    throw new Error('Invalid, clipped or silent source: ' + layer.id);
  return { pcm, graph, source: program.source, peak, key: program.key };
}
