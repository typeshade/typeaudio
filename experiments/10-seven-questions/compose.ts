// A module made from the store: accepted sounds, joined through effect nodes on a bed.
//
// The first render of the stone module (module-1.json) built stone from physics. The owner heard it
// as nearer to stone, but less natural than prototype 3b of experiment 9: the engine's own hit on the
// wall, two octaves lower, as the landing. This file makes that prototype a tool: a sound takes an
// accepted definition from the store by its name, and effects lie on it as nodes.

import { ROOMS, SAMPLE_RATE, pitched, random, roomOf } from './definitions.ts';
import { readEntry, renderEntry, renderParts, type Stereo } from './store.ts';
import { limiterGain } from '../../src/master.ts';

/** An effect node on a stored sound. */
export type Effect =
  /** Every frequency and every length by one ratio. */
  | { readonly pitch: number }
  /**
   * The front of a hit (its first seconds) says the material; the body says the size. The front
   * keeps the pitch `ratio` and the rest takes the pitch of the node before it.
   */
  | { readonly front: { readonly seconds: number; readonly ratio: number } }
  /**
   * A solid mass does not ring on: after the front, the sound dies with the time constant
   * `seconds`. A lowered sound rings as long as it is lowered, and a long low ring is heard as a
   * hollow box.
   */
  | { readonly damp: { readonly seconds: number } }
  /**
   * A soft limit on the sound's own peak: `drive` 0 leaves it, more adds partials and average
   * level at the same peak. A dense sound is heard as heavy (docs/sound-design-theory.md, 5).
   */
  | { readonly saturate: { readonly drive: number } }
  /** The room, after the steps before it: a room is not lowered with the sound in it. */
  | { readonly room: { readonly name: string; readonly level: number } };

/** A sound taken from the store. Its seven answers are the store entry's, moved by its effects. */
export interface StoredSound {
  readonly id: string;
  readonly from: {
    readonly store: string;
    /** The part of the entry's render that is used: from `start` for `length` seconds. */
    readonly start: number;
    readonly length: number;
    /** The fade at the end, seconds. */
    readonly fade: number;
    /** `dry`: the entry without the engine's room. `mix` (the default): with it. */
    readonly part?: 'dry' | 'mix';
  };
  readonly effects: readonly Effect[];
  /** When: the second of the picture where the front lands. */
  readonly when: { readonly at: number };
  /** Why: its part, and its level in dB under the sound that leads (`reference`). */
  readonly why: { readonly part: string; readonly under: number };
  /**
   * `plan`: the sound keeps the level its plan gave it beside the bed (both renders in the scale
   * of the engine's master), and `why.under` is dB under that. Otherwise the level is set against
   * `reference`.
   */
  readonly level?: 'plan';
  /** Where, from left (-1) to right (1); the middle when it is not given. */
  readonly pan?: number;
  /**
   * Many of this sound, of one material: each copy is a smaller body, so it is higher, shorter and
   * quieter, at its own second and place (experiment 9, findings 1 and 2: one material keeps one
   * timbre; size is pitch and length together). `when.at` is where the first may land.
   */
  readonly scatter?: {
    readonly count: number;
    /** The sizes of the copies against the stored sound's body, from the smallest to the largest. */
    readonly size: readonly [number, number];
    /** How the copies fall in time after `when.at`: the mean wait, seconds. */
    readonly spread: number;
    /** No copy lands after this picture second. */
    readonly until: number;
    /** How wide the copies lie, 0 to 1. */
    readonly width: number;
    readonly seed: number;
  };
}

/**
 * The copies of a scattered sound. A body of `s` times the size answers `1 / s` times higher and
 * `s` times as long; its level falls by 30·log10(1 / s) dB (its energy goes as its mass, its
 * radiating area as its face), and up to 4 dB more by distance. Small pieces are many: the size
 * follows a power law from the smallest to the largest.
 */
