'use typeshade';

// The kind `drone`: three detuned saws through a lowpass and a sine an octave below, under a slow
// fade. `pitch` sets the note, `darkness` the cutoff.

import { Saw, Sine } from '../units/oscillator.shade.ts';
import { Lowpass } from '../units/biquad.shade.ts';

export class Drone {
  age: u32 = 0;
  len: f32 = 1;
  /** The fade in and the fade out, in frames. */
  fade: f32 = 72000;
  o0: Saw = new Saw();
  o1: Saw = new Saw();
  o2: Saw = new Saw();
  sub: Sine = new Sine();
  lp: Lowpass = new Lowpass();
  gain: f32 = 1;

  /** Sets the sound and returns it: the note `f` hertz, the saws detuned by `detune`, a lowpass at `cutoff`. */
  shape(sr: f32, len: f32, fade: f32, f: f32, detune: f32, cutoff: f32, gain: f32): this {
    this.len = len;
    this.fade = fade;
    this.gain = gain;
    this.o0.hz(f, sr);
    this.o1.hz(f * (1 + detune), sr);
    this.o2.hz(f * (1 - detune * 1.7), sr);
    this.sub.hz(f * 0.5, sr);
    this.lp.set(cutoff, 0.8, sr);
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    const saws = (this.o0.tick() + this.o1.tick() + this.o2.tick()) * 0.3333;
    const y = this.lp.tick(saws) + this.sub.tick() * 0.5;
    const fi = max(min(min(a / this.fade, (this.len - a) / this.fade), 1), 0);
    return y * fi * this.gain;
  }
}
