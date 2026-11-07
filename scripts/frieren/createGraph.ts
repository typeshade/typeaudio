import type { SoundGraph, GraphNode } from '../../src/graph/types.ts';
import type { Layer } from './types.ts';

/** Build the portable graph used for each procedural source. */
export function createGraph(layer: Layer, code: string): SoundGraph {
  const node = (id: string, kind: GraphNode['kind'], values: number[], inputs: Record<string, string>, body = ''): GraphNode =>
    ({ id, kind, name: id, x: 0, y: 0, values, inputs, code: body, bypass: false });
  return {
    version: 1,
    parameters: [
      { name: 'Pitch', min: 20, max: 8000, value: layer.pitch },
      { name: 'Decay', min: 0.001, max: 30, value: layer.decay },
      { name: 'Duration', min: 0.01, max: 30, value: layer.duration },
      { name: 'Character', min: 0, max: 1, value: layer.character },
    ],
    nodes: [node('excitation', 'noise', [layer.seed], {}),
      node(layer.family, 'code', [], { input: 'excitation' }, code),
      node('output', 'output', [], { input: layer.family })],
  };
}
