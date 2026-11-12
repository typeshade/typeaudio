# Experiments

The experiments decide the first implementation. Measurement comes before any proposal
(`docs/vision.md`, section 11). They run in order, because a later one builds on an earlier one's
numbers. Each experiment has one question, the decision its answer supports, a method and a
record. On 2026-11-02 experiments 1, 2, 3, 4, 5, 6 and 7 each have a harness and a run on the
container of an agent session, recorded as reference numbers; no experiment has run on the owner's
devices yet.

## Status

| #   | Experiment                                                 | Decides                                                                       | Status                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The round trip per block size                              | The real-time block size and the lookahead; asks H and I                      | harness ready; container run recorded (`docs/records/01-round-trip-container.md`); device runs pending                                                                                                                                                 |
| 2   | The CPU tier inside an AudioWorklet                        | Whether the latency-critical path exists; asks F and K                        | harness ready; container run recorded (`docs/records/02-worklet-container.md`); device runs pending                                                                                                                                                    |
| 3   | The FFT entry held to the oracle on three tiers            | Where the FFT lives (ask G); asks C, E and J                                  | harness ready; container run recorded (`docs/records/03-fft-container.md`); device runs pending                                                                                                                                                        |
| 4   | A 10,000-partial additive render with the fuse report read | The graph layer's shape and `explain`; asks A, B, D and I                     | harness ready; container run recorded (`docs/records/04-additive-container.md`); device runs pending                                                                                                                                                   |
| 5   | A 10-second partitioned convolution                        | Reverb by impulse response in the catalog; asks E and G                       | harness ready; container run recorded (`docs/records/05-convolution-container.md`); device runs pending                                                                                                                                                |
| 6   | A granular scheduler on `push` and device-resident counts  | What the device schedules; issue #539                                         | harness ready; container run recorded (`docs/records/06-granular-container.md`); device runs pending                                                                                                                                                   |
| 7   | A sound match with function-level `grad`                   | Differentiable audio in the catalog; ask L                                    | harness ready; container run recorded (`docs/records/07-sound-match-container.md`); device runs pending                                                                                                                                                |
| 8   | A layered, spatial render of a hand-written plan           | The plan format, the first spatialization units, the analyzers, the A/B speed | harness ready; container runs recorded (`docs/records/08-sound-design-container.md`, `docs/records/08-sound-design-container-2.md`, `docs/records/08-sound-design-container-3.md`, `docs/records/08-sound-design-container-4.md`); device runs pending |
| 9   | The force passage of a study, as a plan on the engine      | The kinds a scene of stone and force needs; a silence in the plan             | ended; container runs recorded (`docs/records/09-force-passage-container.md` to `docs/records/09-force-passage-container-5.md`); a block that lands was not reached; device runs not made                                                              |
| 10  | A sound from seven questions, by a model with better tools | The form of a plan; materials, gestures and effects; a measure built here     | statement only; not started                                                                                                                                                                                                                            |
| 12  | Scene 1, the red seal, from the study's models             | Whether the study's models, ported, make a scene in practical time            | accepted 2026-11-11 (render r5); reworked to 2026-11-12 by the owner's later rules, the presence and bolder passes (`823ef30`)                                                                                                                         |

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
1,024-point entry to the reference on the CPU in `bun run test`. The record's runs did not get a
result from variant C on WebGL2. At the pin `415b276a` it returns there (compiler #966 and #970,
fixed by #1003 and #1014): see the status note at the top of the record. No number of the record
changed.

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

**Status.** Harness ready: `experiments/04-additive/`, run by `bun run exp:04`. One block is one
`dev.fuse()` scope over a bank of 10,000 partials, each a `Sine` through a `Lowpass` at the level
of an `Envelope`, its cutoff moved every block. Six variants change the sum of the lanes, where the
filters' coefficients come from, and where the lanes live; `docs/records/04-additive-container.md`,
section "The method", says how. The run on the container of a Claude Code session is recorded
there, as reference numbers. The engine's plan ran 1,000 blocks on each tier; the other variants
ran fewer, and the record lists each difference from the method above with its disposition. The
device runs are pending: one record per device, `docs/records/04-additive-<device>.md`.

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

**Status.** Harness ready: `experiments/05-convolution/`, run by `bun run exp:05`. The run on the
container of an agent session is recorded in `docs/records/05-convolution-container.md`, as
reference numbers: WebGPU and WebGL2 on SwiftShader, the compiler's oracle in Bun, and a kernel
check on the CPU tier in Node. The device runs are pending: one record per device,
`docs/records/05-convolution-<device>.md`.

The harness departs from the method in six places, each recorded in the record's section "What
departs from the method":

- Step 1 names the FFT of experiment 3, which has no 2,048-point entry. A partition of 1,024 frames,
  zero-padded, is 2,048 points, so `experiments/03-fft/fft.shade.ts` gains `fftMediumTable`: 16 KiB
  of workgroup memory, the twiddles from the host's table.
- Step 3 asks for 1,000 blocks. WebGPU runs 1,000 blocks, on a device with `timestamp-query` and on
  one without. WebGL2 runs 10 blocks and the oracle 3: a block takes seconds there.
- Step 4 compares the last second of the tail. The oracle and WebGL2 run block 0 and blocks 420 to
  468 of the impulse, not every block; on WebGPU this jump gives the bits of the full run.
- At the compiler pin the host's CPU tier refuses the FFT entry, which reaches a barrier (change
  0092 is accepted, not implemented). The CPU answer is the compiler's oracle, as in experiment 3.
  The host's CPU tier runs the four kernel functions in a kernel check.
- On WebGL2 the four kernel functions have no WebGL2 loop at the pin and run on the CPU tier; only
  the FFT entry runs on WebGL2.
- At full scale the tail holds no subnormal, so a second impulse, at 2^-112, is added, whose last
  second lies across 2^-126.

The record's candidate asks and issues have their places in `docs/compiler-asks.md` and on the
compiler: candidate ask A is now ask AA, candidate ask B is now an item of ask G, and candidate ask
C is now evidence of ask V. Candidate issues 1 and 2 are now compiler issues #997 and #998.

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

**Status.** Harness ready: `experiments/06-granular/`, run by `bun run exp:06`. It runs the
engine's grain scheduler, `cull`, `spawn` and `play` of `src/kernels/grains.shade.ts`, as one `fuse`
plan per block, in four arms of the same seed (`docs/records/06-granular-container.md`, section
"The method"). The run on the container of a Claude Code session is recorded there, as reference
numbers:

- On WebGPU on SwiftShader the scheduler ran 10,000 grains a second at blocks of 1,024 frames with
  no device read per block. Streamed, a block took 14.4 ms, below its 21.3 ms. The 99th percentile
  of a fenced block, 32.4 ms, was above it, on a loaded machine. The CPU tier took about 100 ms a
  block.
