// The plain-JavaScript reference of the kinds: the same formulas as `src/kinds/*.shade.ts`, in
// JavaScript numbers, each operation rounded to an `f32` with `Math.fround` (compiler Rule 11.7),
// and each `f32` argument of a host call rounded first (compiler surface §64). It imports nothing
// of TypeShade.

import {
  RefGrain,
  RefOnePole,
  RefLowpass,
  refHash32,
  refUniform,
  refSaw,
  refSine,
} from './reference.ts';
import type { RefOscillator } from './reference.ts';

const f = Math.fround;
const PI = f(3.141592653589793);

/** `noise` of `src/kinds/noise.shade.ts`. */
export const refNoise = (key: number, age: number): number =>
  f(f(2 * refUniform(refHash32((key ^ refHash32(age)) >>> 0))) - 1);

/** `svfCoef` of `src/units/svf.shade.ts`. */
export const refSvfCoef = (fc: number, sr: number): number =>
  Math.min(f(2 * f(Math.sin(f(f(PI * fc) / sr)))), f(1.2));

export class RefSvf {
  low = 0;
  band = 0;
  damp = 1;
  damping(d: number): this {
    this.damp = f(d);
    return this;
  }
  step(x: number, k: number): number {
    this.low = f(this.low + f(f(k) * this.band));
    const high = f(f(f(x) - this.low) - f(this.damp * this.band));
    this.band = f(this.band + f(f(k) * high));
    return this.band;
  }
}

export class RefWhoosh {
  age = 0;
  key = 1;
  sr = 48000;
  len = 1;
  f0 = 200;
  lr = 1;
  curve = 0.5;
  gain = 1;
  svf = new RefSvf();
  shape(
    sr: number,
    len: number,
    f0: number,
    lr: number,
    curve: number,
    damp: number,
    gain: number,
    key: number,
  ): this {
    this.sr = f(sr);
    this.len = f(len);
    this.f0 = f(f0);
    this.lr = f(lr);
    this.curve = f(curve);
    this.gain = f(gain);
    this.key = key >>> 0;
    this.svf.damping(damp);
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const p = Math.min(f(f(age) / this.len), 1);
    const q = f(p * f(this.curve + f(f(1 - this.curve) * p)));
    const fc = f(this.f0 * f(Math.exp(f(q * this.lr))));
    const band = this.svf.step(refNoise(this.key, age), refSvfCoef(fc, this.sr));
    const s = f(Math.sin(f(PI * p)));
    return f(f(f(band * s) * s) * this.gain);
  }
}

export class RefImpact {
  age = 0;
  key = 1;
  sub: RefOscillator = refSine();
  lp = new RefOnePole(0.1);
  base = f(0.001);
  drop = 1;
  dropRate = f(0.001);
  subDecay = f(0.0001);
  noiseDecay = f(0.001);
  clickLen = 48;
  aSub = 1;
  aNoise = 0.5;
  aClick = 0.5;
  shape(
    key: number,
    base: number,
    drop: number,
    dropRate: number,
    subDecay: number,
    noiseDecay: number,
    noiseK: number,
    clickLen: number,
    aSub: number,
    aNoise: number,
    aClick: number,
  ): this {
    this.key = key >>> 0;
    this.base = f(base);
    this.drop = f(drop);
    this.dropRate = f(dropRate);
    this.subDecay = f(subDecay);
    this.noiseDecay = f(noiseDecay);
    (this.lp as { k: number }).k = f(noiseK);
    this.clickLen = f(clickLen);
    this.aSub = f(aSub);
    this.aNoise = f(aNoise);
    this.aClick = f(aClick);
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const a = f(age);
    this.sub.inc = f(this.base * f(1 + f(this.drop * f(Math.exp(f(-a * this.dropRate))))));
    const s = f(f(this.sub.tick() * f(Math.exp(f(-a * this.subDecay)))) * this.aSub);
    const n = f(
      f(this.lp.tick(refNoise(this.key, age)) * f(Math.exp(f(-a * this.noiseDecay)))) * this.aNoise,
    );
    let c = 0;
    if (a < this.clickLen) {
      const r = f(1 - f(a / this.clickLen));
      c = f(f(f(refNoise((this.key ^ 12345) >>> 0, age) * r) * r) * this.aClick);
    }
    return f(f(s + n) + c);
  }
}

class RefPartial {
  osc = refSine();
  amp = 0;
  rate = 0;
  set(freq: number, sr: number, amp: number, rate: number): this {
    this.osc.hz(freq, sr);
    this.amp = f(amp);
    this.rate = f(rate);
    return this;
  }
  tick(a: number, att: number): number {
    const o = this.osc.tick();
    const d = f(Math.exp(f(-a * this.rate)));
    const r = f(1 - f(Math.exp(f(-a * f(att)))));
    return f(f(f(o * this.amp) * d) * r);
  }
}

const refAmplitude = (i: number, count: number, gain: number): number =>
  count > i ? f(f(gain) / f(1 + f(0.5 * i))) : 0;

export class RefShimmer {
  age = 0;
  att = f(0.01);
  p = Array.from({ length: 6 }, () => new RefPartial());
  shape(sr: number, base: number, count: number, rate: number, att: number, gain: number): this {
    this.att = f(att);
    const b = f(base);
    const r = f(rate);
    const c = f(count);
    const ratios = [1, 1.5, 2.01, 2.76, 3.4, 4.13].map(f);
    const rates = [1, 1.5, 2, 2.5, 3, 3.5].map(f);
    this.p.forEach((p, i) =>
      p.set(f(b * ratios[i]!), sr, refAmplitude(i, c, gain), f(r * rates[i]!)),
    );
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const a = f(age);
    let sum = this.p[0]!.tick(a, this.att);
    for (let i = 1; i < 6; i++) sum = f(sum + this.p[i]!.tick(a, this.att));
    return sum;
  }
}

