'use typeshade';

// The noise of the kinds. It keeps no state: a sample is a hash of the key and the frame, so a
// kind with the same key sounds the same on every tier, and a kind with another key differs.

import { hash32, uniform } from 'typeshade/random';

/** A sample of noise in [-1, 1) for the frame `age`, from `key` only. */
export function noise(key: u32, age: u32): f32 {
  return 2 * uniform(hash32(key ^ hash32(age))) - 1;
}

/**
 * A smooth walk in [-1, 1) from `key` only: the noise of the whole frames on both sides of `x`,
 * joined by a smoothstep. It keeps no state and has no period.
 */
export function smooth(key: u32, x: f32): f32 {
  const i = u32(x);
  const fr = x - f32(i);
  const s = fr * fr * (3 - 2 * fr);
  const n0 = noise(key, i);
  const n1 = noise(key, i + 1);
  return n0 + (n1 - n0) * s;
}
