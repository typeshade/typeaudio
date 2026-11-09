// TypeAudio: the host API. The units and kernels are `"use typeshade"` modules; the host builds a
// unit with `new` and calls its methods on the CPU tier (compiler change 0109), and `render` runs
// the kernels over a bank of instances, one `fuse` plan per block (docs/architecture.md).

export { bank, type Bank } from './bank.ts';
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
export { Svf, svfCoef } from './units/svf.shade.ts';
export { Whoosh } from './kinds/whoosh.shade.ts';
export { Impact } from './kinds/impact.shade.ts';
export { Partial, Shimmer } from './kinds/shimmer.shade.ts';
export { Riser } from './kinds/riser.shade.ts';
export { Wind } from './kinds/wind.shade.ts';
export { Drone } from './kinds/drone.shade.ts';
export { Footstep } from './kinds/footstep.shade.ts';
export { Cloth } from './kinds/cloth.shade.ts';
export { Stem } from './kinds/voice.shade.ts';
export { Cue, cues } from './kinds/cue.shade.ts';
export { noise } from './kinds/noise.shade.ts';
export { eventKey, KIND_GAIN, KIND_INDEX, makeCue } from './kinds/make.ts';
export type { Made, MakeOptions } from './kinds/make.ts';
export {
  Spatial,
  Strip,
  Shelf,
  history,
  layers,
  pack,
  place,
  sendSum,
  strips,
} from './spatial/spatial.shade.ts';
export { accumulate2, fftStage, overlap2 } from './spatial/fft.shade.ts';
export { Reverb } from './spatial/reverb.ts';
export {
  MATERIALS as ROOM_MATERIALS,
  SLOTS,
  impulseResponse,
  spatialOf,
  stripOf,
} from './spatial/room.ts';
export { limiterGain, normalizationGain } from './master.ts';
export {
  BLOCK_BUDGET_MS,
  SAMPLE_RATE,
  SNAP_WINDOW,
  onePlan,
  renderPlan,
  type Rendered,
  type RenderPlanOptions,
  type Stereo,
} from './render-plan.ts';
