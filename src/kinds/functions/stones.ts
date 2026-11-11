// The unit of the kinds `crack` and `rubble` as typed function definitions, written from
// `src/kinds/stones.shade.ts`: stone heard as impacts at random frames, each raising five bands of
// noise by the share of its sound in each band. A function has one output, and the impacts have a
// level and a size, so the clock is placed twice: `stoneClock` with `part` 0 gives the level, with
// `part` 1 the size; both are drawn from the key and the frame alone, so they agree. Five
// `stoneBand` nodes take them, and `stoneMix` sums the bands. `test/kinds-functions.test.ts` holds
// the whole to the kind's reference.

import type { FunctionDefinition, PortMetadata } from '../../function-graph/types.ts';

/** The module path of the stones inside a document. */
export const STONES_MODULE = '/kinds/stones.shade.ts';

/** The clock, the band and the mix. A band's noise key is the stones' key xor 101 to 105. */
export const STONES_SOURCE = `"use typeshade";
import { noise, hash32, uniform } from "./noise.shade.ts";
export class ClockState { age: u32 = 0; }
export function createClock(): ClockState { return new ClockState(); }
export function stoneClock(
  state: inout<ClockState>,
  part: u32,
  key: u32,
  len: f32,
  rateA: f32,
  rateB: f32,
  rateC: f32,
  sizeLo: f32,
  sizeLog: f32,
  grow0: f32,
  grow1: f32,
  first: f32,
  firstSize: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const u: f32 = min(f32(age) / len, 1);
  let amp: f32 = 0;
  let size: f32 = firstSize;
  if (age == 0) {
    amp = first;
  } else if (u < 1) {
    const v: f32 = 1 - u;
    const rate: f32 = rateA + rateB * u * sqrt(u) + rateC * v * v * v;
    const word: u32 = hash32(key ^ hash32(age));
    if (uniform(word) < rate) {
      size = sizeLo * exp(uniform(hash32(word ^ 1)) * sizeLog) * (grow0 + grow1 * u);
      amp = size * sqrt(size) * (0.5 + 0.5 * uniform(hash32(word ^ 2)));
    }
  }
  return select(amp, size, part == 1);
}
export class BandState {
  age: u32 = 0;
  low1: f32 = 0;
  band1: f32 = 0;
  low2: f32 = 0;
  band2: f32 = 0;
  env: f32 = 0;
}
export function createBand(): BandState { return new BandState(); }
export function stoneBand(
  state: inout<BandState>,
  amp: f32,
  size: f32,
  key: u32,
  coef: f32,
  damp: f32,
  keep: f32,
  ratio: f32,
  edge: f32,
  gain: f32,
  bright: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  if (amp > 0) {
    const r: f32 = ratio * size;
    const p: f32 = r / 1.15;
    const k: f32 = (2 * p) / (1 + p * p);
    const knock: f32 = 1.2 * (k * k);
    const q: f32 = sqrt(r);
    const r2: f32 = r * r;
    const body: f32 = min(r2 * r2, 1) / sqrt(q);
    state.env = state.env + amp * (knock + body + edge * bright);
  }
  state.low1 = state.low1 + coef * state.band1;
  const high1: f32 = noise(key, age) - state.low1 - damp * state.band1;
  state.band1 = state.band1 + coef * high1;
  state.low2 = state.low2 + coef * state.band2;
  const high2: f32 = state.band1 - state.low2 - damp * state.band2;
  state.band2 = state.band2 + coef * high2;
  const y: f32 = state.band2 * state.env * gain;
  state.env = state.env * keep;
  return y;
}
export function stoneMix(b0: f32, b1: f32, b2: f32, b3: f32, b4: f32): f32 {
  return b0 + b1 + b2 + b3 + b4;
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

/** The impact clock: `part` 0 gives each impact's level, 1 its size in metres. */
export const STONE_CLOCK_DEFINITION: FunctionDefinition = {
  id: 'stoneClock',
  version: 1,
  module: STONES_MODULE,
  export: 'stoneClock',
  inputs: {
    part: control('part', 'index'),
    key: control('key', 'seed'),
    len: control('len', 'frames'),
    rateA: control('rateA', 'per frame'),
    rateB: control('rateB', 'per frame'),
    rateC: control('rateC', 'per frame'),
    sizeLo: control('sizeLo', 'metres'),
    sizeLog: control('sizeLog', 'log ratio'),
    grow0: control('grow0', 'ratio'),
    grow1: control('grow1', 'ratio'),
    first: control('first', 'linear-gain'),
    firstSize: control('firstSize', 'metres'),
  },
  output: { id: 'out', role: 'control', rate: 'sample' },
  state: { parameter: 'state', initializer: 'createClock', version: 1 },
};

/** One band of the stones. */
export const STONE_BAND_DEFINITION: FunctionDefinition = {
  id: 'stoneBand',
  version: 1,
  module: STONES_MODULE,
  export: 'stoneBand',
  inputs: {
    amp: { id: 'amp', role: 'control', rate: 'sample' },
    size: { id: 'size', role: 'control', rate: 'sample' },
    key: control('key', 'seed'),
    coef: control('coef', 'ratio'),
    damp: control('damp', 'ratio'),
    keep: control('keep', 'per frame'),
    ratio: control('ratio', 'per metre'),
    edge: control('edge', 'ratio'),
    gain: control('gain', 'linear-gain'),
    bright: control('bright', 'linear-gain'),
  },
  output: audio('out'),
  state: { parameter: 'state', initializer: 'createBand', version: 1 },
};

/** The five bands summed. */
export const STONE_MIX_DEFINITION: FunctionDefinition = {
  id: 'stoneMix',
  version: 1,
  module: STONES_MODULE,
  export: 'stoneMix',
  inputs: { b0: audio('b0'), b1: audio('b1'), b2: audio('b2'), b3: audio('b3'), b4: audio('b4') },
  output: audio('out'),
};
