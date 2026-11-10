// The host half of the kinds: it turns one plan event into one lane of its kind (`lanes.shade.ts`). The macros
// of docs/sound-design-loop.md, "The kinds", become the numbers of each unit's `shape`. Every
// draw is a function of the event's key (a hash of the seed and the event's id), so an edit to one
// event changes that event only, even when it moves the event in the sorted list, and two
// events of one kind differ through their keys (the `variation` dimension).

import type { PlanEvent } from '../plan/types.ts';
import { Cloud, Grain } from '../units/grain.shade.ts';
import {
  BoomLane,
  ClothLane,
  CrackLane,
  DroneLane,
  FootstepLane,
  ImpactLane,
  RiserLane,
  RoarLane,
  RubbleLane,
  ShimmerLane,
  VoiceLane,
  WhooshLane,
  WindLane,
} from './lanes.shade.ts';
import { Whoosh } from './whoosh.shade.ts';
import { Impact } from './impact.shade.ts';
import { Shimmer } from './shimmer.shade.ts';
import { Riser } from './riser.shade.ts';
import { Wind } from './wind.shade.ts';
import { Drone } from './drone.shade.ts';
import { Footstep } from './footstep.shade.ts';
import { Cloth } from './cloth.shade.ts';
import { Stem } from './voice.shade.ts';
import { Stones } from './stones.shade.ts';
import { Boom } from './boom.shade.ts';
import { Roar } from './roar.shade.ts';
import { svfCoef } from '../units/svf.shade.ts';

/** The kinds in the order of the `kinds` array that `gather` reads. */
export const KIND_INDEX = {
  whoosh: 0,
  impact: 1,
  shimmer: 2,
  riser: 3,
  wind: 4,
  drone: 5,
  footstep: 6,
  cloth: 7,
  voice: 8,
  crack: 9,
  boom: 10,
  rubble: 11,
  roar: 12,
} as const;

/**
 * The peak of an event of intensity 1 before the spatial chain. The loudness of the mix is set by
 * the master, so this only sets how the kinds sit against one another.
 */
export const KIND_PEAK = 0.5;

/**
 * The gains of the four kinds of experiment 9, measured on 32 keys of each at its default macros
 * (2026-11-10): they bring the median peak at intensity 1 to `KIND_PEAK`. The four are noise under
 * envelopes, so the peak of one take differs from the median: by up to 4 dB for `crack`, `boom`
 * and `roar`, and by more for `rubble`, whose impacts fall at random.
 */
const CRACK_GAIN = 0.375;
const BOOM_GAIN = 0.77;
const RUBBLE_GAIN = 0.58;
const ROAR_GAIN = 1.24;

/**
 * The gain that brings the peak of each procedural kind, at intensity 1, to about `KIND_PEAK`
 * (measured on the fixture plan, 2026-11-09). `footstep` and `cloth` have no entry: they are drawn
 * from a cloud, so `makeLane` reaches `KIND_PEAK` for them by scaling the drawn grains
 * (`fitPeak`).
 */
export const KIND_GAIN: Record<string, number> = {
  whoosh: 0.38,
  impact: 0.36,
  shimmer: 0.7,
  riser: 0.17,
  wind: 0.35,
  drone: 0.4,
  voice: 1,
  crack: CRACK_GAIN,
  boom: BOOM_GAIN,
  rubble: RUBBLE_GAIN,
  roar: ROAR_GAIN,
};

/** A hash of two words to [0, 2^32). */
export function mix32(a: number, b: number): number {
  let x = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** A draw in [0, 1) from a key and a salt. */
export const draw = (key: number, salt: number): number => mix32(key, salt) / 4294967296;

/** A hash of a string to [0, 2^32): FNV-1a over its UTF-16 code units. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * The key of the event `id` of a plan with `seed`. It depends on the id and not on the event's place
 * in the sorted list, so adding, removing or moving another event leaves it as it was.
 */
export const eventKey = (seed: number, id: string): number => mix32(seed >>> 0, hashId(id));

/** The gain of an event: intensity times the kind's calibration. */
const level = (e: PlanEvent): number => e.intensity * (KIND_GAIN[e.kind] ?? 1);

/**
 * Scales the grains of `unit` so that its peak over its first `length` frames is `target`. The unit
 * ticks here, so the unit that goes into the lane is a fresh one that takes its grains: its `age`
 * is 0 and the lowpass of a `Cloth` is as a new one has it. `tick()` is linear in the grains'
 * `peak` fields, so one measurement is enough. The stored peak is rounded to `f32`, as the device
 * receives it. A measured peak that is 0 or not finite leaves the
 * grains as drawn (`drawGrains` always gives one grain, so a peak of 0 needs a level of 0).
 */
function fitPeak<U extends Footstep | Cloth>(unit: U, fresh: U, length: number, target: number): U {
  const names = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] as const;
  let measured = 0;
  for (let t = 0; t < length; t++) measured = Math.max(measured, Math.abs(unit.tick()));
  const scale = target / measured;
  const ok = measured > 0 && Number.isFinite(scale);
  for (const n of names) {
    const g = unit[n];
    if (ok) g.peak = Math.fround(g.peak * scale);
    fresh[n] = g;
  }
  return fresh;
}

