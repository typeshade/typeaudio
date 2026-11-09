'use typeshade';

// The kind `wind`: noise through a bandpass whose centre and level follow slow LFOs, and a narrow
// resonance an octave above for the howl. `gust` sets the depth of the LFOs, `howl` the resonance.

import { Sine } from '../units/oscillator.shade.ts';
import { Svf, svfCoef } from '../units/svf.shade.ts';
import { noise } from './noise.shade.ts';

export class Wind {
  age: u32 = 0;
  key: u32 = 1;
  sr: f32 = 48000;
  len: f32 = 1;
  /** The fade in and the fade out, in frames. */
  fade: f32 = 48000;
  /** The body's bandpass. */
  body: Svf = new Svf();
  /** The howl's resonance. */
  howl: Svf = new Svf();
  /** The LFO of the centre. */
  lfo: Sine = new Sine();
  /** The LFO of the level. */
  gust: Sine = new Sine();
  /** The body's centre, in hertz. */
  fc0: f32 = 400;
  /** The depth of the centre's LFO, from 0 to 1. */
  depth: f32 = 0.3;
  /** The depth of the level's LFO, from 0 to 0.9. */
  gdepth: f32 = 0.5;
  /** The howl's level against the body's. */
  hGain: f32 = 0.2;
  gain: f32 = 1;

  /** Sets the sound and returns it. */
  shape(
    sr: f32,
    len: f32,
    fade: f32,
    fc0: f32,
    damp: f32,
    depth: f32,
    gdepth: f32,
    hGain: f32,
    gain: f32,
    lfoHz: f32,
    gustHz: f32,
    gustPhase: f32,
    key: u32,
  ): this {
    this.sr = sr;
    this.len = len;
    this.fade = fade;
    this.fc0 = fc0;
    this.body.damping(damp);
    this.howl.damping(0.04);
    this.depth = depth;
    this.gdepth = gdepth;
    this.hGain = hGain;
    this.gain = gain;
    this.lfo.hz(lfoHz, sr);
    this.gust.hz(gustHz, sr);
    this.gust.phase = gustPhase;
    this.key = key;
    return this;
  }

  /** One sample. */
  tick(): f32 {
    const age = this.age;
    this.age = age + 1;
    const a = f32(age);
    const m = this.lfo.tick();
    const g = this.gust.tick();
    const fc = this.fc0 * (1 + this.depth * m);
    const b = this.body.step(noise(this.key, age), svfCoef(fc, this.sr));
    const h = this.howl.step(noise(this.key ^ 77, age), svfCoef(fc * 2.1, this.sr));
    const level = this.gain * (1 + this.gdepth * g);
    const fi = max(min(min(a / this.fade, (this.len - a) / this.fade), 1), 0);
    return (b + h * this.hGain) * level * fi;
  }
}
