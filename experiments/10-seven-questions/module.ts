// A module of experiment 10: sounds stated as seven answers, and their render to a stereo clip.

import {
  MATERIALS,
  ROOMS,
  SAMPLE_RATE,
  renderContact,
  roomOf,
  saturated,
  scaled,
  type Body,
  type ContactNumbers,
  type Failure,
  type Result,
} from './definitions.ts';

export interface BodyAnswer {
  readonly material: string;
  readonly form: 'block' | 'slab';
  readonly size: readonly [number, number, number];
}

/** One sound as seven answers. */
export interface Sound {
  readonly id: string;
  /** Who: the thing that moves. */
  readonly who: BodyAnswer;
  /** What: the thing that is met. */
  readonly what: BodyAnswer;
  /** How: the gesture. This module has one, `hit`. */
  readonly how: 'hit';
  /** How much: the speed, and the result that the drawing shows. */
  readonly howMuch: {
    readonly speed: number;
    readonly result: Result;
    /** The volume that the drawing shows as broken, m³. */
    readonly broken?: number;
    readonly failures?: readonly Failure[];
  };
  /** When: the second of the picture. */
  readonly when: { readonly at: number };
  /** Where: metres to the right, up and away from the camera. */
  readonly where: readonly [number, number, number];
  /** Why: the part the sound plays, and its top in dB under the sound that leads. */
  readonly why: {
    readonly part: 'leads' | 'explains' | 'hints' | 'rings on';
    readonly under: number;
  };
}

export interface Module {
  readonly module: string;
  readonly clip: { readonly from: number; readonly to: number };
  readonly room: string;
  readonly style: {
    /** The bodies of the drawing over the bodies that are computed: 2 is twice as large. */
    readonly size: number;
    /** The drive into the soft limit before the ceiling. */
    readonly density: number;
  };
  readonly seed: number;
  readonly sounds: readonly Sound[];
}

export interface ModuleRender {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly numbers: Readonly<Record<string, ContactNumbers>>;
  /** The top of each sound as physics gives it, dB under the loudest. The mix does not use it. */
  readonly levels: Readonly<Record<string, number>>;
}

const bodyOf = (answer: BodyAnswer, size: number): Body => {
  const material = MATERIALS[answer.material];
  if (!material) throw new Error(`no material "${answer.material}"`);
  return scaled({ material, form: answer.form, size: answer.size }, size);
};

/** The clip of a module: every sound at its second, in its place, in the room, at -1 dBFS. */
export function renderModule(module: Module): ModuleRender {
  const room = ROOMS[module.room];
  if (!room) throw new Error(`no room "${module.room}"`);
  const n = Math.round((module.clip.to - module.clip.from) * SAMPLE_RATE);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const dry = new Float32Array(n);
  const numbers: Record<string, ContactNumbers> = {};
  const tops: Record<string, number> = {};
  const lead = 0.01;
  module.sounds.forEach((sound, index) => {
    const start = sound.when.at - module.clip.from - lead;
    const seconds = module.clip.to - module.clip.from - start;
    const made = renderContact(
      {
        striker: bodyOf(sound.who, module.style.size),
        struck: bodyOf(sound.what, module.style.size),
        speed: sound.howMuch.speed,
        result: sound.howMuch.result,
        broken: sound.howMuch.broken && sound.howMuch.broken * module.style.size ** 3,
        failures: sound.howMuch.failures,
      },
      seconds,
      module.seed + 100 * index,
      lead,
    );
    numbers[sound.id] = made.numbers;
    const [x, y, z] = sound.where;
    const distance = Math.hypot(x, y, z);
    const angle = Math.atan2(x, z);
    const pan = Math.max(-1, Math.min(1, angle / (Math.PI / 4)));
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) / distance;
    const gr = Math.sin(((pan + 1) * Math.PI) / 4) / distance;
    const offset = Math.round(start * SAMPLE_RATE);
    let top = 1e-20;
    for (const v of made.samples) top = Math.max(top, Math.abs(v));
    // Physics gives the timbre of a sound. Its part in the moment gives its level.
    const level = (10 ** (-sound.why.under / 20) * distance) / top;
    for (let i = 0; i < made.samples.length; i++) {
      const at = offset + i;
      if (at < 0 || at >= n) continue;
      const v = level * made.samples[i]!;
      left[at]! += gl * v;
      right[at]! += gr * v;
      dry[at]! += v / distance;
    }
    top /= distance;
    tops[sound.id] = top;
  });
  const [wl, wr] = roomOf(dry, room);
  let peak = 1e-20;
  for (let i = 0; i < n; i++) {
    left[i]! += wl[i]!;
    right[i]! += wr[i]!;
    peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  }
  const ceiling = 10 ** (-1 / 20);
  const finish = (channel: Float32Array): Float32Array => {
    const unit = channel.map((v) => v / peak);
    return saturated(unit, module.style.density).map((v) => v * ceiling);
  };
  const loudest = Math.max(...Object.values(tops), 1e-20);
  const levels = Object.fromEntries(
    Object.entries(tops).map(([id, top]) => [id, 20 * Math.log10(Math.max(top, 1e-20) / loudest)]),
  );
  return { left: finish(left), right: finish(right), numbers, levels };
}
