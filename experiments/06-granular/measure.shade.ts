"use typeshade";

// Experiment 6's own kernels (docs/experiments.md, section 6): what the harness keeps of each block
// on the device, so that a run reads nothing back until its last block. They are the harness's,
// not the engine's.

/**
 * Copies one block into the tape, from the frame `at`.
 *
 * The index is written `at + n`. The loop proof (surface §65, rule R3) admits it at the compiler
 * pin `415b276a` (compiler issue #983, fixed by #994). Earlier pins refused it with TS8070 and
 * this kernel wrote `n * 1 + at`.
 */
export function keep(tape: array<f32>, block: array<f32>, at: u32) {
  for (let n: u32 = 0; n < block.length; n++) {
    tape[at + n] = block[n];
  }
}

/** Stores the count the scheduler holds, `count[0]`, at element `at` of the log. */
export function tally(log: array<u32>, at: u32, count: array<u32>) {
  log[at] = count[0];
}
