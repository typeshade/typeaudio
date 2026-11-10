// Experiment 10: a stored sound through its effect nodes.

import { describe, expect, it } from 'vitest';
import {
  resolved,
  scattered,
  shaped,
  type StoredSound,
} from '../experiments/10-seven-questions/compose.ts';
import { readEntry } from '../experiments/10-seven-questions/store.ts';

const res = (s: StoredSound): StoredSound => resolved(s, readEntry);
const sca = (s: StoredSound): StoredSound[] => scattered(s, readEntry);
const SR = 48000;
// A test source: silence, then at 4 ms a click and a ring of 400 Hz that dies.
const source = (): [Float32Array, Float32Array] => {
  const x = new Float32Array(SR);
  const at = Math.round(0.004 * SR);
  x[at] = 1;
  for (let i = 1; i < SR - at; i++)
    x[at + i] = Math.exp(-i / 4800) * Math.sin((2 * Math.PI * 400 * i) / SR);
  return [x, x.slice()];
};
const sound = (effects: StoredSound['effects']): StoredSound => ({
  id: 't',
  from: { store: 'none', start: 0, length: 0.5, fade: 0.1 },
  effects,
  when: { at: 0 },
  why: { part: 'leads', under: 0 },
});
const energy = (x: Float32Array, a = 0, b = x.length): number => {
  let e = 0;
  for (let i = a; i < b; i++) e += x[i]! * x[i]!;
  return e;
};

describe('a stored sound through its effects', () => {
  it('with no effect is the cut of the source, with its front at 4 ms', () => {
    const { sound: s, front } = shaped(source(), sound([]));
    expect(s[0].length).toBe(0.5 * SR);
    expect(front).toBeCloseTo(0.004, 9);
  });

  it('two octaves lower is four times as long, keeps its level, and its front moves', () => {
    const plain = shaped(source(), sound([])).sound;
    const { sound: s, front } = shaped(source(), sound([{ pitch: 0.25 }]));
    expect(s[0].length).toBe(2 * SR);
    expect(front).toBeCloseTo(0.016, 9);
    const level = (x: Float32Array): number => energy(x) / x.length;
    expect(level(s[0])).toBeCloseTo(level(plain[0]), 6);
  });

  it('a front node adds the front at its own pitch over the lowered body', () => {
    const low = shaped(source(), sound([{ pitch: 0.25 }])).sound;
    const withFront = shaped(
      source(),
      sound([{ pitch: 0.25 }, { front: { seconds: 0.015, ratio: 0.5 } }]),
    ).sound;
    expect(withFront[0].length).toBe(low[0].length);
    // The first 40 ms change; the body after 0.2 s does not.
    const a = Math.round(0.2 * SR);
    expect(energy(withFront[0], a)).toBeCloseTo(energy(low[0], a), 6);
    expect(energy(withFront[0], 0, Math.round(0.04 * SR))).not.toBeCloseTo(
      energy(low[0], 0, Math.round(0.04 * SR)),
      3,
    );
  });

  it('damp ends a lowered body sooner and keeps its front', () => {
    const low = shaped(source(), sound([{ pitch: 0.25 }])).sound;
    const damped = shaped(source(), sound([{ pitch: 0.25 }, { damp: { seconds: 0.1 } }])).sound;
    const front = Math.round(0.04 * SR);
    expect(energy(damped[0], 0, front)).toBeCloseTo(energy(low[0], 0, front), 9);
    const tail = Math.round(0.5 * SR);
    expect(energy(damped[0], tail)).toBeLessThan(0.01 * energy(low[0], tail));
  });

  it('a room after the pitch makes the sound longer by the room, and is not lowered', () => {
    const low = shaped(source(), sound([{ pitch: 0.25 }])).sound;
    const roomed = shaped(
      source(),
      sound([{ pitch: 0.25 }, { room: { name: 'hall', level: -8 } }]),
    ).sound;
    expect(roomed[0].length).toBe(low[0].length + Math.round(2.4 * SR));
    expect(energy(roomed[0], low[0].length)).toBeGreaterThan(0);
  });

  it('saturate keeps the peak and raises the level; drive 0 leaves the sound', () => {
    const low = shaped(source(), sound([{ pitch: 0.25 }])).sound;
    const hot = shaped(source(), sound([{ pitch: 0.25 }, { saturate: { drive: 3 } }])).sound;
    const none = shaped(source(), sound([{ pitch: 0.25 }, { saturate: { drive: 0 } }])).sound;
    const peak = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(hot[0])).toBeCloseTo(peak(low[0]), 6);
    expect(energy(hot[0])).toBeGreaterThan(1.5 * energy(low[0]));
    expect(none[0]).toEqual(low[0]);
  });
});

