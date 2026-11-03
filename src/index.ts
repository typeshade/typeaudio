// TypeAudio: the host API. The units and kernels are `"use typeshade"` modules; the host builds a
// unit with `new` and calls its methods on the CPU tier (compiler change 0109), and `render` runs
// the kernels over a bank of instances, one `fuse` plan per block (docs/architecture.md).

export { bank, type Bank, type State } from './bank.ts';
export {
  DEFAULT_BLOCK,
  plan,
  render,
  type Plan,
  type PlanOptions,
  type RenderOptions,
} from './render.ts';
export { explain } from './explain.ts';
export { Oscillator, Saw, Sine } from './units/oscillator.shade.ts';
export { OnePole } from './units/one-pole.shade.ts';
export { Biquad, Lowpass } from './units/biquad.shade.ts';
export { Envelope } from './units/envelope.shade.ts';
export { Voice, synth } from './kernels/synth.shade.ts';
export { mixdown } from './kernels/mixdown.shade.ts';
export { drive, gain } from './kernels/bus.shade.ts';
export { peak } from './kernels/meter.shade.ts';
export { Cloud, Grain } from './units/grain.shade.ts';
export { cull, play, spawn } from './kernels/grains.shade.ts';
