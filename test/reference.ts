// The plain-JavaScript reference the tests hold the units and the render to: the same formulas as
// the `"use typeshade"` modules, in JavaScript numbers, each operation rounded to an `f32` with
// `Math.fround`, as the CPU tier computes an `f32` (compiler Rule 11.7). A host call rounds each
// `f32` argument as a buffer write rounds it (compiler surface §64), so each method here rounds its
// arguments first. It imports nothing of TypeShade.

const f = Math.fround;
const TAU = f(6.283185307179586);

/** WGSL's `fract`: the part of `x` above its floor. */
const fract = (x: number): number => f(x - Math.floor(x));

export class RefOscillator {
  phase = 0;
  inc = 0;
  constructor(private readonly wave: (p: number) => number) {}
  hz(freq: number, sr: number): this {
    this.inc = f(f(freq) / f(sr));
    return this;
  }
  tick(): number {
    const y = this.wave(this.phase);
    this.phase = fract(f(this.phase + this.inc));
    return y;
  }
}

export const refSine = (): RefOscillator => new RefOscillator((p) => f(Math.sin(f(p * TAU))));
export const refSaw = (): RefOscillator => new RefOscillator((p) => f(f(p * 2) - 1));

export class RefOnePole {
  z = 0;
  constructor(readonly k: number) {
    this.k = f(k);
  }
  tick(input: number): number {
    const x = f(input);
    this.z = f(this.z + f(this.k * f(x - this.z)));
    return this.z;
  }
}

export class RefEnvelope {
  rise = 0;
  fall = 1;
  attack = 1;
  decay = 1;
  sustain = 1;
  times(attack: number, decay: number, sustain: number, sr: number): this {
    const rate = f(sr);
    this.attack = f(1 - f(Math.exp(f(-1 / f(f(attack) * rate)))));
    this.decay = f(1 - f(Math.exp(f(-1 / f(f(decay) * rate)))));
    this.sustain = f(sustain);
    return this;
  }
  tick(): number {
    const y = f(this.rise * this.fall);
    this.rise = f(this.rise + f(this.attack * f(1 - this.rise)));
    this.fall = f(this.fall + f(this.decay * f(this.sustain - this.fall)));
    return y;
  }
}

export class RefLowpass {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  z1 = 0;
  z2 = 0;
  set(freq: number, q: number, sr: number): this {
    const w = f(f(TAU * f(freq)) / f(sr));
    const cw = f(Math.cos(w));
    const alpha = f(f(Math.sin(w)) / f(2 * f(q)));
    const a0 = f(1 + alpha);
    const b1 = f(f(1 - cw) / a0);
    this.b0 = f(b1 * 0.5);
    this.b1 = b1;
    this.b2 = f(b1 * 0.5);
    this.a1 = f(f(-2 * cw) / a0);
    this.a2 = f(f(1 - alpha) / a0);
    return this;
  }
  tick(input: number): number {
    const x = f(input);
    const y = f(f(this.b0 * x) + this.z1);
    this.z1 = f(f(f(this.b1 * x) - f(this.a1 * y)) + this.z2);
    this.z2 = f(f(this.b2 * x) - f(this.a2 * y));
    return y;
  }
}

export class RefVoice {
  readonly osc = refSaw();
  readonly filter = new RefLowpass();
  level = 1;
  constructor(freq: number, cutoff: number, q: number, sr: number) {
    this.osc.hz(f(freq), f(sr));
    this.filter.set(cutoff, q, sr);
  }
  tick(): number {
    return f(this.filter.tick(this.osc.tick()) * this.level);
  }
}

/** The render of `render()` in plain JavaScript: the same blocks, the same order of every sum. */
export function refRender(
  voices: readonly RefVoice[],
  frames: number,
  block: number,
  drive: number,
  gain: number,
): Float32Array {
  const out = new Float32Array(frames);
  for (let at = 0; at < frames; at += block) {
    const n = Math.min(block, frames - at);
    const lanes = voices.map((v) => Array.from({ length: n }, () => v.tick()));
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const lane of lanes) s = f(s + lane[i]!);
      const driven = f(Math.tanh(f(s * f(drive))));
      out[at + i] = f(driven * f(gain));
    }
  }
  return out;
}