/** One lane of its kind, tagged by the kind, and how many frames the sound lasts. */
export type Made = { length: number } & (
  | { kind: 'whoosh'; lane: WhooshLane }
  | { kind: 'impact'; lane: ImpactLane }
  | { kind: 'shimmer'; lane: ShimmerLane }
  | { kind: 'riser'; lane: RiserLane }
  | { kind: 'wind'; lane: WindLane }
  | { kind: 'drone'; lane: DroneLane }
  | { kind: 'footstep'; lane: FootstepLane }
  | { kind: 'cloth'; lane: ClothLane }
  | { kind: 'voice'; lane: VoiceLane }
  | { kind: 'crack'; lane: CrackLane }
  | { kind: 'boom'; lane: BoomLane }
  | { kind: 'rubble'; lane: RubbleLane }
  | { kind: 'roar'; lane: RoarLane }
);

export interface MakeOptions {
  sr: number;
  /** The event's key (`eventKey`). */
  key: number;
  /** The event's input stem, for `voice`. */
  stem?: Float32Array;
}

const frames = (seconds: number, sr: number): number => Math.max(1, Math.round(seconds * sr));

/** The most grains of one cloud that sound at the same time (`docs/sound-design-loop.md`, "The kinds"). */
export const MAX_SOUNDING = 2;

/**
 * Draws grains of `cloud` over `window` seconds into the slots `from` to `to` of `unit`, at least
 * one; returns the last frame. A drawn start that would be the third grain sounding at once is
 * skipped, and the scan goes on to the next frame that starts a grain: the draw stays a function of
 * the cloud's seed alone.
 */
function drawGrains(
  unit: Footstep | Cloth,
  cloud: Cloud,
  window: number,
  sr: number,
  from: number,
  to: number,
): number {
  const names = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] as const;
  let slot = from;
  let end = 0;
  for (let t = 0; t < Math.round(window * sr) && slot < to; t++) {
    const word = cloud.draw(t);
    if (cloud.starts(word)) {
      const g: Grain = cloud.grain(t, word);
      let sounding = 0;
      for (let i = from; i < slot; i++) {
        const o = unit[names[i]!];
        if (o.start + o.length > t) sounding++;
      }
      if (sounding >= MAX_SOUNDING) continue;
      unit[names[slot++]!] = g;
      end = Math.max(end, g.start + g.length);
    }
  }
  if (slot === from) {
    // The draw started no grain in the window (a chance of e^-3 to e^-8 by cloud): the cloud's
    // grain at the first frame stands in, so that no footstep lacks its thud and no event is silent.
    const g: Grain = cloud.grain(0, cloud.draw(0));
    unit[names[slot]!] = g;
    end = g.start + g.length;
  }
  return end;
}

/**
 * The five bands of `Stones`: the centre in hertz, the seconds its envelope takes to fall to 1/e, the
 * gain that levels the bands (a low band of noise is weak), and its share of an impact's dry edge.
 * The centres lie 1.4 octaves apart, from the knock of a block of 0.8 m to the edge of a crack.
 */
export const STONE_BANDS = [
  { hz: 70, tau: 0.15, gain: 9, edge: 0 },
  { hz: 180, tau: 0.085, gain: 5.5, edge: 0 },
  { hz: 480, tau: 0.045, gain: 3.2, edge: 0 },
  { hz: 1300, tau: 0.022, gain: 1.9, edge: 0.5 },
  { hz: 3400, tau: 0.01, gain: 1.2, edge: 1 },
] as const;
/** The seconds a lane of stones sounds after its last impact: the lowest band's fall by 60 dB. */
export const STONE_TAIL = 1;

/** The four bands of `Roar`: the centre in hertz, the damping, the gain, how far the level wanders (a natural log) and how fast (hertz). */
export const ROAR_BANDS = [
  { hz: 55, damp: 1.4, gain: 3.6, depth: 0.115, rate: 3.2 },
  { hz: 300, damp: 2, gain: 2.8, depth: 0.15, rate: 4.2 },
  { hz: 1100, damp: 1.6, gain: 1.3, depth: 0.63, rate: 8.2 },
  { hz: 3000, damp: 1.4, gain: 0.07, depth: 0.75, rate: 9.5 },
] as const;

