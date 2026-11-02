# Experiments

The experiments decide the first implementation. Measurement comes before any proposal
(`docs/vision.md`, section 11). They run in order, because a later one builds on an earlier one's
numbers. Each experiment has one question, the decision its answer supports, a method and a
record. On 2026-11-02 experiments 1, 2 and 3 each have a harness and a run on the container of a
Claude Code session, recorded as reference numbers; no experiment has run on the owner's devices
yet.

## Status

| #   | Experiment                                                 | Decides                                                   | Status                                                                                                 |
| --- | ---------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | The round trip per block size                              | The real-time block size and the lookahead; asks H and I  | harness ready; container run recorded (`docs/records/01-round-trip-container.md`); device runs pending |
| 2   | The CPU tier inside an AudioWorklet                        | Whether the latency-critical path exists; asks F and K    | harness ready; container run recorded (`docs/records/02-worklet-container.md`); device runs pending    |
| 3   | The FFT entry held to the oracle on three tiers            | Where the FFT lives (ask G); asks C, E and J              | harness ready; container run recorded (`docs/records/03-fft-container.md`); device runs pending        |
| 4   | A 10,000-partial additive render with the fuse report read | The graph layer's shape and `explain`; asks A, B, D and I | not started                                                                                            |
| 5   | A 10-second partitioned convolution                        | Reverb by impulse response in the catalog; asks E and G   | not started                                                                                            |
| 6   | A granular scheduler on `push` and device-resident counts  | What the device schedules; issue #539                     | not started                                                                                            |
| 7   | A sound match with function-level `grad`                   | Differentiable audio in the catalog; ask L                | in progress (branch `claude/exp-07-sound-match`)                                                       |

The asks are the rows of `docs/compiler-asks.md`.

## What is known before the first run

- A kernel loop over a bank of class instances lowers, and runs on WebGPU and on the CPU tier.
  The compiler's journey `journeys/_host-import` (change 0109, pull request #890) builds filters
  with `new` on the host and runs a kernel over them. Experiment 4 builds on this fact and does
  not test it again.
- A fenced chunk's cost on a real device is in the compiler's `docs/hardware-notes.md`, row A5:
  at chunks of 4.1 ms the fences cost more than the work. Experiment 1 measures the audio shape
  of the same cost.
