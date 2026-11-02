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

/** `hash32` of `typeshade/random`: the `lowbias32` finaliser, on 32-bit words. */
export function refHash32(x: number): number {
  let h = (x ^ (x >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** `uniform` of `typeshade/random`: the 24 high bits of a word as an f32 in [0, 1). */
export const refUniform = (word: number): number => f((word >>> 8) * (1 / 16777216));

/** WGSL's `u32()` of an `f32`: toward zero, held in [0, 2^32 - 1]. */
const u32of = (x: number): number => Math.min(Math.max(Math.trunc(x), 0), 4294967295);

export class RefGrain {
  constructor(
    readonly start: number,
    readonly length: number,
    readonly inc: number,
    readonly peak: number,
  ) {
    this.inc = f(inc);
    this.peak = f(peak);
  }
  at(t: number): number {
    if (t < this.start) return 0;
    const age = t - this.start;
    if (age >= this.length) return 0;
    const window = f(0.5 - f(0.5 * f(Math.cos(f(TAU * f(f(age) / f(this.length)))))));
    return f(f(this.peak * window) * f(Math.sin(f(TAU * fract(f(this.inc * f(age)))))));
  }
  soundsFrom(t: number): boolean {
    return this.start + this.length > t;
  }
}

export class RefCloud {
  chance = 0;
  shortest = 1;
  spread = 0;
  low = 0;
  span = 0;
  loudest = 1;
  key = 1;
  readonly sr: number;
  constructor(sr: number) {
    this.sr = f(sr);
  }
  density(perSecond: number): this {
    this.chance = f(f(perSecond) / this.sr);
    return this;
  }
  lengths(shortest: number, longest: number): this {
    this.shortest = Math.max(u32of(f(f(shortest) * this.sr)), 1);
    this.spread = u32of(f(f(f(longest) - f(shortest)) * this.sr));
    return this;
  }
  pitches(low: number, high: number): this {
    this.low = f(f(low) / this.sr);
    this.span = f(f(f(high) - f(low)) / this.sr);
    return this;
  }
  level(loudest: number): this {
    this.loudest = f(loudest);
    return this;
  }
  seed(key: number): this {
    this.key = key >>> 0;
    return this;
  }
  draw(t: number): number {
    return refHash32((this.key ^ refHash32(t >>> 0)) >>> 0);
  }
  starts(word: number): boolean {
    return refUniform(word) < this.chance;
  }
  grain(t: number, word: number): RefGrain {
    const length = (this.shortest + (refHash32((word ^ 1) >>> 0) % (this.spread + 1))) >>> 0;
    const inc = f(this.low + f(this.span * refUniform(refHash32((word ^ 2) >>> 0))));
    const peak = f(this.loudest * f(0.5 + f(0.5 * refUniform(refHash32((word ^ 3) >>> 0)))));
    return new RefGrain(t, length, inc, peak);
  }
}

/**
 * The grain scheduler of `src/kernels/grains.shade.ts` in plain JavaScript, block after block: the
 * grains that still sound at the block's first frame, then the grains that start in the block,
 * then the block rendered from the list in its order. A list holds `capacity` grains; a push past
 * it is counted and not kept, as a push past an array's end is (compiler surface §65).
 */
export class RefScheduler {
  list: RefGrain[] = [];
  count = 0;
  constructor(
    readonly cloud: RefCloud,
    readonly capacity: number,
  ) {}
  /** One block of `block` frames from the frame `start`: the samples, the survivors and the count. */
  block(start: number, block: number): { out: Float32Array; survivors: number; count: number } {
    const kept: RefGrain[] = [];
    let survivors = 0;
    for (let g = 0; g < Math.min(this.count, this.capacity); g++) {
      if (this.list[g]!.soundsFrom(start)) {
        if (survivors < this.capacity) kept.push(this.list[g]!);
        survivors++;
      }
    }
    let count = survivors;
    for (let n = 0; n < block; n++) {
      const word = this.cloud.draw(start + n);
      if (this.cloud.starts(word)) {
        if (count < this.capacity) kept.push(this.cloud.grain(start + n, word));
        count++;
      }
    }
    this.list = kept;
    this.count = count;
    const out = new Float32Array(block);
    const live = Math.min(count, this.capacity);
    for (let n = 0; n < block; n++) {
      let s = 0;
      for (let g = 0; g < live; g++) s = f(s + kept[g]!.at(start + n));
      out[n] = s;
    }
    return { out, survivors, count };
  }
}