interface StonesShape {
  key: number;
  sr: number;
  /** The seconds over which the rate and the sizes move. */
  span: number;
  /** Impacts a second: `a + b * u ** 1.5 + c * (1 - u) ** 3`. */
  a: number;
  b: number;
  c: number;
  /** The smallest and the largest size, in metres. */
  lo: number;
  hi: number;
  grow0: number;
  grow1: number;
  bright: number;
  first: number;
  firstSize: number;
  gain: number;
}

/** A `Stones` with its five bands set. */
function stones(o: StonesShape): Stones {
  const s = new Stones().shape(
    o.key,
    o.span * o.sr,
    o.a / o.sr,
    o.b / o.sr,
    o.c / o.sr,
    o.lo,
    Math.log(o.hi / o.lo),
    o.grow0,
    o.grow1,
    o.bright,
    o.first,
    o.firstSize,
  );
  const bands = [s.b0, s.b1, s.b2, s.b3, s.b4];
  STONE_BANDS.forEach((band, i) => {
    const b = bands[i]!;
    b.set(
      svfCoef(band.hz, o.sr),
      1.2,
      Math.exp(-1 / (band.tau * o.sr)),
      band.hz / 54.6,
      band.edge,
      band.gain * o.gain,
    );
  });
  return s;
}

