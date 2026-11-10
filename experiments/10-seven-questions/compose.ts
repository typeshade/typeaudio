// A module made from the store: accepted sounds, joined through effect nodes on a bed.
//
// The first render of the stone module (module-1.json) built stone from physics. The owner heard it
// as nearer to stone, but less natural than prototype 3b of experiment 9: the engine's own hit on the
// wall, two octaves lower, as the landing. This file makes that prototype a tool: a sound takes an
// accepted definition from the store by its name, and effects lie on it as nodes.

import { ROOMS, SAMPLE_RATE, pitched, roomOf } from './definitions.ts';
import { renderEntry, renderParts, type Stereo } from './store.ts';
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
}

export interface Composition {
  readonly module: string;
  readonly note: string;
  /** The bed: a whole plan from the store, and the picture second where its clip starts. */
  readonly bed: { readonly store: string; readonly from: number };
  /** The sound that leads, in the bed: its level is the 0 dB of `why.under`. */
  readonly reference: { readonly at: number; readonly length: number };
  readonly sounds: readonly StoredSound[];
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

/** The composition: the bed, every stored sound at its second and level, and the ceiling. */
export async function compose(c: Composition): Promise<Stereo> {
  const bed = await renderEntry(c.bed.store);
  const out = bed.map((x) => x.slice()) as unknown as Stereo;
  const ref = rms(
    bed,
    Math.round((c.reference.at - c.bed.from) * SAMPLE_RATE),
    Math.round((c.reference.at + c.reference.length - c.bed.from) * SAMPLE_RATE),
  );
  for (const sound of c.sounds) {
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
    const gain = (ref / (own || 1)) * 10 ** (-sound.why.under / 20);
    const at = Math.round((sound.when.at - front - c.bed.from) * SAMPLE_RATE);
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < made[k]!.length && at + i < out[k]!.length; i++)
        if (at + i >= 0) out[k]![at + i]! += gain * made[k]![i]!;
  }
  // The ceiling: the engine's limiter (src/master.ts), at -1 dBFS. It lowers only the moments
  // that pass the ceiling, so a loud landing does not lower the whole passage.
  const gain = limiterGain(out, SAMPLE_RATE, -1);
  for (const x of out) for (let i = 0; i < x.length; i++) x[i]! *= gain[i]!;
  return out;
}
