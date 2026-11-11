// The kind `roar` as typed function definitions: a blast that rolls through a hall, written from
// `src/kinds/roar.shade.ts`. A definition takes at most 16 inputs, and the roar has 26, so it is two
// definitions: `roarBand` (noise through two bandpasses at a level that wanders), placed four times,
// and `roarMix` (the four bands summed under the rise, the swell, the hold and the fall). In the
// editor each band is a node of its own. `test/kinds-functions.test.ts` holds the four bands and the
// mix to the kind's reference.

import type { FunctionDefinition, PortMetadata } from '../../function-graph/types.ts';

/** The module path of `roar` inside a document. */
export const ROAR_MODULE = '/kinds/roar.shade.ts';

/** The two definitions of `roar`. A band's key is the roar's key xor 201 to 204, as the kind has it. */
export const ROAR_SOURCE = `"use typeshade";
import { noise, smooth } from "./noise.shade.ts";
export class BandState {
  age: u32 = 0;
  low1: f32 = 0;
  band1: f32 = 0;
  low2: f32 = 0;
  band2: f32 = 0;
}
export function createBand(): BandState { return new BandState(); }
export function roarBand(
  state: inout<BandState>,
  key: u32,
  coef: f32,
  damp: f32,
  gain: f32,
  depth: f32,
  rate: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  const walk: f32 = exp(depth * smooth(key ^ 977, a * rate));
  state.low1 = state.low1 + coef * state.band1;
  const high1: f32 = noise(key, age) - state.low1 - damp * state.band1;
  state.band1 = state.band1 + coef * high1;
  state.low2 = state.low2 + coef * state.band2;
  const high2: f32 = state.band1 - state.low2 - damp * state.band2;
  state.band2 = state.band2 + coef * high2;
  return state.band2 * gain * walk;
}
export class MixState { age: u32 = 0; }
export function createMix(): MixState { return new MixState(); }
export function roarMix(
  state: inout<MixState>,
  b0: f32,
  b1: f32,
  b2: f32,
  b3: f32,
  len: f32,
  att: f32,
  low: f32,
  hold: f32,
  gain: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  const u: f32 = min(a / len, 1);
  const swell: f32 = low + (1 - low) * min(u / hold, 1);
  const t: f32 = max((1 - u) / (1 - hold), 0);
  const tail: f32 = min(t * t, 1);
  const env: f32 = min(a / att, 1) * swell * tail;
  return (b0 + b1 + b2 + b3) * env * gain;
}
`;

const control = (id: string, unit: string): PortMetadata => ({
  id,
  role: 'control',
  rate: 'block',
  unit,
});
const audio = (id: string): PortMetadata => ({
  id,
  role: 'audio',
  rate: 'sample',
  unit: 'amplitude',
});

/** One band of the roar. */
export const ROAR_BAND_DEFINITION: FunctionDefinition = {
  id: 'roarBand',
  version: 1,
  module: ROAR_MODULE,
  export: 'roarBand',
  inputs: {
    key: control('key', 'seed'),
    coef: control('coef', 'ratio'),
    damp: control('damp', 'ratio'),
    gain: control('gain', 'linear-gain'),
    depth: control('depth', 'log gain'),
    rate: control('rate', 'steps per frame'),
  },
  output: audio('out'),
  state: { parameter: 'state', initializer: 'createBand', version: 1 },
};

/** The four bands summed under the roar's envelope. */
export const ROAR_MIX_DEFINITION: FunctionDefinition = {
  id: 'roarMix',
  version: 1,
  module: ROAR_MODULE,
  export: 'roarMix',
  inputs: {
    b0: audio('b0'),
    b1: audio('b1'),
    b2: audio('b2'),
    b3: audio('b3'),
    len: control('len', 'frames'),
    att: control('att', 'frames'),
    low: control('low', 'ratio'),
    hold: control('hold', 'ratio'),
    gain: control('gain', 'linear-gain'),
  },
  output: audio('out'),
  state: { parameter: 'state', initializer: 'createMix', version: 1 },
};
