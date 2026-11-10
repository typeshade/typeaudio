// Experiment 10: a stored sound through its effect nodes.

import { describe, expect, it } from 'vitest';
import { shaped, type StoredSound } from '../experiments/10-seven-questions/compose.ts';

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
});
