// The kind `impact` as a typed function definition (`docs/function-graphs.md`), so that the site's
// editor can open, edit and render it. The processing is the kind's own (`src/kinds/impact.shade.ts`)
// written as one TypeShade function with flat state: a sub sine whose pitch falls fast, a burst of
// lowpassed noise and a click. The noise is the kinds' hash noise (`src/kinds/noise.shade.ts`); the
// hash is written out here because a function module compiles alone and cannot import `typeshade`.
// `test/kinds-functions.test.ts` holds it to the kind's reference sample for sample.

import type { FunctionDefinition, PortMetadata } from '../../function-graph/types.ts';

/** The module path of the kinds' noise inside a document. */
export const NOISE_MODULE = '/kinds/noise.shade.ts';
/** The module path of `impact` inside a document. */
export const IMPACT_MODULE = '/kinds/impact.shade.ts';

/** The kinds' noise: the hash of `typeshade/random` and the noise of `src/kinds/noise.shade.ts`. */
export const NOISE_SOURCE = `"use typeshade";
function hash32(x: u32): u32 {
  let h: u32 = x ^ (x >> 16);
  h = h * 0x7feb352d;
  h = h ^ (h >> 15);
  h = h * 0x846ca68b;
  h = h ^ (h >> 16);
  return h;
}
function uniform(word: u32): f32 {
  return f32(word >> 8) * (1. / 16777216.);
}
/** A sample of noise in [-1, 1) for the frame \`age\`, from \`key\` only. */
export function noise(key: u32, age: u32): f32 {
  return 2 * uniform(hash32(key ^ hash32(age))) - 1;
}
/** A smooth walk in [-1, 1) from \`key\` only: the noise of the whole frames on both sides of \`x\`, joined by a smoothstep. */
export function smooth(key: u32, x: f32): f32 {
  const i: u32 = u32(x);
  const fr: f32 = x - f32(i);
  const s: f32 = fr * fr * (3 - 2 * fr);
  const n0: f32 = noise(key, i);
  const n1: f32 = noise(key, i + 1);
  return n0 + (n1 - n0) * s;
}
`;

/** The kind `impact`, one sample a call. Its shape arrives as inputs, as `Impact.shape` takes it. */
export const IMPACT_SOURCE = `"use typeshade";
import { noise } from "./noise.shade.ts";
const TAU: f32 = 6.283185307179586;
export class ImpactState {
  age: u32 = 0;
  phase: f32 = 0;
  low: f32 = 0;
}
export function createImpact(): ImpactState { return new ImpactState(); }
export function impact(
  state: inout<ImpactState>,
  key: u32,
  base: f32,
  drop: f32,
  dropRate: f32,
  subDecay: f32,
  noiseDecay: f32,
  noiseK: f32,
  clickLen: f32,
  aSub: f32,
  aNoise: f32,
  aClick: f32,
): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  const inc: f32 = base * (1 + drop * exp(-a * dropRate));
  const sine: f32 = sin(state.phase * TAU);
  state.phase = fract(state.phase + inc);
  const s: f32 = sine * exp(-a * subDecay) * aSub;
  state.low = state.low + noiseK * (noise(key, age) - state.low);
  const n: f32 = state.low * exp(-a * noiseDecay) * aNoise;
  let c: f32 = 0;
  if (a < clickLen) {
    const r: f32 = 1 - a / clickLen;
    c = noise(key ^ 12345, age) * r * r * aClick;
  }
  return s + n + c;
}
`;

const control = (id: string, unit: string): PortMetadata => ({
  id,
  role: 'control',
  rate: 'block',
  unit,
});

/** The definition of `impact`, with its shape as named controls. */
export const IMPACT_DEFINITION: FunctionDefinition = {
  id: 'impact',
  version: 1,
  module: IMPACT_MODULE,
  export: 'impact',
  inputs: {
    key: control('key', 'seed'),
    base: control('base', 'cycles per frame'),
    drop: control('drop', 'ratio'),
    dropRate: control('dropRate', 'per frame'),
    subDecay: control('subDecay', 'per frame'),
    noiseDecay: control('noiseDecay', 'per frame'),
    noiseK: control('noiseK', 'ratio'),
    clickLen: control('clickLen', 'frames'),
    aSub: control('aSub', 'linear-gain'),
    aNoise: control('aNoise', 'linear-gain'),
    aClick: control('aClick', 'linear-gain'),
  },
  output: { id: 'out', role: 'audio', rate: 'sample', unit: 'amplitude' },
  state: { parameter: 'state', initializer: 'createImpact', version: 1 },
};
