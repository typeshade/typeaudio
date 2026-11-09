'use typeshade';

// The noise of the kinds. It keeps no state: a sample is a hash of the key and the frame, so a
// kind with the same key sounds the same on every tier, and a kind with another key differs.

import { hash32, uniform } from 'typeshade/random';

/** A sample of noise in [-1, 1) for the frame `age`, from `key` only. */
export function noise(key: u32, age: u32): f32 {
  return 2 * uniform(hash32(key ^ hash32(age))) - 1;
}