- Each tier gave the same bits on every render of the seed. The lists of grains were the same bits
  on the three tiers, in the order the grains started. Inference: one cloud's grains need no sort
  (issue #539).
- WebGL2 runs no loop that pushes, and every call of a block fell to the CPU tier. The record
  keeps each refusal word for word.

The method's step 1 names two kernels, and the scheduler has three: the record keeps that
deviation open for the owner. The device runs are pending: one record per device,
`docs/records/06-granular-<device>.md`.

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

**Status.** Harness ready: `experiments/07-sound-match/`, run by `bun run exp:07`. The run on the
container of an agent session is recorded in `docs/records/07-sound-match-container.md`, as
reference numbers: the CPU tier in Node, the compiler's oracle in Bun, and WebGPU and WebGL2 on
SwiftShader. The device runs are pending: one record per device,
`docs/records/07-sound-match-<device>.md`. The run is at the compiler pin `14566606`, where change
0056 is accepted and its steps 1, 1b and 2a are implemented: `grad` has a function-level reverse
mode as well.

The harness departs from the method in six places, each recorded in the record's section "What
departs from the method":

- The loss takes 16 bins of a 1,024-point DFT by one Goertzel recurrence per bin inside the frame
  loop, not the FFT of experiment 3. `grad` refuses an entry and a value kept in an array
  (`SD0118`). The FFT of experiment 3 holds the loss's bins and measures the match over 512 bins.
- Beside forward mode per parameter, the harness takes the gradient in two more forms: forward
  mode along a direction given as an argument, and reverse mode. A third form, a probe that
  rewrote reverse mode's loop headers, retired at the pin `415b276a`: the CPU tier's code generator
  compiles reverse mode's loops there (compiler issue #1017, fixed by #1019).
- At the pin a derivative reaches neither the host face nor the manifest (change 0056, step 4). The
  CPU tier runs the derivatives through `compileModuleJs`, the host face's code generator, and the
  GPU tiers through a packed program whose placeholders take the bodies `grad` builds.
- The descent uses Adam. Plain gradient descent, also run, ends farther from the known answer.
- The GPU tiers also time a render with one invocation for each frame, beside the render by one
  invocation that the CPU arms time.
- The frame loop runs over the envelope's segments, and over each segment's frames inside it, so a
  level is looked up once a segment; the frames total 1,024 at every count.

## 8. A layered, spatial render of a hand-written plan

The design of the loop that this experiment tests is `docs/sound-design-loop.md`. That note defines
the layers, the event fields, the kinds and the eight checklist dimensions that this section uses.

**Question.** Take a hand-written plan of 30 seconds for a described fantasy scene. It has about 20
events in five layers. Does the engine render the layers, place them in space and mix them under
the guards within the block budget on each tier? Does the checklist separate a one-layer render
from a layered one?

**Decides.** The plan format. The first spatialization units. The analyzers. Whether the two
variants of the A/B loop render in under a second.

**Method.**

1. Write the plan by hand: 30 seconds, about 20 events, five layers, a room and a listener. Give
   each event a position. Place a stem for `dialogue`.
2. Write a one-layer version of the plan: the same moments, one `effects` sound at each.
3. Render each layer alone and the mix, on WebGPU, on WebGL2 and on the CPU tier. Count the blocks
   that go over the block budget on each tier.
4. Apply the spatial units to each event: distance attenuation, air absorption, early reflections,
   a reverb send and a binaural render.
5. Apply the guards: the loudness target and true peak, ducking under dialogue, the frequency
   slots, onsets snapped to given cut times, variation and no clipping.
6. Measure the eight checklist dimensions on the one-layer render and on the layered render. Report
   each dimension's two numbers.
7. Render two variants of 15 seconds that differ in one macro of one kind. Time the pair, warm and
   cold.
8. Render the same plan twice on each tier. Count the values that differ.
9. Write the record.

**What it does not do.** It does no picture analysis: the cut times and the screen positions are
written by hand. It uses no model. It has no listeners yet. A study of the A/B loop with three lay
users is step two, on the owner's devices.

**Status.** Harness ready; container runs recorded; device runs pending. The four container runs are
`docs/records/08-sound-design-container.md` (commit `0f7572a2`, before the review fixes),
`docs/records/08-sound-design-container-2.md` (commit `eef3eba5f5e234dde1e73977889ed90e61f394ec`),
`docs/records/08-sound-design-container-3.md` (commit `7ecf6764bc2f002b528d09f735aace92fcfe1181`) and
`docs/records/08-sound-design-container-4.md` (commit `3b0a4557f9b639cd2136737f0871c598526318a1`):
reference numbers on the CPU, and WebGPU and WebGL2 on SwiftShader. The reference commit of the
device runs is `3b0a4557f9b639cd2136737f0871c598526318a1`, the commit of the fourth container run
(2026-11-09). The render of `7ecf6764` has a known defect (the grains of `cloth-1`) that pull requests
#63 and #65 removed. A device run made at `7ecf6764` compares with record 08-3. The device runs will follow: one record per device, `docs/records/08-sound-design-<device>.md`.
The procedure of a device run is `docs/device-runs.md`.

## 9. The force passage of a study, as a plan on the engine

A study designed the sound of one fight scene outside the engine, in Python, over eleven rounds of the
owner's listening (`docs/studies/frieren-perceptual/` on pull request #67, at commit `07670c9`). Its
README lists what the engine lacks for that design ("What the engine needs"). The owner said on
2026-11-10 to move the force passage to the engine first.

**Question.** Can the engine make the force passage of the study from a plan: the same moments in the
same order, with the weight and the tension of the study's round 11? Which kinds and which plan fields
must the engine gain for it?

**Decides.** The kinds that a scene of stone and force needs. Whether a plan states a silence. Whether a
kind with a size carries the weight that the study's models carry.

**Method.**

1. Write the plan of the passage from the list of the study's ninth listening review: at least one event
   for each row of the list, at the frame times of the study.
2. Add the kinds that the list needs and the vocabulary lacks. Each is a unit class with a reference in
   plain JavaScript, as the nine kinds are.
3. Add what the plan lacks to state the passage.
4. Render the plan on WebGPU. Render a part on the CPU tier and compare the two.
5. Measure the render against the study's render: the level each two frames, five bands in each phase,
   and the time of each anchored onset.
6. Put the mix on the picture for the owner. The clip is private: the footage is copyrighted.
7. Write the record.

**What it does not do.** It moves one passage of three. It has no listener but the owner. It does not
copy the study's renderer: the engine places each event with its own spatial chain and masters the mix
with its own guards.

**Status.** Ended on 2026-11-10, with five container runs recorded: reference numbers on WebGPU on
SwiftShader. The engine gained four kinds (`crack`, `boom`, `rubble`, `roar`) and the plan gained the
silence (`docs/sound-design-loop.md`). The plan was written sixteen times against the owner's reviews.

| Record                                         | Plan      | Commit    |
| ---------------------------------------------- | --------- | --------- |
| `docs/records/09-force-passage-container.md`   | First     | `77125bd` |
| `docs/records/09-force-passage-container-2.md` | Third     | `586941b` |
| `docs/records/09-force-passage-container-3.md` | Fourth    | `fd8937f` |
| `docs/records/09-force-passage-container-4.md` | Fifth     | `bd8e250` |
| `docs/records/09-force-passage-container-5.md` | Sixteenth | `daa743a` |

Record 09-5 gives the reviews of the plans from the sixth to the sixteenth and the answer of the
experiment:

- The structure of the passage was right by the fifth plan. The owner's rule for it is the section "One
  sound leads" of `docs/sound-design-loop.md`.
- One sound was accepted: the hit on the wall, at the seventh plan.
- A block of stone that lands was not reached. The kinds, bands of noise and one sine, did not make a mass
  of stone, and the measures of the session did not tell stone from a bin.
- What the owner called plausible was the accepted hit, lowered by two octaves, outside the engine.

The theory behind these and what the engine lacks are `docs/sound-design-theory.md`. The device runs were
not made.

## 10. A sound from seven questions, by a model with better tools

Experiment 9 asked how fast a model makes the sound of a passage with the tools the engine has. It
ended on 2026-11-10 (`docs/records/09-force-passage-container-5.md`): the structure was right by the
fifth plan, one sound was accepted, and a block of stone that lands was not reached in sixteen plans.
The owner said on the same day what the next question is: with finer and better tools, how far does a
model get? This statement holds what the owner and the agent settled in that conversation. Nothing in
it is built.

**Question.** Which tools does a model need to reach the sound an expert makes for a picture? How far
does each tool take it, module by module, against experiment 9?

**Decides.** The form of a plan. How the engine defines a material and a gesture. Where an effect
sits. Whether a measure built here can stand in for a listener before a render reaches one.

### What the owner settled

| The owner said                                                                                 | What follows                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The landing lowered by two octaves was plausible, not a sound of full marks                    | A transform is a tool, not the answer. The material of a sound is the work                                  |
| A model from outside is not forbidden; the aim is to build the tool here and to hold all of it | The measure near the ear is built in this repository first                                                  |
| The work goes module by module                                                                 | The unit of the experiment is a module: one sound with what leads to it, made, heard and accepted by itself |
| A sound is made to be used again, as in Houdini                                                | Definitions with a few parameters, joined as nodes; a transform lies on a definition and does not change it |
| Not one node "stone-hit": the material stone, and how a hit joins it                           | A material and a gesture are two definitions, and a contact joins them                                      |
| A sound keeps to seven questions: when, where, and the rest                                    | A plan states each sound as seven answers                                                                   |
| What the engine cannot do is an effect to be made, if a sound is made step by step             | An effect is a node after any step                                                                          |
| Animation is another case                                                                      | The answers are read from the drawing, not from the real world, and they are made larger                    |
| A shock wave can be stated: it is physics                                                      | A medium is a material too. Only what carries a feeling, and a silence, lie outside physics                 |

### A sound as seven answers

A plan states one sound as its answers to seven questions. The agent read "seven" as the six of who,
what, when, where, why and how, and "how much". The owner has not confirmed that reading.

| Question | What it states                                                                    | Its unit in a plan                                            |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Who      | The thing that moves: its material and its size                                   | A name; metres as the drawing shows them                      |
| What     | The thing that is met: its material and its size                                  | A name; metres as the drawing shows them                      |
| How      | The gesture: a hit, a tear, a roll, a grind, a press, a flow                      | A name                                                        |
| How much | The force of the gesture, its count and its length                                | A grade read from the result in the drawing; a count; seconds |
| When     | The frame, the speed of the picture, and what the sound follows and what it tells | Frames and seconds; a ratio for a slow picture                |
| Where    | The place in the picture, the distance, the room                                  | Metres on three axes; a name for the room                     |
| Why      | The part the sound plays: it leads, it explains, it hints, it rings on            | A name; decibels under the sound that leads                   |

"Why" is the section "One sound leads" of `docs/sound-design-loop.md`. A sound with no answer to it is
out. "How much" is read backwards from what the drawing shows: a wall that breaks was hit hard enough
to break it, whoever hit it.

### What a sound is made from

| Definition | What it holds                                                                                                                                                                         | Its units                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Material   | How a thing answers a force: where its partials lie, how fast they die, how hard it is, when it breaks and into what. A solid, a medium such as air, or an energy that a work invents | kg/m³, Pa, m/s, a loss factor, J/m², metres of a piece |
| Body       | A material with a size: the answer of the material, moved to that size. A larger body is lower and longer                                                                             | Metres                                                 |
| Gesture    | The shape of a force in time                                                                                                                                                          | Seconds; a count a second                              |
| Contact    | Two bodies and one gesture. The softer body sets the front; the force sets how bright the answer is and whether a body breaks                                                         | Computed: joules, milliseconds                         |
| Effect     | A node after a sound, after a group, after the room or after the mix: pitch, length, saturation, spread, the form of the output                                                       | A ratio; decibels                                      |
| Style      | How far a work makes its sounds larger than physics, and how dense and how bright it is                                                                                               | A ratio                                                |

The definitions of a material keep physical units: stone is stone in any work. A plan keeps the units
of the drawing. A ratio lies between them: what physics computes, times what the work asks for.

A definition has a name and is used again. A material, a gesture, a group of sounds that the owner
accepted: each goes into a store, and a plan takes it by its name with a few parameters.

### The tools

| Tool                      | What it is                                                                  | How sure the gain is |
| ------------------------- | --------------------------------------------------------------------------- | -------------------- |
| A. The form of a plan     | A sound as seven answers, in the units of the drawing                       | High                 |
| B. Materials and gestures | The definitions above, with a contact that joins them                       | Unknown              |
| C. Effects                | A node after any step: pitch and length first, then saturation and spread   | High                 |
| D. A store                | Accepted definitions by name                                                | High                 |
| E. A measure near the ear | A model of hearing built here: the bands of the ear, masking, shape in time | Low: research        |

Tool B is where experiment 9 stopped. The stone of the engine has five fixed bands and was heard as
plastic and as a steel bin. Prototype 1 of record 09-5 is a first form of another stone; it has no
review.

### Method, by module

1. Choose a module. State its sounds as seven answers.
2. Build what the module needs of the tools, and no more.
3. Render the module alone, with what leads to it.
4. Put it on its piece of the picture for the owner. Count the reviews until the owner accepts it.
5. Record the module: its answers, the definitions it used, the reviews, what it still lacks.
6. Put what was accepted into the store.
7. When the modules of a passage are accepted, join them and hear the passage as a whole.

**The first module.** The material stone and the gesture hit, in two contacts: a body on a wall of
stone, and a block of stone on a floor of stone. Both come from one definition of stone. Experiment 9
accepted the first and did not reach the second.

**Measures**, for each module, against experiment 9.

| Measure          | What it is                                       | Experiment 9, the block that lands       |
| ---------------- | ------------------------------------------------ | ---------------------------------------- |
| Reviews          | The owner's reviews until the module is accepted | 11, and not accepted                     |
| Reach            | Accepted, to be mended, or wrong                 | Wrong, then plausible outside the engine |
| The first render | The reach of the render before any review        | A plastic container that falls           |

### What this statement leaves out

- **Output for many speakers and for headphones, and a standard to send it in.** A sound that is a
  definition with a place can be rendered for any set of speakers, as an object of Dolby Atmos is, and
  it can be made again for the device that plays it. That is a direction this form leaves open. It is
  not a part of this experiment.
- **Recordings as material.** The practice of film starts from them. This experiment builds its
  materials.
- **What carries a feeling.** A tone under a stare is nearer to music than to physics. The kinds of
  experiment 8 stay as they are for it.

### What it changes in the design, and what is not known

- A plan in the units of the drawing meets a rule of `docs/vision.md`: a macro runs from 0 to 1. The
  macros can stay inside a kind, under the new form. The owner decides.
- An effect after any step needs the flow of a plan to be a graph. The engine has a graph layer
  (`src/graph/`). Whether the flow of `renderPlan` can lie on it was not looked at.
- The definitions of a material are a model of physics. How much of one the engine can run in a
  block on a device is not known.
- The agent that writes these definitions cannot hear. Until tool E exists, each step is judged by
  the owner.

**Open questions for the owner.**

1. Are the seven questions the ones in the table?
2. Is the first module right: stone and a hit, in the two contacts?
3. For a module, is a clip of a few seconds enough to judge?

**The answers.** On 2026-11-10 the owner left the four questions to the agent. The agent decided:

1. The seven questions are the ones in the table.
2. The first module is stone and a hit, in the two contacts, as above.
3. A module is judged on a clip of six seconds of picture: 144.9 s to 150.9 s holds the hit on the
   wall, the break and the two landings.
4. A plan of experiment 10 keeps the units of the drawing. The macro rule of `docs/vision.md` stays
   for the kinds of `src/kinds/`. The two do not meet until a definition moves into the engine, and
   that move is a change to the design for the owner.

**The first module, first form.** `experiments/10-seven-questions/` holds it, on the CPU, outside the
engine.

| File             | What it holds                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `definitions.ts` | Material in physical units; body and its modes; contact; the effects pitch, saturation and a room |
| `module.ts`      | A sound as seven answers, and the render of a module to a stereo clip                             |
| `module-1.json`  | The module: the hit on the wall with its four later failures, and the two landings                |
| `run.ts`         | `bun experiments/10-seven-questions/run.ts [--size 2] [--out dir]`                                |

What the first form does, as the code states it:

- A body's modes come from its size and its material: a thin plate for a wall or a floor, a box of
  two wave speeds for a block. Stone moves each mode by up to 6 % and loses its high modes first. A
  larger body is lower and longer by one ratio, so the size of a sound is a size of a body.
- A contact computes its impulse, its energy and its length. A stone that is crushed makes a long
  contact. A drawing that shows a break gets the force that breaks, and the run prints the ratio to
  physics: 100 for the hit on the wall, 1 for the landings.
- A crushing force is rough: it falls each time a piece of the face fails. A piece that breaks off is
  a pair of forces inside the body, so it is weak at the bottom and loud at the top.
- Physics gives the timbre. The answer "why" gives the level, in decibels under the sound that leads.
- `style.size` makes every body of the drawing larger by one ratio. Two clips were made: 1 and 2.

**Review 1, 2026-11-10.** The owner heard both clips (commit `2f10c79`) and said: neither is good; it
is like listening from inside a bamboo tube. The agent measured why.

| Cause                                                                                       | Measure                                                                 | Change                                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The wall and the floor were free plates: a few low modes rang for long                      | 99 % of a landing's energy in 12 spectral peaks; the reference has 32 % | A body has a support: `built` or `ground` drains its rings and answers with many broad modes, evenly in hertz |
| The room was eight delay lines that feed one another                                        | The room alone held 91 % of its energy in 12 peaks                      | The room is noise that dies, a different noise in each ear, by FFT convolution                                |
| A stone on stone was one smooth force: only the lowest modes answered                       | Above 400 Hz the landing was 30 to 50 dB under its 25 Hz band           | The force passes through crushed high points, each with a slow rise and a brittle fall                        |
| The block that landed rang on as if free                                                    | Peaks at 1295 Hz and 2775 Hz, the block's own modes                     | The gesture `land`: the striker rests, and its rings drain into the support                                   |
| Physics makes a heavy landing a low thump with a faint crunch; a film makes the crunch loud | The random high points add up only below 1 / contact time               | `style.crunch` (dB) scales the roughness only, not the impulse: one value for the module, 26 dB               |
| A programme for television keeps little under 40 Hz                                         | The landing had its most energy at 25 Hz; the reference at 50 to 100 Hz | `output.lowest`, a high-pass node at the end                                                                  |

After these changes, the narrow peaks stand as far above the spectrum as in the reference (8 to 10 dB
against 8 to 10 dB). With `--size 2`, the bands of each sound lie within about 6 dB of the reference.
A number did not tell stone from a bin in experiment 9, so these measures say only that the gross
faults are gone. The owner's ear decides.

**What it lacks.** Dust, the air that is pushed out, the fall before the landing, and every sound that
is not stone. Nothing of it was heard by its writer. The run takes about a second on the CPU of the
container.

**Review 2, 2026-11-10.** The owner heard the second render as nearer to stone, but less natural than
prototype 3b of experiment 9: the engine's own hit on the wall, rendered by the engine and lowered two
octaves outside it. This is finding 2 of experiment 9 again: an accepted sound, moved, is ahead of a
sound built from physics.

So the module is now made from the store (tools C and D):

| File                                  | What it holds                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `store/wall-hit.json`                 | The accepted hit: twelve events of the sixteenth plan of experiment 9, times from the hit               |
| `store/passage-without-landings.json` | The bed: the sixteenth plan without the 28 events of the two landings                                   |
| `store.ts`, `engine-page.ts`          | Renders the entries through the engine on WebGPU in one page, and keeps each render by a hash of it     |
| `compose.ts`, `compose-run.ts`        | Lays stored sounds on the bed through effect nodes: `pitch`, and `front`, which keeps the front higher  |
| `module-2.json`                       | The landings as the hit, two octaves lower; the variant `front` keeps the first 15 ms one octave higher |

Time, measured in the container on 2026-11-10: the first render of both entries on WebGPU (SwiftShader)
took 48 s; a composition from the kept renders takes 1.2 s. The first form rendered the store on the
CPU tier, the compiler's f64 oracle, at 0.015 times real time: 3 s of sound took 200 s. The owner
called that unrealistic, and the store moved to WebGPU.

The variant `3b` of `module-2.json` is prototype 3b made with these tools. Against the prototype, its
level in each part of the landing is within 0.5 dB, and the difference of the two signals is 13.8 dB
under the signal.

**Review 3, 2026-11-10.** The owner said the variant `front` is good. The landing went from a bin to a
shipping container, but its weight is still in the wrong direction: it must be lower, a thud, and it is
hollow inside. The agent measured two causes in the stored hit:

| Cause                                                                       | Measure                                                                          | Node                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| The engine's room was lowered with the hit: a room four times as large, low | The room holds 25 % of the hit's energy, 45 % after 0.5 s; lowered, 2 to 8.8 s   | `from.part: "dry"`, and a `room` node after     |
| The low body rings four times as long when lowered                          | After 0.3 s the dry hit is mostly 50 to 100 Hz; lowered, 12 to 25 Hz for seconds | `damp`: the body dies in 0.35 s after its front |

The variant `solid` has both. Against `front`, its landing keeps the first 60 ms within 0.2 dB, and the
seconds 1 to 3 after it are 18 dB lower. The store now keeps each render in its two parts, without the
room and the room.

**Review 4, 2026-11-10.** The owner said `solid` is not bad, but too quiet: a block of tens of tons
that falls from a high wall must thud louder, and it has too little impact. The agent measured why the
landing could not be louder: the last step scaled the whole passage to the landing's peak. Raised by
4, 8 and 12 dB, the landing stayed at -10.6 dB over its first 0.3 s, and only the hit on the wall and
the bed fell, by the same 4, 8 and 12 dB.

| Change                                                                                     | Why                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| The ceiling is the engine's limiter (`limiterGain` of `src/master.ts`) at -1 dBFS          | It lowers only the moments that pass it                  |
| A `saturate` node: a soft limit on the sound's own peak                                    | The same peak, a higher level: a dense sound is heavy    |
| The variant `loud`: the first landing 9 dB over the hit, drive 2.5, the body ends in 0.5 s | The largest sound of the passage is the block that lands |

Measured on the variant `loud`, over the first 0.3 s: the hit on the wall -11.7 dB as before, the bed
before the landing -19.0 dB as before, the first landing -6.8 dB, 4.9 dB over the hit. With the new
ceiling, `solid` puts its landing 2.3 dB over the hit.

**Review 5, 2026-11-10.** The owner accepted the variant `loud`: "it looks right". It went into the
store as `store/stone-landing.json`: an accepted sound made from another entry through its effect
nodes, used again by its name. A composition of it renders the same samples as `loud` (largest
difference 0).

**Measures of the first module**, against experiment 9:

| Measure          | Experiment 9, the block that lands       | Experiment 10, the first module                            |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Reviews          | 11, and not accepted                     | 5: two of the physics render, three of the store render    |
| Reach            | Wrong, then plausible outside the engine | Accepted                                                   |
| The first render | A plastic container that falls           | Physics: inside a bamboo tube. Store: a shipping container |

What decided it, as the agent reads the reviews: the timbre came from a sound the owner had accepted,
and every review after that was answered by one node with a measured cause (a lowered room, a long
low ring, a ceiling that scaled the whole passage). The definitions of physics did not reach the
timbre; they stay in `definitions.ts` as the first form of tool B.

**The second module: the blast.** The owner approved it on 2026-11-10. It holds the strike as her hair
snaps up (145.19 s), the blast (145.27 s), the flight, and the rush as the camera whips to the wall,
up to the frame of silence before the hit. Experiment 9 never had a review of this part on its own;
the one remark near it (something rings under the wind) was two `cloth` events, taken out in the
ninth plan.

Measured against the reference, in dB against each one's hit on the wall, every two frames:

| Picture second | Reference | Sixteenth plan |
| -------------- | --------- | -------------- |
| 145.317        | +0.9      | -2.3           |
| 145.651        | +0.5      | -4.8           |
| 145.817        | -1.1      | -10.3          |

The reference holds the level of the hit from the blast to the hit. The sixteenth plan lets the blast
fall by 10 dB as she flies away, by design since its second plan. `module-3.json` has two variants:

- `plan`: the blast of the sixteenth plan, from the store entry `blast`, at the level the plan gave
  it. Every two frames it lies within 0.5 dB of the sixteenth plan.
- `held`: the store entry `blast-held`, whose two roars last 1.0 s, so the air holds to the rush. It
  falls by about 3 dB, not 10.

Both use the accepted `stone-landing` for the landings, by its name: the first use of the store. The
store now keeps the gain of the engine's master for each render, so a stored group keeps its level
beside the bed (`level: "plan"`). A composition keeps the plan's whole silences over the stored sounds
too: both silences measure no sample above zero.

**Review 6, 2026-11-10.** The owner heard no clear difference between `plan` and `held`, and said the
part may be too short to hear one. The two differ for about 0.25 s, by up to 6.8 dB, just before the
frame of silence and the hit. The agent keeps `plan`: with no difference heard, one definition fewer
is better, and the hit is larger when the moment before it is smaller (`docs/sound-design-theory.md`,
section 4). A gap of 7 dB to the reference, held for a quarter of a second, did not change the scene
for the ear: finding 3 of experiment 9 again.

**Review 7, 2026-11-10.** The owner heard the blast as right ("it does not look bad; it looks
right"). The second module is accepted in the form `plan`, from the store entry `blast`.

**The third module: the hang.** As the wall breaks (146.48 s) the picture turns slow, and the blocks
hang and turn in the air until the cut to the fog (147.77 s). Measured in dB against each one's hit on
the wall, the reference holds -5 to -7 dB through the hang; the sixteenth plan falls to -11 dB.

The owner heard the hit on the wall and the break as alike but fitting (record 09-5), so the break is
an accepted sound: `store/break.json`, eight events of the sixteenth plan. `module-4.json` has two
variants over a bed without the landings and the break, with the accepted `stone-landing`:

- `plan`: the break as the sixteenth plan has it.
- `slow`: the break as the picture plays it, slow (`docs/sound-design-theory.md`, section 4): one
  octave lower and twice as long, its first 15 ms at its own pitch, lowered without the engine's room,
  and the hall after. It holds about 0 dB to 147.2 s and falls to -6.3 dB at 147.6 s; the reference
  is at -5.2 and -6.1 dB there.

**Review 8, 2026-11-10.** The owner said the sounds on the floor are limited, and that leaving them out
might not be bad: in the next shot, the fog, they matter less. The two landings are the same stored
sound twice. Two more variants of `module-4.json`, on `slow`: `slow-one-landing` leaves out the second
landing, and `slow-no-landing` leaves out both. A variant can now leave sounds out by id (`drop`).

**Review 9, 2026-11-10.** With no landing the fog is empty; dozens of landings are better than two,
because not only two large blocks fall. That is finding 1 of experiment 9 as a tool: a `scatter` node
makes many copies of one accepted sound, each a smaller body: `1 / size` higher, `size` times as long
(its `damp`), 30·log10(1 / size) dB quieter and up to 4 dB more by distance, at its own second and
place. Sizes follow a power law, so small pieces are many. The variant `slow-scatter` keeps the first
landing and scatters 30 copies of `stone-landing`, sizes 0.12 to 0.6, from 147.86 s to 149.3 s, in
place of the second landing. A composition of five variants takes 10.7 s.

**Review 10, 2026-11-10.** Not two large ones: dozens of large ones, with small ones as well. The
`scatter` node takes a `power` (0 spreads the sizes evenly). The variant `slow-many` keeps the first
landing and adds 24 large copies (sizes 0.55 to 1.0, even, 6 dB under the first landing at most) and
30 small ones (0.12 to 0.5). Against one landing, the fog holds -8.8 dB to 148.8 s and -10.3 dB to
149.4 s, where one landing had -10.6 and -16.9 dB.

**Review 11, 2026-11-10.** Large, heavy pieces land first, so the sound should go from large to small.
The `scatter` node takes `order: "large-first"`: the copies keep their spread of times, and the
largest takes the earliest, within `jitter` seconds. The variant `slow-many-ordered` lands the large
copies from 147.86 s and the small ones from 148.25 s, each from the largest to the smallest. Its level
falls in each quarter second from -8.1 dB to -22.9 dB between 147.9 s and 149.65 s; the unordered form
of review 10 (commit `45023d8`) stays between -7.2 and -12.1 dB.

**Review 12, 2026-11-10.** The owner accepted `slow-many-ordered` ("it is fine"). The third module is
accepted in that form: the break played as the slow picture plays it, the first landing, then 24 large
and 30 small copies of `stone-landing`, from the largest to the smallest. The choice between `plan`
and `slow` was not asked again; the accepted variant is built on `slow`.

**Status.** Three modules of the force passage are accepted: the hit on the wall and the landing, the
blast, and the break with the hang and the fall. Their sounds are in the store: `wall-hit`,
`stone-landing`, `blast`, `break`. `module-4.json`, variant `slow-many-ordered`, is the whole force
passage as accepted.

## 12. Scene 1, the red seal, with the study's models in the engine

The owner decided on 2026-11-11 to work scene by scene on the whole reference video. Scene 1 is the
red seal, 0:00 to about 0:29. The owner's description: the red seal is like a black hole that rapidly
sucks in the mana around it, so the wind and heavy things like stones are pulled and gather around
it. The owner heard the study's version of this scene as much more natural and unremarkable, in a
good way, than the engine's draft. The owner's instruction: what the study used must be implemented
in TypeAudio, as the study's models and processing in the engine, not as a Python render.

**Question.** Do the study's models and its mix, ported into the engine, give the study's sound? Can a
scene of 29.5 s be made with them in practical time?

**Decides.** Where the study's models live in the engine. Which of them fit a typed function of the
function-graph profile.

**Method.**

1. Port the study's `dsp.py`, `sources.py` and `mix.py` (`docs/studies/frieren-perceptual/scripts/`
   at commit `07670c9`, on pull request #67) line by line.
2. Give the port a generator that numpy can compute too, and hold each model to the study's script
   sample by sample with it.
3. Write the models that fit a typed function as streams, and hold them to the study's models in
   the measures that do not depend on the random numbers.
4. Render the study's red passage (20.0 to 30.0 s) with the port and measure it against the study's
   round 11 (`frieren-red-r11.wav`).
5. Design 0.0 to 20.0 s, the black hole, with the same models, and join the red passage to it.
6. Put the scene on the picture for the owner. The clip is private.

**What it holds.**

| File                                           | What it holds                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/study/fft.ts`                             | A transform of any length in f64: mixed radix for lengths of factors up to 13, Bluestein for the others (numpy's lengths)                        |
| `src/study/rng.ts`                             | The shared generator: a counter hash, two 32-bit hashes a draw, as numpy's `random()` makes a double                                             |
| `src/study/dsp.ts`                             | `dsp.py`: filters, zero-phase and time-varying shaping of noise, modes, placement with reflections and Doppler, the late field, loudness         |
| `src/study/sources.ts`                         | `sources.py`: every model, with its parameters, its defaults and the order of its draws                                                          |
| `src/study/mix.ts`, `src/study/passage.ts`     | `mix.py` (layers by loudness target, drive, look-ahead limiter, soft clip) and the helpers of `passages.py`                                      |
| `src/study/build.ts`, `src/study/part-keys.ts` | A mix built from its parts (`Mix.part`): a cache of parts keyed by the code each part reaches, worker threads for the others, the same samples   |
| `src/kinds/functions/study.ts`                 | `studyBurst`, `studyBoom`, `studySlip` (groan and grind), `redRumble`, `redRoar`, `redCrackle`, `redMaterial` as typed functions                 |
| `experiments/12-scene1-red-seal/red.ts`        | The study's `red()`, statement by statement in the study's order                                                                                 |
| `experiments/12-scene1-red-seal/scene.ts`      | Scene 1: the black hole (0.0 to 20.0 s) and the red passage, in one mix                                                                          |
| `experiments/12-scene1-red-seal/tail.ts`       | The red passage as scene 1 holds it (`redTail`, `MAIN`), and the stones of the reviews (`huuk`, `passBy`, `fastHit`, the levels)                 |
| `src/study/presence.ts`                        | The presence and bolder passes shared by the scenes: `body`, `LIFT` (with `except`), `CEILING_DBTP`, `BOLD`, `impactSize`, `scaleLayer`          |
| `test/small-stones.test.ts`                    | The guard of the owner's rule on small stones and clicks: it reads the scenes' sources                                                           |
| `experiments/12-scene1-red-seal/run.ts`        | `bun experiments/12-scene1-red-seal/run.ts red\|scene [--out dir] [--against r11.wav] [--parity study.f64] [--workers n] [--no-cache] [--plain]` |
| `experiments/12-scene1-red-seal/measure.ts`    | The level each two frames, five bands in each section, the lag of the energy at each anchor                                                      |
| `experiments/12-scene1-red-seal/parity/`       | The shared generator in numpy, the study's red passage rendered with it, and the writers of the two test fixtures                                |
| `test/study.test.ts`                           | Each model and each step of the mix against the study's script: 53 signatures, each sample within 1e-9 of its peak                               |
| `test/study-functions.test.ts`                 | The typed functions against the study's models: octave shares, envelope and level, averaged over 24 seeds                                        |

Where each model went:

- Every model and every step of the processing is in `src/study/`, as host code. The study shapes
  whole signals at once (zero-phase filters on the FFT grid, a level that divides by the peak of the
  whole sound), so its exact form is a host form, as the effects of experiment 10 are.
- Seven models fit a typed function (one output, at most 16 inputs, flat state of at most 32
  fields, no `typeshade` imports) when they are written as streams: a band of `band_gain` becomes
  Butterworth state-variable filters of the same order, white noise the hash noise of the profile, and
  a level from the peak an input. Those are in `src/kinds/functions/study.ts`. The render of the scene
  uses the host form; the typed functions are for the site's editor.
- The models that stay host only: the fracture and everything built on it (`heavy_crack`, `block_hit`,
  `slab_fall`; 90 modes and an avalanche do not fit 32 fields), the shaping in time and frequency
  (`stft_shape`: the band sweep, the lance, the late field), the placement and the hall, the loudness
  targets and the master.

**Run 1, 2026-11-11.** In the container of an agent session: Bun 1.4.4, the host CPU (no WebGPU and
no device), compiler pin `415b276a`, commit `b53c5c8`. The study's scripts with Python 3.13.18 and
numpy 2.5.3 reproduce round 11's SHA-256 (`1d22788c…`).

| Measure                                                                                 | Result                                                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The red passage, port against the study, both with the shared generator                 | Largest difference 1.8e-9 of a peak of 0.79; the difference 215 dB under the signal                 |
| The models, port against the study's script, shared generator (`test/study.test.ts`)    | 53 signatures, every sample within 1e-9 of its peak                                                 |
| The typed functions against the study's models (`test/study-functions.test.ts`)         | Octave shares within 0.3 to 3.5 dB, envelopes within 1.7 dB, levels of the red parts within 0.11 dB |
| The red passage, port with its generator against round 11 with numpy's, each two frames | Mean -0.72 dB, median of the difference 0.76 dB, 90 % within 2.70 dB, largest 4.62 dB               |
| The red passage, integrated loudness                                                    | -12.8 LUFS (round 11: -12.6 LUFS); master -8.49 dB, limiter 5.1 dB deep                             |
| The time of a render                                                                    | The red passage 40 s; the scene (208 layers, 31 s with its tail) 98 s to 104 s                      |

The five bands in each section of the red passage, port against round 11 (dB, 30-120, 120-500,
500-2k, 2k-6k and 6k-16k Hz):

| Section    | RMS port / round 11 | Bands, port - round 11   |
| ---------- | ------------------- | ------------------------ |
| flight     | -17.1 / -16.9       | -0.4 -0.7 -0.3 -0.7 0.0  |
| flame      | -14.5 / -14.5       | 1.1 -0.4 -0.2 -0.1 0.7   |
| gather     | -16.9 / -16.4       | 2.0 -0.7 0.7 1.5 1.6     |
| cracks     | -15.0 / -14.9       | -1.7 0.9 -0.7 -0.3 -0.3  |
| shell      | -21.4 / -21.4       | 0.0 -1.1 0.4 0.3 0.3     |
| rays       | -9.8 / -9.3         | -1.1 -0.5 -0.3 -0.9 -0.7 |
| ice        | -9.1 / -9.1         | -0.5 1.9 1.1 0.2 -0.6    |
| ice stands | -14.1 / -12.8       | -4.2 -1.3 -0.3 -0.4 -0.2 |
| smoke      | -20.1 / -19.3       | -0.3 -0.5 0.1 -0.2 -0.5  |

With the shared generator the port is the study, so every difference in these two tables comes from
the random numbers alone: other noise, other times of the random impacts, other sizes. The largest,
-4.2 dB under 120 Hz while the ice stands, is the stones that fall behind the ice (`tumble`) and the
slabs (`slab_fall`), whose counts and sizes are drawn. The anchored events lie at the study's times by
construction. Measured as the lag of the energy envelope of round 11 against the port: 0 to 7 ms for
the events that rise by more than 5 dB (the two strikes, the burst toward the camera, the release,
the ice); the onsets that rise by 2 to 4 dB in a dense mix (the target strike, the white frame) give
no clear lag (up to 20 ms).

**The black hole, 0.0 to 20.0 s.** The frames were read at 2 and 6 frames a second with a cut
detector; `scene.ts` gives the shots. The design, with the study's models only:

- The draw: air that is pulled to the core, the study's model of mana that gathers (noise whose band
  climbs) made continuous from 3.87 s to 20.05 s. It swells each time the orb is near (4.9 to 7.2 s,
  10.6 s, 14.7 s, 19.9 s) and hands over to the red passage's flight. A low part of the red material
  follows it.
- The orb: the red material and its cluster of partials, as the study's orb, at a tension that rises
  as it forms (3.87 to 4.71 s) and while it is close. The white frame at 4.71 s is a pressure pulse, a
  deep body and a falling tear.
- The wind drawn round it: three steady noise sources on spiral paths round the camera (5.75 to
  7.21 s), so the pan and the Doppler shift come from the paths; then wind and hair on her face.
- The stones: they pass the camera on paths (9.6 to 11.3 s, 17.9 to 18.4 s, 18.8 to 19.8 s), the orb
  strikes two (10.17 s, 10.86 s), and from 11.55 s to 14.81 s a mass turns round the core: blocks that
  strike blocks at a rate from 4 to 15 a second, sizes 0.45 to 1.3 m, on paths to the core; two
  grinds that grow; a falling mass (`rubble`); four stones on spirals; a low billow under it.
- The block that lands at 15.56 s: a slab of 1.6 m, a body at 62 Hz, a run of cracks across the face,
  dust and the far wall's answer. Then seven landings and two leaps in the quick cuts.

Measured on the scene, RMS each half second: 0 to 3.5 s from -42 to -26 dB (the picture fades in
from black), the orb's close shots -14 to -17 dB, the flight through the hall -22 to -24 dB, the
gathering rising from -17 to -14 dB, the block that lands -11.5 dB, then the red passage as round 11
has it (each two frames, scene against round 11 from 20.0 s: median of the difference 0.76 dB). The
reference's audio holds music, so its level (-4 to -8 dB from 4 s) is no target.

**What is not verified.** Nobody has listened to the scene. The black hole is designed from the
frames and the owner's description; no study round had it. The render runs on the host CPU in Bun,
not on WebGPU; it takes under two minutes for the whole scene. The typed functions are not used by
the render; their agreement with the study is in measures, not in samples.

**Review 1, 2026-11-11.** The owner kept the landings: the sound of the stones that hit the floor
after they hit the wall is at a good level, and it is the reference for every other landing in the
scene. The owner found the black hole missing: where it is on screen and close, even when the
camera is right under it, there is no sound of it. It must be a black hole that violently sucks in
the mana around it.

The agent measured the cause with `orb.ts`. The orb's layers held most of the energy of three of the
four windows, but in the band from 500 Hz to 6 kHz: the red material's roar and its tones. Under
120 Hz they lay only 3 to 6 dB over the rest where the orb is overhead, and 2 dB under it over the
rock field. The orb had no body: no low weight, no pressure, nothing that grows as it nears.

| Change                                                                                                                         | Model of the study                    |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| A proximity curve read from the frames: 1 where the orb is overhead or beside the camera                                       | -                                     |
| `hole-roar`: a torrent on a deep spectrum (most of its weight from 30 to 150 Hz); upper bands only near                        | `turbulence`, `level_walk`            |
| `hole-core0` to `hole-core5`: the same deep noise as one source on the orb's path in each shot                                 | `curve_noise`, `place` (Doppler, pan) |
| `hole-inrush`: air drawn in, its band climbing as the orb nears                                                                | the gathering of the finale           |
| `hole-pressure`: noise from 25 to 70 Hz, only near                                                                             | `wide_noise`                          |
| The layers that cover it (flying stones, wind, passing rocks) lose up to 6 dB under 500 Hz and 2 dB in all, with the proximity | -                                     |

The landings and the strikes are not touched. Measured before (commit `5c46294`) and after, the orb's
share of the energy of the mix before the master, and the orb against the rest in five bands (dB,
30-120, 120-500, 500-2k, 2k-6k and 6k-16k Hz):

| Window                 | Seconds      | Share before | Share after | Orb - rest after         | Orb - rest before        |
| ---------------------- | ------------ | ------------ | ----------- | ------------------------ | ------------------------ |
| Close overhead         | 5.0 to 7.0   | 76.0 %       | 94.5 %      | 12.0 20.9 30.7 29.0 23.5 | 3.1 16.2 27.3 24.1 22.3  |
| Streak over the camera | 9.5 to 11.0  | 75.7 %       | 93.5 %      | 16.3 8.7 11.3 9.0 8.7    | 5.7 1.6 6.7 2.5 7.2      |
| Over the rock field    | 11.5 to 15.0 | 33.2 %       | 76.6 %      | 10.7 6.8 2.0 -2.7 0.9    | -2.2 -3.9 -2.6 -9.4 -1.4 |
| Low pass overhead      | 18.5 to 21.0 | 80.8 %       | 96.3 %      | 27.8 17.6 10.8 7.9 10.5  | 15.2 10.0 6.2 0.7 7.8    |

The mix in those windows rose by 4 to 6 dB (RMS each second). The master gain stayed at -8.45 dB,
and the landings lie within 0.3 dB of the first render (the block at 15.55 s, the four leaps, the
three slabs after the rays). The deepest periodic line of the level in the four windows is 6 to 12 %
(before: 5 to 8 %), at a different rate in each: no rotor. The render takes 140 s.

**Review 2, 2026-11-11.** The owner found the second render good, not yet full marks, and chose
three faults from a list: the black hole sounds like noise, nearer to wind than to sucking in; it
has no character, nothing magical or uncanny; the stones that are pulled in are weak, and they are
not heard to gather into it. The landings, the orb's lead and its proximity curve stay, and so does
the rule against a period and a hollow tube.

| Fault        | Change in `scene.ts`                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wind         | 38 swallows (`hole-swallow`): air that converges from 3 to 6 m into the orb on a path that speeds up; its band falls from about 2 kHz to 120 Hz and narrows; its level grows into the core and stops in 4 ms; grains of dust drawn in (reversed bursts) crowd toward its end. The torrent 4 dB lower, the inrush 3 dB lower                                                                               |
| No character | `hole-mana`: inharmonic partials (1, 1.41, 1.87, 2.63, 3.31) that sink from 233 to 147 Hz in two clusters 1.3 % apart, which drift with no period; `hole-growl`: 38, 53 and 71 Hz with a breathing level, with the square of the proximity; `hole-glint`: glassy grains that glide down by a factor of 4 to 6 and are cut where they are swallowed; `hole-ring`: formants of noise on the inrush (`howl`) |
| Weak stones  | 15 stones dragged to the core on paths that speed up, louder until they strike it (`grind`), each arrival a block and a crunch at the level of the accepted landing for the largest; 8 stones that fly past the camera into the core; a pile at the core that crunches (`rubble`) and groans (`groan`) more as they arrive                                                                                |

Measured before (commit `6c06760`) and after, the share of each part in the mix before the master:

| Window                 | Torrent       | Swallows   | Tonal        | Stones        |
| ---------------------- | ------------- | ---------- | ------------ | ------------- |
| Close overhead         | 78.3 → 37.4 % | 0 → 22.3 % | 3.7 → 25.6 % | 0 → 0 %       |
| Streak over the camera | 76.0 → 29.3 % | 0 → 5.7 %  | 6.0 → 22.1 % | 7.2 → 36.5 %  |
| Over the rock field    | 62.6 → 11.3 % | 0 → 16.2 % | 3.8 → 8.2 %  | 21.5 → 59.8 % |
| Low pass overhead      | 76.9 → 30.4 % | 0 → 23.1 % | 8.6 → 26.7 % | 0 → 8.9 %     |

- The swallows: the last third of each is 20.6 dB over its first (median); with the hall, the level
  falls by 7.1 dB from the 10 ms before the stop to 10 to 20 ms after it.
- The stones from 11.5 to 15 s: 11 arrivals, 5 in the first half and 6 in the second; before the
  master each holds a median 26 % of the mix in its first 100 ms. Onsets of 3 dB in the stones' sum:
  2.6 a second (before: 0.3). In the mastered mix an arrival rises by a median 0.5 dB only, because
  the drag swells into it and the limiter works 9.6 % of the time.
- The orb's lead: 94.4 %, 65.1 %, 39.7 % and 89.5 % of the mix in the four windows (before: 94.5,
  93.5, 76.6 and 96.3 %). Over the rock field the stones are now the larger part, as the owner asked.
- No period: the deepest periodic line of the level is 8.2 to 9.2 % in the four windows, at a
  different rate in each.
- The landings: 0.3 to 0.7 dB under the first render. The master gain is the same (-8.45 dB); the
  soft clip's final trim of the true peak lowers the whole scene by that much. Deviation, open.
- The render takes 212 s (304 layers).

**Review 3, 2026-11-11.** The owner found the sound like a laser shot that the third render added not
good. It was the glassy grains (`hole-glint`): pitched, gliding down by a factor of 4 to 6 in 0.25 to
0.7 s, and cut off. They are gone. The tonal layers that stay glide slowly or not at all: `hole-mana`
sinks from 233 to 147 Hz over 18.4 s, `hole-growl` and the formants of `hole-ring` wander by 4 to 6 %
with no glide. The study's own `release-fall` (900 to 180 Hz in 0.7 s at 25.78 s) is in every render
since the first.

The landings are back at their level: `Mix.beforeDb` (an envelope on the sum before the master, not
the study's) lowers the black hole's windows by 1 dB, so the soft clip's final trim no longer lowers
the whole scene. The landings lie within 0.16 dB of the first render (before: 0.37 to 0.55 dB under
it); a trim of 2 to 5 dB gives the same. The render takes 210 s: 195 s for the layers, 15 s for the
master.

**Review 4, 2026-11-11.** The owner found the fourth render not bad, and heard the sound stop at the
cut near 11 s (11.55 s). The orb's red material, its voice and its core were made shot by shot,
each with its own noise and place, so at each cut they stopped in 10 to 15 ms and began again; the
grinds, the low billow and the first impacts of the gathering began on the cut. Now:

- The orb's red material and its voice are one source each from 4.86 s to 15.05 s (`orb-body`,
  `orb-body-voice`), laid shot by shot with an equal-power crossfade of 120 ms at each cut: only the
  place, the distance and the level change. The core of review 1 is laid the same way.
- The proximity and the draw change over 150 to 200 ms at 7.21 s and 14.81 s, not 40 to 70 ms.
- The wind on her face and the air of her flight cross over 0.2 s at 8.05 s.
- At 11.55 s the grinds, the billow and the groan of the pile rise over 0.25 s, and the first impact
  of the gathering comes 0.2 s after the cut.

Measured in 50 ms windows over 0.5 s on each side of each cut, the step across the cut, before and
after (dB): 3.29 s -1.8 / -1.8; 4.71 s (the white frame, a launch) +7.4 / +7.4; 4.88 s -0.9 / -0.8;
7.21 s -3.2 / -1.5; 8.05 s -1.7 / -2.1; 9.47 s +0.4 / +0.3; 11.55 s -1.6 / -0.2; 12.22 s -0.6 /
-0.2; 14.81 s -0.2 / -0.4; 15.47 s +0.6 / -0.2; 17.73 s +0.2 / +0.2; 18.60 s +0.6 / +0.7. At 11.55
s the largest step of a band from 500 Hz up fell from 7.9, 9.9 and 12.3 dB to 3.2, 4.6 and 4.6 dB;
under 120 Hz a window of 50 ms holds a few cycles, and its steps of 7 to 11 dB are the same at
every cut and between them. The landings lie within 0.16 dB of the first render; the glassy grains
stay out. The render takes 208 s.

**Accepted, 2026-11-11.** The owner, on render r5 (`437fa7d`): "Now it continues. Confirm scene 1 and
go to the next scene." Pull request #77 took it to `main`.

### After the acceptance (pull request #80, 2026-11-11 and 2026-11-12)

The owner's later reviews of scenes 2 and 3 gave rules that reach back to scene 1, and the owner
reviewed scene 1 again. One record for the rounds of #80:

| Round       | The owner                                                                                                                                                                                                                                          | Change                                                                                                                                                                                                                                                                                                                                                      | Measured                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| r6, the cut | "A sound must earn its place; small, light detail nobody would miss is cut ... this matters especially in animation" (rule of scene 2, review 1)                                                                                                   | `far-debris`, `pebbles`, `leap-debris` removed; the study's `rock-burst` keeps its 35 cm stone; `wall-debris` keeps the stones of 0.3 m and more; `debris-rain` removed (`tail.ts`, `cutSmall`)                                                                                                                                                             | the whole changes by -19.9 dB against r5; the landings within 0.03 dB                                                                |
| r7          | "Around 13 s only the wind is heard ... the main thing is the black hole"; "around 20 s there are sparks flying, but they are not expressed"; "stones flying out should have more of a 'huuk' sound ... when they hit the floor it should be loud" | 11.55 to 14.81 s: drawn air -6 dB, `hole-roar` -3 dB, the hole's voice +4 dB (`foreHole`); `spark-spray` at 21.13 and 21.82 s; every stone that passes the camera tears the air (`huuk`, `passBy`); every strike at the accepted landing's timbre, louder with its speed (`fastHit`, `hitDb`)                                                               | at 11.65 to 14.7 s the hole's voice -5.2 -> -2.5 dB of the mix, the drawn air -8.8 -> -14.9 dB; the sparks +5 to +7 dB in 2 to 8 kHz |
| presence    | approved a pass for scenes 1 to 3: more body from 120 Hz to 2 kHz, shallower valleys, a louder whole                                                                                                                                               | `src/study/presence.ts`: `body` (+3 dB at 650 Hz on the main events), `LIFT` (the quiet stretches lifted, never into the limiter), `CEILING_DBTP` -1 dBTP                                                                                                                                                                                                   | integrated -11.3 -> -9.4 LUFS; the limiter 5.1 dB deep, 12.5 % of the time                                                           |
| no-roll     | "It seems the sound of small stones rolling keeps being added"                                                                                                                                                                                     | `slabFall` takes `scatter` (0 in the scenes; the study keeps 0.2): no pieces after `block-land` (its body and crack stay; the later rule supersedes its accepted scatter), the leap's falls, the ray stones; `wall-stones` three large blocks, no tumble; no gravel crush in the arrivals; `rubble` only from 0.35 m; the guard `test/small-stones.test.ts` | the tumble of `wall-stones` lay 2 dB under the mix at 26.7 to 29.2 s                                                                 |
| no-roll 2   | "It's there in the first scene around 7 s too"                                                                                                                                                                                                     | measured layer by layer: `face-hair` (the `cloth` model, 11 clicks a second) is smooth air; the swallows lose their reversed grains; the orb's sparks move to 2.5 to 9 kHz (`orb-sparks-bright` in place of the study's `orb-sparks`); the guard also refuses `cloth`, reversed grains and `pops` under 2 kHz                                               | `face-hair` kurtosis 123 -> 19 in 1 to 8 kHz, no transient                                                                           |
| bold        | "The whole sound design is too restrained overall"                                                                                                                                                                                                 | `impactSize` (a sub-pressure pulse, a 30 to 80 Hz body that rolls away, a crack of the floor, the hall's answer) at the launch, the block, the flame's tear and the release; key layers +2 dB; continuous layers -3 dB; the drive 8.8 -> 7.5 dB (`BOLD`)                                                                                                    | each key event over the 3 s before it: launch +8.2 -> +13.0 dB, block +2.0 -> +4.5, tear -0.1 -> +3.7, release +5.7 -> +6.6          |

The delivered render (`823ef30`, with `536f8a2` adding `Lift.except`, unused here): master gain
-9.459 dB, integrated -10.5 LUFS, true peak -1.00 dBTP, the limiter 3.8 dB deep for 6.2 % of the time.
`bun run check`, `test/study.test.ts`, `test/study-functions.test.ts`, `test/study-build.test.ts` and
`test/small-stones.test.ts` pass. Scene 2 masters at this gain (`SCENE1_MASTER`, trim 0.967 dB).

**Status.** Accepted; the owner said "Merge" for #80, #79 and #81 on 2026-11-12. The previews went to
the owner privately; the picture, its frames and its audio are not in this repository.