- A lane writes its own block of frames with a runtime block size, and the loop lowers. The
  compiler reports no TS8070 for `out[v * block + n] = voices[v].tick()` over `n < block`
  (`src/kernels/synth.shade.ts`, compiler pin `14566606`, pull request #5). The loop runs on
  WebGPU on SwiftShader and on the CPU tier, at 32 and 64 lanes, and the bank keeps each voice's
  state between blocks (`bun run test:gpu`, `test/render.test.ts`, record 01). Experiment 4 holds it at 10,000
  lanes (ask A).

## The record of a run

Each run writes one record under `docs/records/`, named `NN-<experiment>-<device>.md`. A record
holds:

- the command and the commit of this repository;
- the compiler pin;
- the device, the browser and its version, and the operating system;
- the numbers, as a table;
- the decision the numbers support, labelled as an inference.

A number without its record is not a result.

## 1. The round trip per block size

**Question.** How long does one block of N frames take, from the call to the host's read of the
result, for N of 128, 256, 512, 1024, 2048 and 4096 frames, on WebGPU and on WebGL2?

**Decides.** The block size and the lookahead of the real-time transport. `docs/vision.md`,
section 9, states the inference of 40 to 70 ms end to end; this experiment replaces it with a
measurement. It also shows whether a `Resident` output and `createDevice({ timeBudgetMs })`
(change 0074) change the number.

**Method.**

1. Write one kernel: 64 sine partials summed into `out[n]`, one lane per frame.
2. Call it 1,000 times per N, and await each result.
3. Take `performance.now()` around each call. Record the median and the 99th percentile.
4. Repeat with the output as a `Resident`, read once per block.
5. Repeat with a time budget set.
6. Write the record per device.

**Status.** Harness ready: `experiments/01-round-trip/`, run by `bun run exp:01`. It times the
four ways of `docs/records/01-round-trip-container.md`, section "The method": steps 2, 4 and 5,
and the engine's own block. The run on the container of a Claude Code session is recorded there,
as reference numbers: its CPU tier in Node, and WebGPU and WebGL2 on SwiftShader. The device runs
are pending: one record per device, `docs/records/01-round-trip-<device>.md`.

## 2. The CPU tier inside an AudioWorklet

**Question.** Does the compiler's generated module load in an `AudioWorkletGlobalScope` on the
CPU tier? How many `Phasor` and `OnePole` voices fit in one render quantum, 128 frames at
48 kHz?

**Decides.** Whether the latency-critical path exists (`docs/vision.md`, section 8, layer 3), and
the shape of ask F. The voice count is the number the WebAssembly tier (ask K) would have to
beat.

**Method.**

1. Compile a `.shade.ts` file with a `Voice` class and a `tick` kernel.
2. Bundle the generated module with the CPU tier inlined, with no dynamic `import`.
3. Load the bundle with `audioWorklet.addModule`. Record the load as yes, or as no with the
   error.
4. In `process()`, run the kernel on the CPU tier for 128 frames.
5. Raise the voice count until the quantum overruns. Record the last count that did not.
6. Write the record per device and browser.

**Status.** Harness ready: `experiments/02-worklet/`, run by `bun run exp:02`. It loads four
worklet bundles with `audioWorklet.addModule`. It times five ways of filling a quantum, in an
`OfflineAudioContext` and in a real-time `AudioContext`. `docs/records/02-worklet-container.md`,
section "The method", says how. The run on the container of a Claude Code session is recorded
there, as reference numbers. The voice of that run is the engine's `Voice`, a `Saw` into a
`Lowpass`, and not a `Phasor` into a `OnePole` (the record's deviation 1). The device runs are
pending: one record per device and browser, `docs/records/02-worklet-<device>.md`.

## 3. The FFT entry held to the oracle on three tiers

**Question.** A radix-2 FFT of 1,024 and of 4,096 points, as a `@compute` entry with barriers:
how far is each tier from an `f64` reference, and do the three tiers agree bit for bit? WebGL2
runs the entry as passes cut at barriers (change 0054); the host's CPU tier runs it once change
0092, accepted at the compiler pin and not implemented there, is implemented.

**Decides.** Where the FFT lives (ask G). The size of ask C, the twiddles' precision, and of
ask E, the subnormals in the tail of an inverse transform of a decaying signal. The WebGL2 arm
measures ask J where the entry reads a length inside an index.

**Method.**

1. Write the entry with workgroup memory and barriers, the twiddles from `sin` and `cos` on the
   device.
2. Write a second variant with the twiddles uploaded from the host as a table.
3. Feed seeded inputs from `typeshade/random`: white noise, an impulse, a decaying sine.
4. Compare each tier to an `f64` FFT in JavaScript: the largest ULP distance per size.
5. Count the values on which the tiers differ from one another.
6. Read the entry's rows of `compile().determinism`.
7. Write the record.

**Status.** Harness ready: `experiments/03-fft/`, run by `bun run exp:03`. The run on the
container of a Claude Code session is recorded in `docs/records/03-fft-container.md`, as reference
numbers: WebGPU and WebGL2 on SwiftShader, and the CPU arms in Node and Bun. The device runs are
pending: one record per device, `docs/records/03-fft-<device>.md`. `test/fft.test.ts` holds the
1,024-point entry to the reference on the CPU in `bun run test`.

The harness departs from the method in four places, each recorded in the record's section "What
departs from the method":

- The 4,096-point transform works in a storage array with `storageBarrier()`. Its 4,096 complex
  points need 32 KiB of workgroup memory, and WebGPU guarantees 16 KiB.
- A third variant computes the twiddles with `sin` and `cos` of an emulated double (compiler
  surface §39), after the first run showed the device's `sin` and `cos` far from the table.
- At the compiler pin the host's CPU tier refuses an entry that reaches a barrier (change 0092 is
  accepted, not implemented). The CPU answer is the compiler's oracle, `dispatch` at `f32`
  precision, which runs the passes the WebGL2 tier runs.
- The error is counted in ULPs at the transform's largest magnitude, since an FFT's rounding error
  scales with the transform and not with each value.

## 4. A 10,000-partial additive render with the fuse report read

**Question.** 10,000 partials, each a `Phasor` with an amplitude envelope and a filter whose
cutoff changes per block, summed into one block of 1,024 frames per dispatch: how many
dispatches does `fuse` plan, where does the reduction land, and what is the time per block?

**Decides.** The shape of layer 2, where one block is one `fuse` scope, and of `explain`, where
the fuse report is the explanation. Whether the proof refuses the lane-own block write (ask A).
Whether `explain` needs the metadata of ask B. Whether the per-block coefficient math needs
ask D on the device. Whether a `Resident` bank of `Voice` keeps its state across blocks with no
host read.

**Method.**

1. Write the `synth` kernel of `docs/vision.md`, section 8, over an `array<Voice>` of 10,000,
   with the lane-own block write.
2. If the proof refuses it (TS8070), record the sentence, and write the workaround of ask A.
3. Sum the partials with a second kernel, the reduction tree of Rule 7.2, in the same `fuse`
   scope.
4. Read the fuse report: the plans, the dispatch count, the facts that held.
5. Measure the time per block over 1,000 blocks.
6. Write the record.

**Status.** Not started.

## 5. A 10-second partitioned convolution

**Question.** A uniform partitioned convolution of a 10-second impulse response at 48 kHz, 469
partitions of 1,024 frames: what is the time per block of 1,024 frames on WebGPU, what is the
memory, and does the tail agree across the tiers?

**Decides.** Whether reverb by impulse response is in the catalog at a real-time budget. Ask G,
the FFT, and ask E, the tail.

**Method.**

1. Transform the impulse response's partitions once, with the FFT of experiment 3.
2. Transform each input block, multiply and accumulate over the partitions, transform back, and
   overlap-add.
3. Measure the time per block over 1,000 blocks, and the device memory held.
4. Compare the last second of the tail across the three tiers. Count the subnormals in the
   oracle's output.
5. Write the record.

**Status.** Not started.

## 6. A granular scheduler on `push` and device-resident counts

**Question.** A kernel appends grain events with `push` (change 0078) into a list whose count
stays on the device (change 0094), and a second kernel renders the live grains. Can the pair
run 10,000 grains per second at blocks of 1,024 frames with no host read per block? Is the
output the same on two runs? Does it run on WebGL2?

**Decides.** Layer 3's division of scheduling between the host and the device. Whether the grain
order needs a stable sort (issue #539).

**Method.**

1. Write the two kernels and a host loop that submits one block at a time.
2. Measure the time per block and the grains alive per block.
3. Render the same seed twice on each tier. Count the values that differ.
4. Run the same on WebGL2, and record what it refuses.
5. Write the record.

**Status.** Not started.

## 7. A sound match with function-level `grad`

**Question.** Match a target spectrum with the parameters of a two-operator FM patch, the ratio,
the index and the envelope, by gradient descent on the forward-mode `grad` of the loss function.
How many parameters fit before one step costs more than the render itself?

**Decides.** Whether differentiable audio is in the catalog (`docs/vision.md`, section 7). The
need for ask L, reverse mode.

**Method.**

1. Write the render as a function of its parameters, with a constant-bounded loop over the
   frames.
2. Write the loss as the spectral distance to the target, with the FFT of experiment 3.
3. Take the forward-mode `grad` per parameter, and step.
4. Measure the time per step against the parameter count: 3, 10, 30, 100.
5. Write the record.

**Status.** In progress, on the branch `claude/exp-07-sound-match`: the harness and its run on the
container, as reference numbers.
