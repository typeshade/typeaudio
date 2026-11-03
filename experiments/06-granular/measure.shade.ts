"use typeshade";

// Experiment 6's own kernels (docs/experiments.md, section 6): what the harness keeps of each block
// on the device, so that a run reads nothing back until its last block. They are the harness's,
// not the engine's.

/**
 * Copies one block into the tape, from the frame `at`.
 *
 * Workaround: the index is written `n * 1 + at`. The loop proof (surface §65, rule R3) admits a
 * write at one index whose coefficient of the counter is loop-invariant, and refuses `at + n`
 * and `n + at` with TS8070 ("an element two iterations can share"); `n * 1 + at` is admitted.
 */
export function keep(tape: array<f32>, block: array<f32>, at: u32) {
  for (let n: u32 = 0; n < block.length; n++) {
    tape[n * 1 + at] = block[n];
  }
}

/** Stores the count the scheduler holds, `count[0]`, at element `at` of the log. */
export function tally(log: array<u32>, at: u32, count: array<u32>) {
  log[at] = count[0];
}
