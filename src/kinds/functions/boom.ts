// The kind `boom` as a typed function definition: the body of a heavy hit, written from
// `src/kinds/boom.shade.ts` as one TypeShade function with flat state. A band of noise around the
// pitch (two state-variable filters in series) and two damped modes that sink a little, under a fast
// rise and a long decay. `test/kinds-functions.test.ts` holds it to the kind's reference.

import type { FunctionDefinition, PortMetadata } from '../../function-graph/types.ts';

/** The module path of `boom` inside a document. */
export const BOOM_MODULE = '/kinds/boom.shade.ts';

/** The kind `boom`, one sample a call. Its shape arrives as inputs, as `Boom.shape` takes it. */
export const BOOM_SOURCE = `"use typeshade";
import { noise } from "./noise.shade.ts";
const TAU: f32 = 6.283185307179586;
export class BoomState {
  age: u32 = 0;
  low1: f32 = 0;
  band1: f32 = 0;
  low2: f32 = 0;
  band2: f32 = 0;
  phase0: f32 = 0;
  phase1: f32 = 0;
}
export function createBoom(): BoomState { return new BoomState(); }
export function boom(
  state: inout<BoomState>,
  key: u32,
  coef: f32,
  damp: f32,
  base: f32,
  glide: f32,
  glideRate: f32,
  decay: f32,
  rise: f32,
  aNoise: f32,
  aTone: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  state.low1 = state.low1 + coef * state.band1;
  const high1: f32 = noise(key, age) - state.low1 - damp * state.band1;
  state.band1 = state.band1 + coef * high1;
  state.low2 = state.low2 + coef * state.band2;
  const high2: f32 = state.band1 - state.low2 - damp * state.band2;
  state.band2 = state.band2 + coef * high2;
  const g: f32 = 1 - glide * (1 - exp(-a * glideRate));
  const t0: f32 = sin(state.phase0 * TAU);
  state.phase0 = fract(state.phase0 + base * g);
  const t1: f32 = sin(state.phase1 * TAU);
  state.phase1 = fract(state.phase1 + base * 0.72 * g);
  const tone: f32 = t0 + 0.7 * t1;
  const r: f32 = min(a / rise, 1);
  const env: f32 = exp(-a * decay) * (r * r * (3 - 2 * r));
  return (state.band2 * aNoise + tone * aTone) * env;
}
`;

const control = (id: string, unit: string): PortMetadata => ({
  id,
  role: 'control',
  rate: 'block',
  unit,
});

/** The definition of `boom`, with its shape as named controls. */
export const BOOM_DEFINITION: FunctionDefinition = {
  id: 'boom',
  version: 1,
  module: BOOM_MODULE,
  export: 'boom',
  inputs: {
    key: control('key', 'seed'),
    coef: control('coef', 'ratio'),
    damp: control('damp', 'ratio'),
    base: control('base', 'cycles per frame'),
    glide: control('glide', 'ratio'),
    glideRate: control('glideRate', 'per frame'),
    decay: control('decay', 'per frame'),
    rise: control('rise', 'frames'),
    aNoise: control('aNoise', 'linear-gain'),
    aTone: control('aTone', 'linear-gain'),
  },
  output: { id: 'out', role: 'audio', rate: 'sample', unit: 'amplitude' },
  state: { parameter: 'state', initializer: 'createBoom', version: 1 },
};
