import { describe, expect, test } from 'vitest';
import { compareMixes } from '../experiments/08-sound-design/across.ts';

// The runner of experiment 8 holds a page tier's mix to the CPU tier's. The master scales each
// render by the loudness of its own length, so the comparison needs two renders of the same blocks.

/** A stereo mix of `frames` frames, left then right: a ramp scaled by `gain`. */
const mix = (frames: number, gain: number): Float32Array =>
  Float32Array.from({ length: 2 * frames }, (_, i) => gain * ((i % frames) / frames - 0.5));

describe('compareMixes', () => {
  test('counts no difference between equal mixes', () => {
    const a = mix(100, 0.5);
    expect(compareMixes(a, 100, Float32Array.from(a), 100)).toEqual({
      frames: 100,
      values: 200,
      differ: 0,
      largest: 0,
      peak: 0.25,
      relativeRms: 0,
    });
  });

  test('counts the values that differ, and the largest difference', () => {
    const a = mix(100, 0.5);
    const b = Float32Array.from(a);
    b[3] += 0.125;
    b[150] -= 0.25;
    const d = compareMixes(b, 100, a, 100);
    expect('skipped' in d).toBe(false);
    if ('skipped' in d) return;
    expect(d.differ).toBe(2);
    expect(d.largest).toBe(0.25);
  });

  test('refuses two mixes of different lengths, whose master gains differ', () => {
    // The first 40 blocks of a clip are not the clip: another loudness, another gain.
    const d = compareMixes(mix(40, 2), 40, mix(100, 0.5), 100);
    expect('skipped' in d).toBe(true);
    if (!('skipped' in d)) return;
    expect(d.frames).toBe(40);
    expect(d.cpuFrames).toBe(100);
    expect(d.skipped).toContain('same --blocks');
    expect(d).not.toHaveProperty('differ');
  });
});
