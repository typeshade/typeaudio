// The study's models that fit a typed function (one output, at most 16 inputs, flat state), as
// typed function definitions in the function-graph profile, so the site's editor can open them.
//
// The study (`src/study/sources.ts`, ported from `docs/studies/frieren-perceptual/scripts/` at
// commit `07670c9`) shapes whole signals at once: zero-phase filters on the FFT grid, and a level
// that divides by the peak of the whole sound. A function hears one sample at a time, so each model
// here is the same model written as a stream:
//
// - a band of the study's `band_gain(f, lo, hi, order)` is a Butterworth high pass at `lo` and low
//   pass at `hi` of the same order (state-variable filters, bilinear): the same magnitude, a causal
//   phase;
// - white noise is the hash noise of `noise.shade.ts`, scaled to unit deviation;
// - `irregular` (band-limited noise, unit deviation, clipped at 1.5) is that noise through its band,
//   divided by the band's deviation, which the source states as a number computed from the filter;
// - a level the study takes from the peak of the whole sound is an input (`gain`).
//
// `test/study-functions.test.ts` holds each function to the study's model in its envelope and its
// spectrum, with the tolerances it states: the random numbers differ, so samples cannot agree.

import type { FunctionDefinition, PortMetadata } from '../../function-graph/types.ts';

/** The module path of the study's functions inside a document. */
export const STUDY_MODULE = '/kinds/study.shade.ts';

const SR = 48000;

/** The deviation of unit-deviation white noise through a Butterworth band (lo, hi, order). */
export function bandDeviation(
  lo: number,
  hi: number,
  order: number,
  weight: (f: number) => number = () => 1,
): number {
  // Power of the band against the whole band of the noise, on a fine grid of the bilinear response.
  const n = 1 << 16;
  let e = 0;
  for (let k = 1; k < n; k++) {
    const f = (k / n) * (SR / 2);
    // the bilinear transform maps f to tan(pi f / SR); the analogue Butterworth magnitude there
    const w = Math.tan((Math.PI * f) / SR);
    const wl = Math.tan((Math.PI * lo) / SR);
    const wh = Math.tan((Math.PI * hi) / SR);
    const g2 = (1 / (1 + (wl / w) ** (2 * order))) * (1 / (1 + (w / wh) ** (2 * order)));
    e += g2 * weight(f);
  }
  return Math.sqrt(e / n);
}

const num = (x: number): string => {
  const s = x.toPrecision(9);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
};

/** Lines of a state-variable filter (Simper's form) on `x` at `fc` Hz with damping `k`. */
function svf(s1: string, s2: string, x: string, fc: string, k: string, tag: string): string {
  return `
  const w${tag}: f32 = 3.14159265 * min(${fc}, 23000.0) / ${num(SR)};
  const g${tag}: f32 = sin(w${tag}) / cos(w${tag});
  const a1${tag}: f32 = 1 / (1 + g${tag} * (g${tag} + ${k}));
  const a2${tag}: f32 = g${tag} * a1${tag};
  const a3${tag}: f32 = g${tag} * a2${tag};
  const v3${tag}: f32 = ${x} - state.${s2};
  const v1${tag}: f32 = a1${tag} * state.${s1} + a2${tag} * v3${tag};
  const v2${tag}: f32 = state.${s2} + a2${tag} * state.${s1} + a3${tag} * v3${tag};
  state.${s1} = 2 * v1${tag} - state.${s1};
  state.${s2} = 2 * v2${tag} - state.${s2};
  const low${tag}: f32 = v2${tag};
  const band${tag}: f32 = v1${tag};
  const high${tag}: f32 = ${x} - ${k} * v1${tag} - v2${tag};`;
}