/** Builds the lane of `e`. The caller sets `lane.start` and `lane.end` from the sync and the length. */
export function makeLane(e: PlanEvent, o: MakeOptions): Made {
  const { sr, key } = o;
  const m = e.macros;
  const lvl = level(e);
  const j = (salt: number): number => draw(key, salt);
  let length: number;
  switch (e.kind) {
    case 'whoosh': {
      const lane = new WhooshLane();
      length = frames(e.duration ?? 0.5, sr);
      // Each take moves the start centre by up to 8 %, the end centre (the brightness) and the damping by up
      // to 10 %, and the speed of the sweep by up to 12 %.
      const f0 = 250 * (0.92 + 0.16 * j(1));
      const f1 = (800 + 6000 * m.brightness!) * (0.7 + 0.3 * e.intensity) * (0.9 + 0.2 * j(2));
      lane.whoosh = new Whoosh().shape(
        sr,
        length,
        f0,
        Math.log(f1 / f0),
        Math.min(1, m.speed! * (0.88 + 0.24 * j(4))),
        0.6 * (0.9 + 0.2 * j(3)),
        2.2 * lvl,
        key,
      );
      return { kind: 'whoosh', lane, length };
    }
    case 'impact': {
      const lane = new ImpactLane();
      // Each take moves the pitch and the depth of the pitch fall by up to 8 %, each decay and the fall's
      // rate by up to 12 %, and the noise's brightness, the click's length and each level by up to 10 %.
      const tau = (0.12 + 0.9 * m.decay!) * (0.88 + 0.24 * j(2));
      length = frames(Math.min(6 * tau, 4), sr);
      const base = (35 + 55 * (1 - m.weight!)) * (0.92 + 0.16 * j(1));
      lane.impact = new Impact().shape(
        key,
        base / sr,
        2 * (0.92 + 0.16 * j(5)),
        1 / (0.04 * (0.88 + 0.24 * j(6)) * sr),
        1 / (tau * sr),
        1 / ((0.05 + 0.25 * m.decay!) * (0.88 + 0.24 * j(4)) * sr),
        (0.04 + 0.5 * m.crack!) * (0.9 + 0.2 * j(3)),
        (24 + 96 * m.crack!) * (0.9 + 0.2 * j(7)),
        (0.6 + 0.4 * m.weight!) * lvl,
        0.9 * (0.9 + 0.2 * j(8)) * lvl,
        0.8 * m.crack! * (0.9 + 0.2 * j(9)) * lvl,
      );
      return { kind: 'impact', lane, length };
    }
    case 'shimmer': {
      const lane = new ShimmerLane();
      length = frames(e.duration ?? 1.5, sr);
      const base = (900 + 2100 * m.height!) * (0.95 + 0.1 * j(1));
      lane.shimmer = new Shimmer().shape(
        sr,
        base,
        2 + 4 * m.density!,
        1 / (0.6 * sr),
        1 / (0.004 * sr),
        0.3 * lvl,
      );
      return { kind: 'shimmer', lane, length };
    }
    case 'riser': {
      const lane = new RiserLane();
      length = frames(e.duration ?? 2.5, sr);
      // The swell rises over the fraction 0.5 + 0.5 * length of the duration and holds for the rest.
      const rise = Math.max(1, Math.round(length * (0.5 + 0.5 * m.length!)));
      const f0 = 200;
      const f1 = 600 + 2800 * m.pitch!;
      const c1 = 1500 + 4500 * m.pitch!;
      lane.riser = new Riser().shape(
        sr,
        rise,
        f0 / sr,
        Math.log(f1 / f0),
        400,
        Math.log(c1 / 400),
        0.3 * lvl,
        3 * lvl,
        key,
      );
      return { kind: 'riser', lane, length };
    }
    case 'wind': {
      const lane = new WindLane();
      length = frames(e.duration ?? 4, sr);
      const fade = Math.min(1.5 * sr, length / 3);
      lane.wind = new Wind().shape(
        sr,
        length,
        fade,
        450 * (0.9 + 0.2 * j(1)),
        0.8,
        0.1 + 0.5 * m.gust!,
        0.1 + 0.8 * m.gust!,
        0.1 + 0.9 * m.howl!,
        lvl,
        0.08 + 0.2 * m.gust!,
        0.05 + 0.15 * m.gust!,
        j(2),
        key,
      );
      return { kind: 'wind', lane, length };
    }
    case 'drone': {
      const lane = new DroneLane();
      length = frames(e.duration ?? 6, sr);
      const fade = Math.min(1.5 * sr, length / 3);
      const f = (41 + 70 * m.pitch!) * (0.99 + 0.02 * j(1));
      lane.drone = new Drone().shape(
        sr,
        length,
        fade,
        f,
        0.003 + 0.004 * j(2),
        120 + 1500 * (1 - m.darkness!),
        lvl,
      );
      return { kind: 'drone', lane, length };
    }
    case 'footstep': {
      const lane = new FootstepLane();
      // Each take moves the thud's pitch by up to 8 %, the grain lengths by up to 12 %, the crunch's
      // band by up to 10 %, the pace by up to 12 % and the thud's weight by up to 25 %.
      const pace = (1.3 - 0.6 * m.pace!) * (0.88 + 0.24 * j(26));
      const pitch = 0.92 + 0.16 * j(21);
      const band = 0.9 + 0.2 * j(24);
      const thudLen = 0.88 + 0.24 * j(22);
      const crunchLen = 0.88 + 0.24 * j(25);
      const thud = new Cloud(sr)
        .density(100)
        .lengths(0.04 * thudLen, 0.09 * thudLen)
        .pitches(50 * pitch, (90 + 120 * (1 - m.weight!)) * pitch)
        .level((0.5 + 0.5 * m.weight!) * (0.75 + 0.5 * j(23)))
        .seed(mix32(key, 11));
      const crunch = new Cloud(sr)
        .density(60 / pace)
        .lengths(0.004 * crunchLen, 0.02 * crunchLen)
        .pitches((900 + 1500 * m.surface!) * band, (2500 + 3500 * m.surface!) * band)
        .level(0.3)
        .seed(mix32(key, 12));
      // The thud takes the first three slots, the crunch the rest.
      const unit = new Footstep();
      const a = drawGrains(unit, thud, 0.03 * pace, sr, 0, 3);
      const b = drawGrains(unit, crunch, 0.08 * pace, sr, 3, 8);
      length = Math.max(a, b, 1) + 1;
      lane.footstep = fitPeak(unit, new Footstep(), length, e.intensity * KIND_PEAK);
      return { kind: 'footstep', lane, length };
    }
    case 'cloth': {
      const lane = new ClothLane();
      // Each take moves the band by up to 10 %, the grain lengths by up to 12 %, the window by up to
      // 12 % and the lowpass (the brightness) by up to 10 %.
      const window = 0.3 * (1.3 - 0.8 * m.speed!) * (0.88 + 0.24 * j(31));
      const band = 0.9 + 0.2 * j(32);
      const len = 0.88 + 0.24 * j(33);
      const cloud = new Cloud(sr)
        .density(8 / window)
        .lengths(0.01 * len, 0.04 * len)
        .pitches((1500 + 2500 * m.fabric!) * band, (4000 + 4000 * m.fabric!) * band)
        .level(0.15)
        .seed(mix32(key, 13));
      const unit = new Cloth();
      unit.lp.k = (0.6 - 0.4 * m.fabric!) * (0.9 + 0.2 * j(34));
      length = drawGrains(unit, cloud, window, sr, 0, 8) + 1;
      const fresh = new Cloth();
      fresh.lp.k = unit.lp.k;
      lane.cloth = fitPeak(unit, fresh, length, e.intensity * KIND_PEAK);
      return { kind: 'cloth', lane, length };
    }
    case 'crack': {
      const lane = new CrackLane();
      // A block of 0.05 to 2 m. Each take moves the size by up to 8 % and the dry edge by up to 10 %.
      // `crumble` is the smaller cracks that follow the first: up to 90 a second at the start, each
      // 0.15 to 0.5 of the size, thinning to none over the duration.
      const size = 0.05 * 40 ** m.size! * (0.92 + 0.16 * j(1));
      const span = e.duration ?? 0.3 + 0.5 * size;
      length = frames(span + STONE_TAIL, sr);
      lane.stones = stones({
        key,
        sr,
        span,
        a: 0,
        b: 0,
        c: 90 * m.crumble!,
        lo: 0.15 * size,
        hi: 0.5 * size,
        grow0: 1,
        grow1: 0,
        bright: 0.8 * m.brightness! * (0.9 + 0.2 * j(2)),
        first: size ** 1.5,
        firstSize: size,
        gain: lvl / size ** 1.5,
      });
      return { kind: 'crack', lane, length };
    }
    case 'boom': {
      const lane = new BoomLane();
      // The pitch runs from 140 Hz (small) to 56 Hz (large), the decay from 0.12 to 1.2 s. Each take
      // moves the pitch by up to 6 % and the decay by up to 10 %.
      const f = 140 * 0.4 ** m.size! * (0.94 + 0.12 * j(1));
      const tau = 0.12 * 10 ** m.decay! * (0.9 + 0.2 * j(2));
      const tone = 0.6 * m.tone!;
      length = frames(Math.min(7 * tau, 4), sr);
      lane.boom = new Boom().shape(
        key,
        svfCoef(0.9 * f, sr),
        1.4,
        f / sr,
        0.08,
        1 / (0.6 * tau * sr),
        1 / (tau * sr),
        0.006 * sr,
        12.9 * (1 - tone) * lvl,
        tone * lvl,
      );
      return { kind: 'boom', lane, length };
    }
    case 'rubble': {
      const lane = new RubbleLane();
      // Blocks around 0.05 to 1.5 m, from 0.45 to 1.5 of that size, 2 to 80 impacts a second at the
      // most. `swell` at 0.5 holds the rate; under it the mass thins to a tenth, over it the mass
      // grows from a tenth and its blocks from a third of their size. Each take moves the size by up to 8 %.
      const centre = 0.05 * 30 ** m.size! * (0.92 + 0.16 * j(1));
      const hi = 1.5 * centre;
      const span = e.duration ?? 1;
      length = frames(span + STONE_TAIL, sr);
      const most = 2 * 40 ** m.density!;
      const s = 2 * m.swell! - 1;
      lane.stones = stones({
        key,
        sr,
        span,
        a: most * (1 - 0.9 * Math.abs(s)),
        b: s > 0 ? most * 0.9 * s : 0,
        c: s < 0 ? most * 0.9 * -s : 0,
        lo: 0.45 * centre,
        hi,
        grow0: s > 0 ? 1 - 0.65 * s : 1,
        grow1: s > 0 ? 0.65 * s : 0,
        bright: 0.8 * m.brightness! * (0.9 + 0.2 * j(2)),
        first: 0,
        firstSize: centre,
        // The largest block sets the scale, and a dense mass is held back: its impacts lie on one another.
        gain: lvl / (hi ** 1.5 * Math.sqrt(1 + 0.12 * most)),
      });
      return { kind: 'rubble', lane, length };
    }
    case 'roar': {
      const lane = new RoarLane();
      length = frames(e.duration ?? 1, sr);
      const top = 0.4 + 1.2 * m.brightness!;
      const move = 2 * m.motion!;
      const roar = new Roar().shape(key, length, 0.025 * sr, 1 - 0.8 * m.swell!, 0.65, lvl);
      const bands = [roar.b0, roar.b1, roar.b2, roar.b3];
      ROAR_BANDS.forEach((band, i) => {
        const g = i === 2 ? top : i === 3 ? top * top : 1;
        bands[i]!.set(
          svfCoef(band.hz, sr),
          band.damp,
          band.gain * g,
          band.depth * move,
          band.rate / sr,
        );
      });
      lane.roar = roar;
      return { kind: 'roar', lane, length };
    }
    default: {
      // voice: the stem's own length, at the event's level.
      const lane = new VoiceLane();
      lane.stem = new Stem().shape(lvl);
      length = o.stem === undefined ? frames(e.duration ?? 0, sr) : o.stem.length;
      return { kind: 'voice', lane, length };
    }
  }
}
