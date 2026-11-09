// The host half of the kinds: it turns one plan event into one `Cue` (`cue.shade.ts`). The macros
// of docs/sound-design-loop.md, "The kinds", become the numbers of each unit's `shape`. Every
// draw is a function of the event's key (a hash of the seed and the event's id), so an edit to one
// event changes that event only, even when it moves the event in the sorted list, and two
// events of one kind differ through their keys (the `variation` dimension).

import type { PlanEvent } from '../plan/types.ts';
import { Cloud, Grain } from '../units/grain.shade.ts';
import { Cue } from './cue.shade.ts';
import { Whoosh } from './whoosh.shade.ts';
import { Impact } from './impact.shade.ts';
import { Shimmer } from './shimmer.shade.ts';
import { Riser } from './riser.shade.ts';
import { Wind } from './wind.shade.ts';
import { Drone } from './drone.shade.ts';
import { Footstep } from './footstep.shade.ts';
import { Cloth } from './cloth.shade.ts';
import { Stem } from './voice.shade.ts';

/** The kinds in the order of `Cue.kind`. */
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
 * The gain that brings each kind's peak, at intensity 1, to about 0.5 before the spatial chain
 * (measured on the fixture plan, 2026-11-09). The loudness of the mix is set by the master, so
 * these only set how the kinds sit against one another.
 */
export const KIND_GAIN: Record<string, number> = {
  whoosh: 0.38,
  impact: 0.36,
  shimmer: 0.7,
  riser: 0.17,
  wind: 0.35,
  drone: 0.4,
  footstep: 0.45,
  cloth: 5.5,
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

export interface Made {
  cue: Cue;
  /** How many frames the sound lasts. */
  length: number;
}

export interface MakeOptions {
  sr: number;
  /** The event's key (`eventKey`). */
  key: number;
  /** The event's input stem, for `voice`. */
  stem?: Float32Array;
}

const frames = (seconds: number, sr: number): number => Math.max(1, Math.round(seconds * sr));

/**
 * Draws grains of `cloud` over `window` seconds into the slots `from` to `to` of `unit`, at least
 * one; returns the last frame.
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

/** Builds the cue of `e`. The caller sets `cue.start` and `cue.end` from the sync and the length. */
export function makeCue(e: PlanEvent, o: MakeOptions): Made {
  const { sr, key } = o;
  const m = e.macros;
  const lvl = level(e);
  const j = (salt: number): number => draw(key, salt);
  const cue = new Cue();
  cue.kind = KIND_INDEX[e.kind as keyof typeof KIND_INDEX] ?? 0;
  let length: number;
  switch (e.kind) {
    case 'whoosh': {
      length = frames((e.duration ?? 0.5) * (1.25 - 0.5 * m.speed!), sr);
      const f0 = 250 * (0.9 + 0.2 * j(1));
      const f1 = (800 + 6000 * m.brightness!) * (0.7 + 0.3 * e.intensity);
      cue.whoosh = new Whoosh().shape(
        sr,
        length,
        f0,
        Math.log(f1 / f0),
        m.speed!,
        0.6,
        2.2 * lvl,
        key,
      );
      break;
    }
    case 'impact': {
      const tau = 0.12 + 0.9 * m.decay!;
      length = frames(Math.min(6 * tau, 4), sr);
      const base = (35 + 55 * (1 - m.weight!)) * (0.94 + 0.12 * j(1));
      cue.impact = new Impact().shape(
        key,
        base / sr,
        2,
        1 / (0.04 * sr),
        1 / (tau * sr),
        1 / ((0.05 + 0.25 * m.decay!) * sr),
        0.04 + 0.5 * m.crack!,
        24 + 96 * m.crack!,
        (0.6 + 0.4 * m.weight!) * lvl,
        0.9 * lvl,
        0.8 * m.crack! * lvl,
      );
      break;
    }
    case 'shimmer': {
      length = frames(e.duration ?? 1.5, sr);
      const base = (900 + 2100 * m.height!) * (0.95 + 0.1 * j(1));
      cue.shimmer = new Shimmer().shape(
        sr,
        base,
        2 + 4 * m.density!,
        1 / (0.6 * sr),
        1 / (0.004 * sr),
        0.3 * lvl,
      );
      break;
    }
    case 'riser': {
      length = frames((e.duration ?? 2.5) * (0.5 + 0.5 * m.length!), sr);
      const f0 = 200;
      const f1 = 600 + 2800 * m.pitch!;
      const c1 = 1500 + 4500 * m.pitch!;
      cue.riser = new Riser().shape(
        sr,
        length,
        f0 / sr,
        Math.log(f1 / f0),
        400,
        Math.log(c1 / 400),
        0.3 * lvl,
        3 * lvl,
        key,
      );
      break;
    }
    case 'wind': {
      length = frames(e.duration ?? 4, sr);
      const fade = Math.min(1.5 * sr, length / 3);
      cue.wind = new Wind().shape(
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
      break;
    }
    case 'drone': {
      length = frames(e.duration ?? 6, sr);
      const fade = Math.min(1.5 * sr, length / 3);
      const f = (41 + 70 * m.pitch!) * (0.99 + 0.02 * j(1));
      cue.drone = new Drone().shape(
        sr,
        length,
        fade,
        f,
        0.003 + 0.004 * j(2),
        120 + 1500 * (1 - m.darkness!),
        lvl,
      );
      break;
    }
    case 'footstep': {
      const pace = 1.3 - 0.6 * m.pace!;
      const thud = new Cloud(sr)
        .density(100)
        .lengths(0.04, 0.09)
        .pitches(50, 90 + 120 * (1 - m.weight!))
        .level((0.5 + 0.5 * m.weight!) * lvl)
        .seed(mix32(key, 11));
      const crunch = new Cloud(sr)
        .density(60 / pace)
        .lengths(0.004, 0.02)
        .pitches(900 + 1500 * m.surface!, 2500 + 3500 * m.surface!)
        .level(0.3 * lvl)
        .seed(mix32(key, 12));
      // The thud takes the first three slots, the crunch the rest.
      const unit = new Footstep();
      const a = drawGrains(unit, thud, 0.03 * pace, sr, 0, 3);
      const b = drawGrains(unit, crunch, 0.08 * pace, sr, 3, 8);
      cue.footstep = unit;
      length = Math.max(a, b, 1) + 1;
      break;
    }
    case 'cloth': {
      const window = 0.3 * (1.3 - 0.8 * m.speed!);
      const cloud = new Cloud(sr)
        .density(8 / window)
        .lengths(0.01, 0.04)
        .pitches(1500 + 2500 * m.fabric!, 4000 + 4000 * m.fabric!)
        .level(0.15 * lvl)
        .seed(mix32(key, 13));
      const unit = new Cloth();
      unit.lp.k = 0.6 - 0.4 * m.fabric!;
      length = drawGrains(unit, cloud, window, sr, 0, 8) + 1;
      cue.cloth = unit;
      break;
    }
    default: {
      // voice: the stem's own length, at the event's level.
      length = o.stem === undefined ? frames(e.duration ?? 0, sr) : o.stem.length;
      cue.stem = new Stem().shape(lvl);
    }
  }
  return { cue, length };
}