export function scattered(sound: StoredSound): StoredSound[] {
  const sc = sound.scatter;
  if (!sc) return [sound];
  const base = resolved({ ...sound, scatter: undefined });
  const rnd = random(sc.seed);
  const [small, large] = sc.size;
  const out: StoredSound[] = [];
  for (let i = 0; i < sc.count; i++) {
    // A power law: P(size > x) falls as x^-1.5 between the two sizes.
    const u = rnd();
    const a = small ** -1.5;
    const b = large ** -1.5;
    const size = (a - u * (a - b)) ** (-1 / 1.5);
    let t = sound.when.at - sc.spread * Math.log(1 - rnd());
    if (t > sc.until) t = sound.when.at + rnd() * (sc.until - sound.when.at);
    let pitchDone = false;
    const effects = base.effects.map((e): Effect => {
      if ('pitch' in e && !pitchDone) {
        pitchDone = true;
        return { pitch: e.pitch / size };
      }
      if ('damp' in e) return { damp: { seconds: Math.max(0.08, e.damp.seconds * size) } };
      return e;
    });
    out.push({
      ...base,
      id: `${sound.id}-${i}`,
      effects,
      when: { at: t },
      why: { ...base.why, under: base.why.under + 30 * Math.log10(1 / size) + 4 * rnd() },
      pan: sc.width * (2 * rnd() - 1),
      scatter: undefined,
    });
  }
  return out;
}

export interface Composition {
  readonly module: string;
  readonly note: string;
  /** The bed: a whole plan from the store, and the picture second where its clip starts. */
  readonly bed: { readonly store: string; readonly from: number };
  /** The sound that leads, in the bed: its level is the 0 dB of `why.under`. */
  readonly reference: { readonly at: number; readonly length: number };
  readonly sounds: readonly StoredSound[];
  /**
   * Silences that are whole, as the plan's: nothing sounds in them, the stored sounds included.
   * Picture seconds; each edge has a ramp of 2 ms.
   */
  readonly silences?: readonly { readonly at: number; readonly duration: number }[];
}

const rms = (x: Stereo, a: number, b: number): number => {
  let e = 0;
  let n = 0;
  for (const c of x)
    for (let i = Math.max(0, a); i < Math.min(c.length, b); i++) {
      e += c[i]! * c[i]!;
      n++;
    }
  return Math.sqrt(e / Math.max(1, n));
};

/** The stored sound through its effects. Returns the sound and where its front lies in it. */
export function shaped(source: Stereo, sound: StoredSound): { sound: Stereo; front: number } {
  const { start, length, fade } = sound.from;
  const a = Math.round(start * SAMPLE_RATE);
  const n = Math.round(length * SAMPLE_RATE);
  const f = Math.round(fade * SAMPLE_RATE);
  const cut = source.map((c) => {
    const x = c.slice(a, a + n);
    for (let i = 0; i < Math.min(96, x.length); i++) x[i]! *= i / 96;
    for (let i = 0; i < f; i++) x[n - 1 - i]! *= i / f;
    return x;
  }) as unknown as Stereo;
  let out: Stereo = cut;
  let ratio = 1;
  const lead = 0.004;
  for (const effect of sound.effects) {
    if ('pitch' in effect) {
      const before = rms(out, 0, out[0].length);
      out = out.map((c) => pitched(c, effect.pitch)) as unknown as Stereo;
      const after = rms(out, 0, out[0].length);
      out = out.map((c) => c.map((v) => (v * before) / (after || 1))) as unknown as Stereo;
      ratio *= effect.pitch;
    } else if ('damp' in effect) {
      const start = Math.round((lead / ratio + 0.03) * SAMPLE_RATE);
      const k = 1 / (effect.damp.seconds * SAMPLE_RATE);
      out = out.map((c) =>
        c.map((v, i) => (i < start ? v : v * Math.exp(-(i - start) * k))),
      ) as unknown as Stereo;
    } else if ('saturate' in effect) {
      const drive = effect.saturate.drive;
      if (drive <= 0) continue;
      let peak = 1e-20;
      for (const c of out) for (const v of c) peak = Math.max(peak, Math.abs(v));
      out = out.map((c) =>
        c.map((v) => (Math.tanh((drive * v) / peak) / Math.tanh(drive)) * peak),
      ) as unknown as Stereo;
      // The node keeps the peak, not the level: the level rises, as a soft limit's does.
    } else if ('room' in effect) {
      const room = ROOMS[effect.room.name];
      if (!room) throw new Error(`no room "${effect.room.name}"`);
      // The sound goes on for the length of the room after it ends.
      const tail = Math.round(room.decay * SAMPLE_RATE);
      const mono = new Float32Array(out[0].length + tail);
      for (let i = 0; i < out[0].length; i++) mono[i] = (out[0][i]! + out[1][i]!) / 2;
      const [wl, wr] = roomOf(mono, { ...room, level: effect.room.level });
      out = [
        wl.map((v, i) => v + (out[0][i] ?? 0)),
        wr.map((v, i) => v + (out[1][i] ?? 0)),
      ] as unknown as Stereo;
    } else {
      // The front at its own pitch, laid over the lowered body, which fades in under it.
      const keep =
        effect.front.ratio === 1
          ? cut
          : (cut.map((c) => pitched(c, effect.front.ratio)) as unknown as Stereo);
      const at = Math.round((lead / ratio - lead / effect.front.ratio) * SAMPLE_RATE);
      const len = Math.round((effect.front.seconds / effect.front.ratio) * SAMPLE_RATE);
      const tail = Math.round(0.004 * SAMPLE_RATE);
      const scale = rms(out, 0, out[0].length) / (rms(cut, 0, cut[0].length) || 1);
      out = out.map((c, k) => {
        const y = c.slice();
        const rise = Math.round((effect.front.seconds / ratio) * SAMPLE_RATE);
        for (let i = 0; i < rise && at + i < y.length; i++) y[Math.max(0, at) + i]! *= i / rise;
        for (let i = 0; i < len + tail && at + i < y.length; i++) {
          if (at + i < 0) continue;
          const w = i < len ? 1 : 1 - (i - len) / tail;
          y[at + i]! += w * keep[k]![i]! * scale;
        }
        return y;
      }) as unknown as Stereo;
    }
  }
  return { sound: out, front: lead / ratio };
}

