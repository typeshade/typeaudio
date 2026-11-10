// The definitions of experiment 10: a material, a body, a contact, an effect.

import { describe, expect, it } from 'vitest';
import {
  MATERIALS,
  contactNumbers,
  mass,
  modesOf,
  highPassed,
  pitched,
  renderContact,
  scaled,
  type Body,
  type Contact,
} from '../experiments/10-seven-questions/definitions.ts';

const stone = MATERIALS.stone!;
const flesh = MATERIALS.flesh!;
const block: Body = { material: stone, form: 'block', size: [2, 1.6, 1.4] };
const floor: Body = { material: stone, form: 'slab', size: [30, 20, 0.8] };
const wall: Body = { material: stone, form: 'slab', size: [12, 8, 0.6] };
const person: Body = { material: flesh, form: 'block', size: [0.4, 1.6, 0.12] };
const landing: Contact = { striker: block, struck: floor, speed: 12, result: 'crack', broken: 0.3 };

const energy = (x: Float32Array): number => x.reduce((sum, v) => sum + v * v, 0);

describe('a body', () => {
  it('has the same modes for the same seed', () => {
    expect(modesOf(block, 3)).toEqual(modesOf(block, 3));
    expect(modesOf(block, 3)).not.toEqual(modesOf(block, 4));
  });

  it('is lower and longer by one ratio when it is larger', () => {
    const small = modesOf(block, 3);
    // The band that is kept moves with the body, so the two sets hold the same modes.
    const large = modesOf(scaled(block, 2), 3, { fmin: 12.5, fmax: 4500 });
    expect(large.length).toBe(small.length);
    small.forEach((mode, i) => {
      expect(large[i]!.f / mode.f).toBeCloseTo(0.5, 6);
      // The loss grows with the frequency, so the lower mode lasts more than twice as long.
      expect(large[i]!.tau).toBeGreaterThan(2 * mode.tau);
    });
  });

  it('of stone has many modes at no regular places, and the high ones die first', () => {
    const modes = modesOf(wall, 3);
    expect(modes.length).toBeGreaterThan(100);
    const steps = modes.slice(1).map((mode, i) => mode.f - modes[i]!.f);
    expect(new Set(steps.map((s) => s.toFixed(3))).size).toBeGreaterThan(steps.length / 2);
    expect(modes[0]!.tau).toBeGreaterThan(10 * modes[modes.length - 1]!.tau);
  });
});

describe('a contact', () => {
  it('of a heavy block is long, because the stone is crushed', () => {
    const n = contactNumbers(landing);
    expect(mass(block)).toBeGreaterThan(10000);
    expect(n.time).toBeGreaterThan(0.01);
    expect(n.exaggeration).toBeCloseTo(1, 6);
  });

  it('that the drawing shows as a break gets the force that breaks, and reports the ratio', () => {
    const base = { striker: person, struck: wall, speed: 40 };
    const mark = contactNumbers({ ...base, result: 'mark' });
    const brk = contactNumbers({ ...base, result: 'break', broken: 5 });
    expect(mark.exaggeration).toBe(1);
    expect(mark.pieces).toBe(0);
    expect(brk.exaggeration).toBeGreaterThan(10);
    expect(brk.time).toBeLessThan(mark.time / 10);
    expect(brk.pieces).toBeGreaterThan(1000);
    // Flesh has no ring, and it is not crushed into pieces.
    expect(brk.rings[0]).toBe(0);
    expect(brk.crushed).toBe(0);
  });

  it('renders the same sound for the same seed, and no sound before the contact', () => {
    const a = renderContact(landing, 0.5, 7, 0.05);
    const b = renderContact(landing, 0.5, 7, 0.05);
    expect(a.samples).toEqual(b.samples);
    expect(energy(a.samples.subarray(0, 2300))).toBe(0);
    expect(energy(a.samples)).toBeGreaterThan(0);
    expect(a.samples.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('is its pulse and its breaks, and a mark has no breaks', () => {
    const pulse = renderContact(landing, 0.3, 7, 0.01, 'pulse').samples;
    const breaks = renderContact(landing, 0.3, 7, 0.01, 'breaks').samples;
    const all = renderContact(landing, 0.3, 7, 0.01).samples;
    all.forEach((v, i) =>
      expect(v).toBeCloseTo(pulse[i]! + breaks[i]!, 3 - Math.log10(1 + Math.abs(v))),
    );
    const mark = renderContact({ ...landing, result: 'mark' }, 0.3, 7, 0.01, 'breaks').samples;
    expect(energy(mark)).toBe(0);
  });
});

describe('a support and a gesture', () => {
  it('a wall in a building rings shorter than the same slab when it is free', () => {
    const free = modesOf({ ...wall, support: 'free' }, 3);
    const built = modesOf({ ...wall, support: 'built' }, 3);
    const longest = (modes: readonly { tau: number }[]): number =>
      Math.max(...modes.map((m) => m.tau));
    expect(longest(built)).toBeLessThan(longest(free) / 5);
    // The support answers too: the built slab has more modes than the free one.
    expect(built.length).toBeGreaterThan(free.length);
  });

  it('a block that lands rings shorter than a block that hits and is free', () => {
    const free = modesOf(block, 3);
    const resting = modesOf(block, 3, { rests: 0.2 });
    resting.forEach((mode, i) => expect(mode.tau).toBeLessThan(free[i]!.tau / 2));
    const hit = renderContact({ ...landing, gesture: 'hit' }, 0.3, 7, 0.01).samples;
    const land = renderContact({ ...landing, gesture: 'land' }, 0.3, 7, 0.01).samples;
    expect(energy(land)).not.toBe(energy(hit));
  });

  it('crunch scales the roughness of a stone on stone, and a soft striker has none', () => {
    const plain = renderContact(landing, 0.5, 7, 0.01, 'pulse', 1).samples;
    const rough = renderContact(landing, 0.5, 7, 0.01, 'pulse', 20).samples;
    expect(energy(rough)).toBeGreaterThan(4 * energy(plain));
    const soft: Contact = { striker: person, struck: wall, speed: 40, result: 'mark' };
    const a = renderContact(soft, 0.3, 7, 0.01, 'pulse', 1).samples;
    const b = renderContact(soft, 0.3, 7, 0.01, 'pulse', 20).samples;
    expect(b).toEqual(a);
  });
});

describe('an effect', () => {
  it('pitch lowers and lengthens by one ratio', () => {
    const tone = Float32Array.from({ length: 4800 }, (_, i) =>
      Math.sin((2 * Math.PI * 480 * i) / 48000),
    );
    const low = pitched(tone, 0.5);
    expect(low.length).toBe(9600);
    let crossings = 0;
    for (let i = 1; i < low.length; i++) if (low[i - 1]! < 0 && low[i]! >= 0) crossings++;
    // 480 Hz for 0.1 s is 48 periods; at half the pitch they take 0.2 s.
    expect(crossings).toBeGreaterThanOrEqual(47);
    expect(crossings).toBeLessThanOrEqual(48);
  });

  it('the output high-pass takes away what lies under its frequency', () => {
    const tone = (hz: number): Float32Array =>
      Float32Array.from({ length: 48000 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / 48000));
    expect(energy(highPassed(tone(20), 40).subarray(24000))).toBeLessThan(
      0.25 * energy(tone(20).subarray(24000)),
    );
    expect(energy(highPassed(tone(400), 40).subarray(24000))).toBeGreaterThan(
      0.95 * energy(tone(400).subarray(24000)),
    );
  });
});
