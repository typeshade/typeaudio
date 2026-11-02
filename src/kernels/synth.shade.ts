"use typeshade";

// Shape V (docs/architecture.md, section 2): the loop runs over the lanes of a bank, and each lane
// writes its own block of frames. A voice is composed of units by its fields (static composition),
// and the kernel holds no math: it is the loop and nothing else.

import { Saw } from "../units/oscillator.shade.ts";
import { Lowpass } from "../units/biquad.shade.ts";

/** One voice: a sawtooth through a lowpass, at a level. */
export class Voice {
  /** The oscillator. */
  osc: Saw = new Saw();
  /** The filter. */
  filter: Lowpass = new Lowpass();
  /** The output level, linear. */
  level: f32 = 1.;

  /** A voice at `f` hertz, its filter at the cutoff `cutoff` hertz and the quality `q`, at the sample rate `sr`. */
  constructor(f: f32, cutoff: f32, q: f32, sr: f32) {
    this.osc.hz(f, sr);
    this.filter.set(cutoff, q, sr);
  }

  /** One sample of the voice. */
  tick(): f32 {
    return this.filter.tick(this.osc.tick()) * this.level;
  }
}

/**
 * Renders one block of every voice of the bank, one lane per voice: lane `v` writes its `block`
 * frames to `out[v * block + n]`, and its state stays in `voices[v]` for the next block.
 */
export function synth(out: array<f32>, voices: array<Voice>, block: u32) {
  for (let v: u32 = 0; v < voices.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = voices[v].tick();
    }
  }
}
