// The host half of the kinds: it turns one plan event into one lane of its kind (`lanes.shade.ts`). The macros
// of docs/sound-design-loop.md, "The kinds", become the numbers of each unit's `shape`. Every
// draw is a function of the event's key (a hash of the seed and the event's id), so an edit to one
// event changes that event only, even when it moves the event in the sorted list, and two
// events of one kind differ through their keys (the `variation` dimension).

import type { PlanEvent } from '../plan/types.ts';
import { Cloud, Grain } from '../units/grain.shade.ts';
import {
  ClothLane,
  DroneLane,
  FootstepLane,
  ImpactLane,
  RiserLane,
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

/** The kinds in the order of the `kinds` array that `gather` reads and of its `w0` to `w8`. */
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
} as const;

/**
 * The peak of an event of intensity 1 before the spatial chain. The loudness of the mix is set by
 * the master, so this only sets how the kinds sit against one another.
 */
export const KIND_PEAK = 0.5;

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
 * `peak` fields, so one measurement is enough. A measured peak that is 0 or not finite leaves the
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
    if (ok) g.peak *= scale;
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
    default: {
      // voice: the stem's own length, at the event's level.
      const lane = new VoiceLane();
      lane.stem = new Stem().shape(lvl);
      length = o.stem === undefined ? frames(e.duration ?? 0, sr) : o.stem.length;
      return { kind: 'voice', lane, length };
    }
  }
}
