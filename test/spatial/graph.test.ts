import { expect, it } from 'vitest';
import tone from '../../fixtures/feedback/tone.json';
import { compileGraph } from '../../src/graph/compiler/index.ts';
import { GraphDsp } from '../../src/graph/runtime.ts';
import { validateReproduction } from '../../src/feedback/index.ts';
import { prepareSpatialSource, SpatialMixer } from '../../src/spatial/index.ts';

it('routes compiled GraphDsp output through the spatial bus without changing source state', () => {
  const { graph } = validateReproduction(tone);
  const program = compileGraph(graph); new Function(program.code)();
  const a = new GraphDsp({ graph, volume: 0.4 }), b = new GraphDsp({ graph, volume: 0.4 });
  const mixer = new SpatialMixer({ capacity: 1 });
  mixer.setSource(0, prepareSpatialSource({ position: { x: 0, y: 0, z: 0 } }, { position: { x: 1, y: 0, z: 0 } }));
  const mono = new Float32Array(128), reference = mono.slice(), left = mono.slice(), right = mono.slice();
  const inputs = [mono]; let rightEnergy = 0, leftEnergy = 0;
  for (let i = 0; i < 100; i++) {
    a.process(mono); b.process(reference); mixer.process(inputs, left, right);
    expect(mono).toEqual(reference);
    for (let n = 0; n < 128; n++) { rightEnergy += right[n] ** 2; leftEnergy += left[n] ** 2; }
  }
  expect(rightEnergy).toBeGreaterThan(1);
  expect(leftEnergy).toBeLessThan(1e-20);
  expect(mixer.invalidSamples).toBe(0);
  expect(mixer.invalidOutputSamples).toBe(0);
});