describe('the store', () => {
  it('an accepted sound is used by its name: it takes its source and its effects', () => {
    const r = res({
      id: 'land',
      from: { store: 'stone-landing', start: 0, length: 0, fade: 0 },
      effects: [{ pitch: 0.9 }],
      when: { at: 0 },
      why: { part: 'leads', under: 0 },
    });
    expect(r.from.store).toBe('wall-hit');
    expect(r.from.part).toBe('dry');
    expect(r.effects.map((e) => Object.keys(e)[0])).toEqual([
      'pitch',
      'front',
      'damp',
      'saturate',
      'room',
      'pitch',
    ]);
  });

  it('a scattered sound is many copies of one material: smaller is higher, shorter and quieter', () => {
    const copies = sca(
      res({
        id: 'rubble',
        from: { store: 'stone-landing', start: 0, length: 0, fade: 0 },
        effects: [],
        when: { at: 10 },
        why: { part: 'explains', under: 0 },
        scatter: { count: 30, size: [0.12, 0.6], spread: 0.4, until: 11, width: 0.8, seed: 4 },
      }),
    );
    expect(copies).toHaveLength(30);
    for (const c of copies) {
      const pitch = (c.effects[0] as { pitch: number }).pitch;
      // The stored landing is two octaves down; a smaller copy is higher, by 1 / size.
      expect(pitch).toBeGreaterThan(0.25 / 0.6 - 1e-9);
      expect(pitch).toBeLessThan(0.25 / 0.12 + 1e-9);
      expect(c.when.at).toBeGreaterThanOrEqual(10);
      expect(c.when.at).toBeLessThanOrEqual(11);
      expect(Math.abs(c.pan!)).toBeLessThanOrEqual(0.8);
      // The level follows the size: 30·log10(1 / size) dB under, and up to 4 dB more.
      const size = 0.25 / pitch;
      expect(c.why.under).toBeGreaterThanOrEqual(30 * Math.log10(1 / size) - 1e-9);
      expect(c.why.under).toBeLessThanOrEqual(30 * Math.log10(1 / size) + 4);
    }
    // Small pieces are many: more than half are under a third of the largest size.
    expect(
      copies.filter((c) => 0.25 / (c.effects[0] as { pitch: number }).pitch < 0.2).length,
    ).toBeGreaterThan(15);
  });

  it('a scatter with power 0 spreads the sizes evenly', () => {
    const copies = sca(
      res({
        id: 'blocks',
        from: { store: 'stone-landing', start: 0, length: 0, fade: 0 },
        effects: [],
        when: { at: 10 },
        why: { part: 'explains', under: 0 },
        scatter: {
          count: 200,
          size: [0.5, 1],
          power: 0,
          spread: 0.4,
          until: 11,
          width: 1,
          seed: 7,
        },
      }),
    );
    const sizes = copies.map((c) => 0.25 / (c.effects[0] as { pitch: number }).pitch);
    const upper = sizes.filter((x) => x > 0.75).length;
    expect(upper).toBeGreaterThan(70);
    expect(upper).toBeLessThan(130);
  });

  it('large-first lands the copies from the largest to the smallest', () => {
    const copies = sca(
      res({
        id: 'blocks',
        from: { store: 'stone-landing', start: 0, length: 0, fade: 0 },
        effects: [],
        when: { at: 10 },
        why: { part: 'explains', under: 0 },
        scatter: {
          count: 40,
          size: [0.2, 1],
          spread: 0.4,
          until: 11,
          width: 1,
          seed: 7,
          order: 'large-first',
        },
      }),
    );
    const bySize = [...copies].sort(
      (p, q) =>
        (p.effects[0] as { pitch: number }).pitch - (q.effects[0] as { pitch: number }).pitch,
    );
    const times = bySize.map((c) => c.when.at);
    expect(times).toEqual([...times].sort((p, q) => p - q));
  });
});