/** Lines of a one-pole filter (zero-delay form) on `x` at `fc` Hz: `lp<tag>` and `hp<tag>`. */
function onePole(s: string, x: string, fc: string, tag: string): string {
  return `
  const u${tag}: f32 = 3.14159265 * min(${fc}, 23000.0) / ${num(SR)};
  const g${tag}: f32 = sin(u${tag}) / cos(u${tag});
  const v${tag}: f32 = (${x} - state.${s}) * (g${tag} / (1 + g${tag}));
  const lp${tag}: f32 = v${tag} + state.${s};
  state.${s} = lp${tag} + v${tag};
  const hp${tag}: f32 = ${x} - lp${tag};`;
}

/** A unit-deviation `irregular` modulator of the study, band lo..hi, from `key`. */
function irregular(prefix: string, key: string, lo: number, hi: number): string {
  const dev = bandDeviation(lo, hi, 2);
  return `
  const w${prefix}: f32 = noise(${key}, age) * 1.7320508;${svf(`${prefix}h1`, `${prefix}h2`, `w${prefix}`, num(lo), '1.4142136', `${prefix}H`)}${svf(`${prefix}l1`, `${prefix}l2`, `high${prefix}H`, num(hi), '1.4142136', `${prefix}L`)}
  const ${prefix}: f32 = clamp(low${prefix}L / ${num(dev)}, -1.5, 1.5) / 1.5;`;
}

const fields = (names: string[]): string => names.map((n) => `  ${n}: f32 = 0;`).join('\n');
const modFields = (p: string): string[] => [`${p}h1`, `${p}h2`, `${p}l1`, `${p}l2`];

/** The power response of the pink filter of `redRumble` (Paul Kellet's economy filter) at f Hz. */
function pinkPower(f: number): number {
  const w = (2 * Math.PI * f) / SR;
  let re = 0.1848;
  let im = 0;
  for (const [b, p] of [
    [0.099046, 0.99765],
    [0.2965164, 0.963],
    [1.0526913, 0.57],
  ] as const) {
    // b / (1 - p e^{-jw})
    const dr = 1 - p * Math.cos(w);
    const di = p * Math.sin(w);
    const d = dr * dr + di * di;
    re += (b * dr) / d;
    im += (-b * di) / d;
  }
  return re * re + im * im;
}
const RUMBLE_DEV = bandDeviation(38, 150, 2, pinkPower);