export class RefRiser {
  age = 0;
  key = 1;
  sr = 48000;
  len = 1;
  sine = refSine();
  svf = new RefSvf();
  inc0 = f(0.005);
  lr = 1;
  cut0 = 300;
  cutLr = 1;
  aSine = 0.5;
  aNoise = 1;
  shape(
    sr: number,
    len: number,
    inc0: number,
    lr: number,
    cut0: number,
    cutLr: number,
    aSine: number,
    aNoise: number,
    key: number,
  ): this {
    this.sr = f(sr);
    this.len = f(len);
    this.inc0 = f(inc0);
    this.lr = f(lr);
    this.cut0 = f(cut0);
    this.cutLr = f(cutLr);
    this.aSine = f(aSine);
    this.aNoise = f(aNoise);
    this.key = key >>> 0;
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const p = Math.min(f(f(age) / this.len), 1);
    this.sine.inc = f(this.inc0 * f(Math.exp(f(p * this.lr))));
    const fc = f(this.cut0 * f(Math.exp(f(p * this.cutLr))));
    this.svf.step(refNoise(this.key, age), refSvfCoef(fc, this.sr));
    const mixed = f(f(this.sine.tick() * this.aSine) + f(this.svf.low * this.aNoise));
    return f(f(p * p) * mixed);
  }
}

export class RefWind {
  age = 0;
  key = 1;
  sr = 48000;
  len = 1;
  fade = 48000;
  body = new RefSvf();
  howl = new RefSvf();
  lfo = refSine();
  gust = refSine();
  fc0 = 400;
  depth = f(0.3);
  gdepth = 0.5;
  hGain = f(0.2);
  gain = 1;
  shape(
    sr: number,
    len: number,
    fade: number,
    fc0: number,
    damp: number,
    depth: number,
    gdepth: number,
    hGain: number,
    gain: number,
    lfoHz: number,
    gustHz: number,
    gustPhase: number,
    key: number,
  ): this {
    this.sr = f(sr);
    this.len = f(len);
    this.fade = f(fade);
    this.fc0 = f(fc0);
    this.body.damping(damp);
    this.howl.damping(f(0.04));
    this.depth = f(depth);
    this.gdepth = f(gdepth);
    this.hGain = f(hGain);
    this.gain = f(gain);
    this.lfo.hz(lfoHz, sr);
    this.gust.hz(gustHz, sr);
    this.gust.phase = f(gustPhase);
    this.key = key >>> 0;
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const a = f(age);
    const m = this.lfo.tick();
    const g = this.gust.tick();
    const fc = f(this.fc0 * f(1 + f(this.depth * m)));
    const b = this.body.step(refNoise(this.key, age), refSvfCoef(fc, this.sr));
    const h = this.howl.step(
      refNoise((this.key ^ 77) >>> 0, age),
      refSvfCoef(f(fc * f(2.1)), this.sr),
    );
    const level = f(this.gain * f(1 + f(this.gdepth * g)));
    const fi = Math.max(Math.min(Math.min(f(a / this.fade), f(f(this.len - a) / this.fade)), 1), 0);
    return f(f(f(b + f(h * this.hGain)) * level) * fi);
  }
}

export class RefDrone {
  age = 0;
  len = 1;
  fade = 72000;
  o0 = refSaw();
  o1 = refSaw();
  o2 = refSaw();
  sub = refSine();
  lp = new RefLowpass();
  gain = 1;
  shape(
    sr: number,
    len: number,
    fade: number,
    freq: number,
    detune: number,
    cutoff: number,
    gain: number,
  ): this {
    const fr = f(freq);
    const d = f(detune);
    this.len = f(len);
    this.fade = f(fade);
    this.gain = f(gain);
    this.o0.hz(fr, sr);
    this.o1.hz(f(fr * f(1 + d)), sr);
    this.o2.hz(f(fr * f(1 - f(d * f(1.7)))), sr);
    this.sub.hz(f(fr * f(0.5)), sr);
    this.lp.set(cutoff, f(0.8), sr);
    return this;
  }
  tick(): number {
    const age = this.age;
    this.age = age + 1;
    const a = f(age);
    const saws = f(f(f(this.o0.tick() + this.o1.tick()) + this.o2.tick()) * f(0.3333));
    const y = f(this.lp.tick(saws) + f(this.sub.tick() * f(0.5)));
    const fi = Math.max(Math.min(Math.min(f(a / this.fade), f(f(this.len - a) / this.fade)), 1), 0);
    return f(f(y * fi) * this.gain);
  }
}

/** The sum of the grains at the frame `t`, in the order of the list. */
function sumGrains(grains: readonly RefGrain[], t: number): number {
  let sum = grains[0]!.at(t);
  for (let i = 1; i < grains.length; i++) sum = f(sum + grains[i]!.at(t));
  return sum;
}

const silent = (): RefGrain[] => Array.from({ length: 8 }, () => new RefGrain(0, 1, 0, 0));

export class RefFootstep {
  age = 0;
  grains: RefGrain[] = silent();
  tick(): number {
    const t = this.age;
    this.age = t + 1;
    return sumGrains(this.grains, t);
  }
}

export class RefCloth {
  age = 0;
  lp = new RefOnePole(0.5);
  grains: RefGrain[] = silent();
  tick(): number {
    const t = this.age;
    this.age = t + 1;
    return this.lp.tick(sumGrains(this.grains, t));
  }
}

export class RefStem {
  level = 1;
  shape(level: number): this {
    this.level = f(level);
    return this;
  }
  at(x: number): number {
    return f(f(x) * this.level);
  }
}
