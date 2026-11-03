"use typeshade";

// The grain scheduler (docs/architecture.md, section 6): the grains live in a list on the device,
// and so does its count. Each block, `cull` keeps the grains that still sound, `spawn` appends the
// grains that start in the block after them (a push after a held length, compiler change 0094),
// and `play` renders the list into the block. The count moves from kernel to kernel on the
// device, so no host read happens per block. A push keeps the order of a sequential run on every
// tier (change 0078), so the list stays in the order the grains started, with no sort.

import { Cloud, Grain } from "../units/grain.shade.ts";

/**
 * Keeps the grains that still sound at the frame `start`, in their order: the first `count[0]`
 * grains of `grains` that do go to the head of `next`, and their count to `nextCount[0]`.
 *
 * The loop runs over the whole of `grains`, its capacity, and not over `count[0]`: a loop that
 * pushes over a trip count read from an array runs on the CPU tier at the compiler pin (surface
 * §65), and over the capacity it runs on the GPU.
 */
export function cull(next: array<Grain>, nextCount: array<u32>, grains: array<Grain>, count: array<u32>, start: u32) {
  for (let g: u32 = 0; g < grains.length; g++) {
    if (g < count[0] && grains[g].soundsFrom(start)) {
      next.push(grains[g]);
    }
  }
  nextCount[0] = next.length;
}

/**
 * Appends the grains of `cloud` that start in the `block` frames from the frame `start`, in the
 * order of their frames. Pass the list with its held length, `{ array, length }`: the grains go
 * after the length the `Resident` holds, and the call leaves the new length there.
 */
export function spawn(grains: array<Grain>, cloud: Cloud, start: u32, block: u32) {
  for (let n: u32 = 0; n < block; n++) {
    const word = cloud.draw(start + n);
    if (cloud.starts(word)) {
      grains.push(cloud.grain(start + n, word));
    }
  }
}

/**
 * Renders one block of the list: frame `n` of `out` is the sum, in the order of the list, of its
 * first `count[0]` grains at the frame `start + n`. A count past the list's capacity reads the
 * grains the list holds.
 */
export function play(out: array<f32>, grains: array<Grain>, count: array<u32>, start: u32) {
  for (let n: u32 = 0; n < out.length; n++) {
    const live = min(count[0], grains.length);
    let s = 0.;
    for (let g: u32 = 0; g < live; g++) {
      s += grains[g].at(start + n);
    }
    out[n] = s;
  }
}