/** The study's functions. Each key draws its own noise; `rumble` and `roar` share `key ^ 20`. */
export const STUDY_SOURCE = `"use typeshade";
import { noise, hash32, uniform, smooth } from "./noise.shade.ts";

export class BurstState {
  age: u32 = 0;
${fields(['h1', 'h2', 'l1', 'l2'])}
}
export function createBurst(): BurstState { return new BurstState(); }
/** burst: noise between lo and hi Hz (second order) under a raised-cosine rise and a decay of tau seconds. */
export function studyBurst(state: inout<BurstState>, key: u32, lo: f32, hi: f32, tau: f32, rise: f32, gain: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  const x: f32 = noise(key, age) * 1.7320508;${svf('h1', 'h2', 'x', 'lo', '1.4142136', 'H')}${svf('l1', 'l2', 'highH', 'hi', '1.4142136', 'L')}
  const k: f32 = max(2.0, round(rise * ${num(SR)}));
  let env: f32 = exp(-a / (tau * ${num(SR)}));
  if (a < k) {
    env = env * (0.5 - 0.5 * cos(3.14159265 * (a + 0.5) / k));
  }
  return lowL * env * gain;
}

export class BoomState {
  age: u32 = 0;
${fields(['hp', 'hs1', 'hs2', 'lp', 'ls1', 'ls2', 'ph0', 'ph1'])}
}
export function createBoom(): BoomState { return new BoomState(); }
/** boom: noise around f Hz (third order, 0.55 f to 1.5 f) and two modes at f and 0.72 f that sink by 8 %. */
export function studyBoom(state: inout<BoomState>, key: u32, f: f32, tau: f32, aNoise: f32, aTone: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  const x: f32 = noise(key, age) * 1.7320508;${onePole('hp', 'x', '0.55 * f', 'P')}${svf('hs1', 'hs2', 'hpP', '0.55 * f', '1.0', 'H')}${onePole('lp', 'highH', '1.5 * f', 'Q')}${svf('ls1', 'ls2', 'lpQ', '1.5 * f', '1.0', 'L')}
  if (age == 0) {
    state.ph0 = uniform(hash32(key ^ 7001));
    state.ph1 = uniform(hash32(key ^ 7002));
  }
  const glide: f32 = 1 - 0.08 * (1 - exp(-a / (0.6 * tau * ${num(SR)})));
  const md: f32 = sin(6.2831853 * state.ph0) + 0.7 * sin(6.2831853 * state.ph1);
  state.ph0 = fract(state.ph0 + f * glide / ${num(SR)});
  state.ph1 = fract(state.ph1 + 0.72 * f * glide / ${num(SR)});
  const k: f32 = ${num(Math.max(2, Math.round(0.006 * SR)))};
  let env: f32 = exp(-a / (tau * ${num(SR)}));
  if (a < k) {
    env = env * (0.5 - 0.5 * cos(3.14159265 * (a + 0.5) / k));
  }
  return (aNoise * lowL + aTone * md) * env;
}

export class SlipState {
  age: u32 = 0;
  left: u32 = 0;
${fields(['next', 'amp', 'b01', 'b02', 'b11', 'b12', 'b21', 'b22', 'sh1', 'sh2', 'sl1', 'sl2', 'follow'])}
}
export function createSlip(): SlipState { return new SlipState(); }
/**
 * groan and grind: stick and slip. Slips come rLo to rHi times a second along a slow walk, each
 * interval drawn with a jitter; each slip is an impulse (burst 1, groan) or burst frames of noise
 * (grind), through three wide resonances. scrape > 0 adds noise from 500 Hz to 4 kHz that follows
 * the level of the resonances. len is the length in frames, for the study's fades.
 */
export function studySlip(state: inout<SlipState>, key: u32, rLo: f32, rHi: f32, f0: f32, f1: f32, f2: f32, q: f32, jitter: f32, burst: f32, scrape: f32, len: f32, gain: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const a: f32 = f32(age);
  let e: f32 = 0;
  if (age == 0) {
    state.next = uniform(hash32(key ^ 9001)) * select(0.02, 0.01, burst <= 1) * ${num(SR)};
  }
  if (a >= state.next && a < len) {
    const word: u32 = hash32(key ^ hash32(age ^ 0x51ed));
    const m: f32 = smooth(key ^ 31, a * ${num(2.5 / SR)});
    const path: f32 = rLo * (rHi / rLo) ** (0.5 + 0.5 * m);
    state.next = state.next + ${num(SR)} / path * (1 + jitter * (2 * uniform(hash32(word ^ 1)) - 1));
    if (burst <= 1) {
      e = 0.4 + 0.6 * uniform(hash32(word ^ 2));
    } else {
      state.amp = 0.3 + 0.7 * uniform(hash32(word ^ 2));
      state.left = u32(burst);
    }
  }
  if (state.left > 0) {
    state.left = state.left - 1;
    e = noise(key ^ 77, age) * 1.7320508 * state.amp;
  }
  const kq: f32 = 1 / q;${svf('b01', 'b02', 'e', 'f0', 'kq', 'A')}${svf('b11', 'b12', 'e', 'f1', 'kq', 'B')}${svf('b21', 'b22', 'e', 'f2', 'kq', 'C')}
  const low: f32 = kq * (bandA + bandB / 1.4142136 + bandC / 1.7320508);
  state.follow = state.follow + (abs(low) - state.follow) * ${num(1 - Math.exp(-1 / (0.012 * SR)))};
  const sx: f32 = noise(key ^ 2, age) * 1.7320508;${svf('sh1', 'sh2', 'sx', '500.0', '1.4142136', 'S')}${svf('sl1', 'sl2', 'highS', '4000.0', '1.4142136', 'T')}
  const fin: f32 = min(a / ${num(0.03 * SR)}, 1);
  const fout: f32 = clamp((len - a) / ${num(0.08 * SR)}, 0, 1);
  return (low + scrape * lowT * state.follow) * gain * fin * fout;
}

export class RumbleState {
  age: u32 = 0;
${fields(['p0', 'p1', 'p2', 'h1', 'h2', 'l1', 'l2', ...modFields('ms'), ...modFields('mo')])}
}
export function createRumble(): RumbleState { return new RumbleState(); }
/** The red material's rumble: pink noise from 38 to 150 Hz, unit deviation, under its irregular level. */
export function redRumble(state: inout<RumbleState>, key: u32, tension: f32, gain: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const w: f32 = noise(key, age) * 1.7320508;
  state.p0 = 0.99765 * state.p0 + w * 0.0990460;
  state.p1 = 0.96300 * state.p1 + w * 0.2965164;
  state.p2 = 0.57000 * state.p2 + w * 1.0526913;
  const pink: f32 = state.p0 + state.p1 + state.p2 + w * 0.1848;${svf('h1', 'h2', 'pink', '38.0', '1.4142136', 'H')}${svf('l1', 'l2', 'highH', '150.0', '1.4142136', 'L')}${irregular('ms', 'key ^ 20', 10, 90)}${irregular('mo', 'key ^ 21', 10, 90)}
  const depth: f32 = 0.5 + 0.35 * tension;
  return lowL / ${num(RUMBLE_DEV)} * (1 + depth * (0.6 * ms + 0.4 * mo)) * gain;
}

export class RoarState {
  age: u32 = 0;
${fields(['b1', 'b2', 'c1', 'c2', ...modFields('ms'), ...modFields('mo')])}
}
export function createRoar(): RoarState { return new RoarState(); }
/**
 * The red material's roar: noise in a band around 480 to 1100 Hz that narrows as the tension
 * rises (two band passes in series in place of the study's band, Gaussian on a log axis), at unit
 * deviation, under its irregular level.
 */
export function redRoar(state: inout<RoarState>, key: u32, tension: f32, gain: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const x: f32 = noise(key ^ 1, age) * 1.7320508;
  const fc: f32 = 480 * (1100.0 / 480.0) ** tension;
  const wd: f32 = 1.1 - 0.7 * tension;
  const bw: f32 = 2.6 * wd;
  const kq: f32 = exp(0.34657359 * bw) - exp(-0.34657359 * bw);${svf('b1', 'b2', 'x', 'fc', 'kq', 'A')}${svf('c1', 'c2', 'kq * bandA', 'fc', 'kq', 'B')}
  const dev: f32 = sqrt(0.78539816 * fc * kq * 2 / ${num(SR)});${irregular('ms', 'key ^ 20', 10, 90)}${irregular('mo', 'key ^ 22', 15, 120)}
  const depth: f32 = 0.5 + 0.35 * tension;
  return kq * bandB / dev * (1 + depth * (0.6 * ms + 0.4 * mo)) * gain;
}

export class CrackleState {
  age: u32 = 0;
${fields(['h1', 'h2', 'l1', 'l2', ...modFields('mc')])}
}
export function createCrackle(): CrackleState { return new CrackleState(); }
/** The red material's crackle: sparse impulses, 250 to 900 a second with the tension, from 2.2 to 9 kHz. */
export function redCrackle(state: inout<CrackleState>, key: u32, tension: f32, gain: f32): f32 {
  const age: u32 = state.age;
  state.age = age + 1;
  const word: u32 = hash32(key ^ 0x2c1b ^ hash32(age));
  const rate: f32 = (250 + 650 * tension) / ${num(SR)};
  let x: f32 = 0;
  if (uniform(word) < rate) {
    x = (0.4 + 0.6 * uniform(hash32(word ^ 1))) * select(1.0, -1.0, uniform(hash32(word ^ 2)) < 0.5);
  }${svf('h1', 'h2', 'x', '2200.0', '1.4142136', 'H')}${svf('l1', 'l2', 'highH', '9000.0', '1.4142136', 'L')}${irregular('mc', 'key ^ 23', 2, 12)}
  const dev: f32 = sqrt(rate * 0.52) * ${num(bandDeviation(2200, 9000, 2))};
  return lowL / dev * (1 + 0.5 * mc) * gain;
}

/** The red material: rumble, roar and crackle in the study's proportions. */
export function redMaterial(rumble: f32, roar: f32, crackle: f32, wRumble: f32, wRoar: f32, wCrackle: f32): f32 {
  return wRumble * rumble + wRoar * roar + wCrackle * crackle;
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
const signal = (id: string): PortMetadata => ({ id, role: 'control', rate: 'sample' });

const def = (
  id: string,
  inputs: PortMetadata[],
  state?: { initializer: string },
): FunctionDefinition => ({
  id,
  version: 1,
  module: STUDY_MODULE,
  export: id,
  inputs: Object.fromEntries(inputs.map((p) => [p.id, p])),
  output: audio('out'),
  ...(state ? { state: { parameter: 'state', initializer: state.initializer, version: 1 } } : {}),
});

export const STUDY_BURST_DEFINITION = def(
  'studyBurst',
  [
    control('key', 'seed'),
    control('lo', 'hertz'),
    control('hi', 'hertz'),
    control('tau', 'seconds'),
    control('rise', 'seconds'),
    control('gain', 'linear-gain'),
  ],
  { initializer: 'createBurst' },
);
export const STUDY_BOOM_DEFINITION = def(
  'studyBoom',
  [
    control('key', 'seed'),
    control('f', 'hertz'),
    control('tau', 'seconds'),
    control('aNoise', 'linear-gain'),
    control('aTone', 'linear-gain'),
  ],
  { initializer: 'createBoom' },
);
export const STUDY_SLIP_DEFINITION = def(
  'studySlip',
  [
    control('key', 'seed'),
    control('rLo', 'per second'),
    control('rHi', 'per second'),
    control('f0', 'hertz'),
    control('f1', 'hertz'),
    control('f2', 'hertz'),
    control('q', 'ratio'),
    control('jitter', 'ratio'),
    control('burst', 'frames'),
    control('scrape', 'linear-gain'),
    control('len', 'frames'),
    control('gain', 'linear-gain'),
  ],
  { initializer: 'createSlip' },
);
const redInputs = [control('key', 'seed'), signal('tension'), control('gain', 'linear-gain')];
export const RED_RUMBLE_DEFINITION = def('redRumble', redInputs, { initializer: 'createRumble' });
export const RED_ROAR_DEFINITION = def('redRoar', redInputs, { initializer: 'createRoar' });
export const RED_CRACKLE_DEFINITION = def('redCrackle', redInputs, {
  initializer: 'createCrackle',
});
export const RED_MATERIAL_DEFINITION = def('redMaterial', [
  audio('rumble'),
  audio('roar'),
  audio('crackle'),
  control('wRumble', 'linear-gain'),
  control('wRoar', 'linear-gain'),
  control('wCrackle', 'linear-gain'),
]);

/** Every definition of the module. */
export const STUDY_DEFINITIONS: readonly FunctionDefinition[] = [
  STUDY_BURST_DEFINITION,
  STUDY_BOOM_DEFINITION,
  STUDY_SLIP_DEFINITION,
  RED_RUMBLE_DEFINITION,
  RED_ROAR_DEFINITION,
  RED_CRACKLE_DEFINITION,
  RED_MATERIAL_DEFINITION,
];

/**
 * The gains of `studyBoom` for the study's `boom(f, tau, tone)`: the study adds the noise and the
 * two modes each at its own peak, so the noise's input is (1 - tone) over the expected peak of the
 * band's noise over the sound, and the modes' tone over the peak of the two sines (1.7).
 */
export function boomGains(f: number, tau: number, tone = 0.3): { aNoise: number; aTone: number } {
  const dev = bandDeviation(0.55 * f, 1.5 * f, 3);
  const n = Math.min(2.5, tau * 7) * SR;
  const peak = dev * Math.sqrt(2 * Math.log(n));
  return { aNoise: (1 - tone) / peak, aTone: tone / 1.7 };
}