/**
 * A sound whose `from.store` names an accepted sound of the store takes that sound's `from` and
 * its effects, and its own effects follow them.
 */
export function resolved(sound: StoredSound): StoredSound {
  const entry = readEntry(sound.from.store);
  if (!entry.sound) return sound;
  const inner = resolved({
    ...sound,
    from: entry.sound.from as StoredSound['from'],
    effects: entry.sound.effects as StoredSound['effects'],
  });
  return { ...inner, effects: [...inner.effects, ...sound.effects] };
}

/** The composition: the bed, every stored sound at its second and level, and the ceiling. */
export async function compose(c: Composition): Promise<Stereo> {
  const bed = await renderEntry(c.bed.store);
  const bedDb = (await renderParts(c.bed.store)).normalizeDb;
  const out = bed.map((x) => x.slice()) as unknown as Stereo;
  const ref = rms(
    bed,
    Math.round((c.reference.at - c.bed.from) * SAMPLE_RATE),
    Math.round((c.reference.at + c.reference.length - c.bed.from) * SAMPLE_RATE),
  );
  for (const sound of c.sounds.flatMap((given) => scattered(resolved(given)))) {
    const parts = await renderParts(sound.from.store);
    const source: Stereo =
      sound.from.part === 'dry'
        ? parts.dry
        : [
            parts.dry[0].map((v, i) => v + parts.wet[0][i]!),
            parts.dry[1].map((v, i) => v + parts.wet[1][i]!),
          ];
    const plain = shaped(source, { ...sound, effects: [] }).sound;
    const own = rms(plain, 0, Math.round(c.reference.length * SAMPLE_RATE));
    const { sound: made, front } = shaped(source, sound);
    const gain =
      (sound.level === 'plan' ? 10 ** ((bedDb - parts.normalizeDb) / 20) : ref / (own || 1)) *
      10 ** (-sound.why.under / 20);
    const at = Math.round((sound.when.at - front - c.bed.from) * SAMPLE_RATE);
    const pan = sound.pan ?? 0;
    const sides = [Math.min(1, 1 - pan), Math.min(1, 1 + pan)];
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < made[k]!.length && at + i < out[k]!.length; i++)
        if (at + i >= 0) out[k]![at + i]! += gain * sides[k]! * made[k]![i]!;
  }
  // The silences: whole, with a ramp of 2 ms at each edge.
  const ramp = Math.round(0.002 * SAMPLE_RATE);
  for (const silence of c.silences ?? []) {
    const a = Math.round((silence.at - c.bed.from) * SAMPLE_RATE);
    const b = Math.round((silence.at + silence.duration - c.bed.from) * SAMPLE_RATE);
    for (const x of out)
      for (let i = Math.max(0, a - ramp); i < Math.min(x.length, b + ramp); i++) {
        const edge = Math.min(i - (a - ramp), b + ramp - i) / ramp;
        x[i]! *= i >= a && i < b ? 0 : Math.max(0, 1 - Math.min(1, edge));
      }
  }
  // The ceiling: the engine's limiter (src/master.ts), at -1 dBFS. It lowers only the moments
  // that pass the ceiling, so a loud landing does not lower the whole passage.
  const gain = limiterGain(out, SAMPLE_RATE, -1);
  for (const x of out) for (let i = 0; i < x.length; i++) x[i]! *= gain[i]!;
  return out;
}
