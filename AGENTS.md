<!-- Generated: 2026-11-02 -->

# TypeAudio (`typeaudio`)

Every agent must read [CLAUDE.md](./CLAUDE.md) for this repository's operating rules. This file
is the map of the repository and of the design.

## Purpose

TypeAudio is a GPU audio engine written in TypeScript on the TypeShade compiler
(`typeshade/typeshade`). TypeShade owns the language, the compiler, the generated programs and
the runtime. TypeAudio owns the audio semantics: signals, buses, nodes, units, the deferred
graph, the transports, and the unit and channel types. The design is `docs/vision.md`.

## Status

First code (pull request #5). The units, the kernels in the four loop shapes, a bank, `render` and
`explain` exist, with unit tests on the CPU tier and a browser check on WebGPU. The grains and the
three kernels of their scheduler exist too (experiment 6). The harnesses of experiments 1, 2, 3, 4
and 6 are ready, and their container runs are recorded as reference numbers; their device runs are
pending. The code builds on decisions D1 to D6 of `docs/architecture.md`, which the owner approved
on 2026-11-02: D1, D2 and the block of D5 are built; D3, D4, the lookahead of D5 and the device the
engine makes (D6) wait for later pull requests. Nothing here is published to npm.

## The design in one screen

- **One class, two sides, the same bits.** A unit is a class in a `"use typeshade"` file, with
  its state as fields and its `tick` as a method. The host builds instances with `new` and tests
  them on the CPU tier; a kernel runs the same methods over a bank of instances on the GPU.
  Compiler proposals 0109 (classes as host values) and 0110 (Rule 8.29, a class is its struct and
  its functions in every place) carry this.
- **Four layers of composition.** A unit; a class whose fields are units (static composition,
  monomorphised into one lane); a kernel function whose loop steps a bank of units; a host graph
  of kernels that `fuse` plans. A kernel is a boundary and a class is a component (compiler
  Rule 8.6: a kernel function is called by no other function).
- **DX first.** `await` only where the host reads a GPU result (`play`, `render`). The developer
  schedules; nothing runs in the audio callback by their hand. Where a node runs is reported by
  `explain`, never hidden. Every failure names the author's line and the fix.
- **The honest boundary.** The GPU renders ahead of the audio thread, in blocks of 512 to 1024
  frames with two or three blocks of lookahead; the AudioWorklet thread has no WebGPU and plays
  what the GPU rendered. The CPU tier of the same kernels is the candidate for the
  latency-critical path (experiment 2 decides).

## Documents

| Document                | What it is                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/vision.md`        | The developer-experience contract, the catalog of what the engine does, the architecture, the boundaries, the experiments |
| `docs/architecture.md`  | The detail of the architecture: the loop shapes, the block plan, banks, buses, events, transports                         |
| `docs/compiler-asks.md` | The compiler proposals this engine rests on and asks for, each with its status                                            |
| `docs/experiments.md`   | The experiments in order, with their status and what each decides                                                         |
| `docs/records/`         | The record of each run of an experiment: the command, the commit, the pin, the device, the numbers                        |
| `compiler-changes.md`   | The compiler proposals this repository has handled, recorded when the pin moves                                           |

## The code

| Path                                             | What it is                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/units/*.shade.ts`                           | The units, as exported classes: `Oscillator` (abstract), `Sine`, `Saw`, `OnePole`, `Biquad` (abstract), `Lowpass`, `Envelope`, `Grain`, `Cloud` |
| `src/kernels/*.shade.ts`                         | The kernels, each a loop and nothing else: `synth` over a bank of `Voice` (shape V), `mixdown` (G), `gain` and `drive` (F), `peak` (R)          |
| `src/kernels/grains.shade.ts`                    | The grain scheduler's kernels: `cull` and `spawn` push onto a list whose count stays on the device, `play` renders it (shape G)                 |
| `src/bank.ts`, `src/render.ts`, `src/explain.ts` | The host API, exported by `src/index.ts`: `bank`, `plan`, `render` (one `fuse` plan per block) and `explain`                                    |
| `test/`                                          | The unit tests and their plain-JavaScript reference (`test/reference.ts`); `test/browser/`, the browser check                                   |
| `experiments/01-round-trip/`                     | Experiment 1: its kernel, its harness and its runner                                                                                            |
| `experiments/02-worklet/`                        | Experiment 2: its worklet processors, its page and its runner                                                                                   |
| `experiments/03-fft/`                            | Experiment 3: the FFT entry in three twiddle variants, two probes, the `f64` reference, the harness and its runner                              |
| `experiments/04-additive/`                       | Experiment 4: its partials and sums, its plain-JavaScript reference, its harness and its runner                                                 |
| `experiments/06-granular/`                       | Experiment 6: its two kernels of measurement, its harness over the grain scheduler, its page and its runner                                     |
| `scripts/`                                       | The Vite build, the headless Chromium and the CPU time of its threads, which the browser check and the experiments share                        |

## Baselines

- Compiler: the pin, `typeshade` in `package.json`, a source tarball of `typeshade/typeshade`
  `main` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (2026-11-02), set by pull request #5
  (`CLAUDE.md`, "The compiler pin"). At the pin, proposals 0109 and 0110 are `implemented`, and
  0108 and 0116 are `accepted`: 0116's implementation (#918, `9822490f`) came after it. The
  compiler's `main` at `9822490f` holds 0109, 0110 and 0116 as `implemented` and 0108 as
  `accepted`, with items 1 to 3 implemented and item 4 (Amendment 1) in progress.
  `docs/compiler-asks.md` records each proposal's status.
- This repository: the head of `main` is the baseline. A pull request names the commit it starts
  from; the merged pull requests (#1, the design; #2, the icon) are its history.

## Checks

- `bun install` installs the pinned compiler and writes the host views (`prepare`: `tshc sync`).
- `bun run check`: the host views are up to date (`tshc sync --check`), the shader modules check
  as the editor checks them (`tshc check src experiments`), and both TypeScript projects check
  (`tsconfig.json`, the host code; `tsconfig.node.json`, the files that run on Node's API).
- `bun run test`: the unit tests, Vitest on the CPU tier of the compiler, with no device.
  `test/fft.test.ts` runs experiment 3's entry on the compiler's oracle.
- `bun run test:gpu`: the browser check, `render` on WebGPU against the CPU tier in headless
  Chromium on SwiftShader. `TYPESHADE_CHROMIUM` names the Chromium binary. CI does not run it.
- `bun run exp:01`: experiment 1 on the CPU tier in Node, and on WebGPU and WebGL2 in headless
  Chromium. It writes the result as JSON (`--out`); its records are in `docs/records/`.
- `bun run exp:02`: experiment 2, the CPU tier inside an AudioWorklet of headless Chromium. It
  measures what loads in the worklet scope, and the real-time ratio per voice count. It writes
  the result as JSON (`--out`); its records are in `docs/records/`. CI does not run it.
- `bun run exp:03`: experiment 3 on the CPU tier in Node, on the compiler's oracle in Bun, and on
  WebGPU and WebGL2 in headless Chromium. It writes the result as JSON (`--out`) and the outputs'
  bits (`--raw`); its records are in `docs/records/`.
- `bun run exp:04`: experiment 4, a block of 10,000 partials as one `fuse` plan, on the CPU tier in
  Node and on WebGPU and WebGL2 in headless Chromium, held to a plain-JavaScript reference. It
  writes the result as JSON (`--out`); its records are in `docs/records/`. CI does not run it.
- `bun run exp:06`: experiment 6, the grain scheduler, on the CPU tier in Node, and on WebGPU and
  WebGL2 in headless Chromium. It writes the result as JSON (`--out`) and keeps each tier's
  render in `experiments/06-granular/out/`; its records are in `docs/records/`. CI does not run it.

CI (`.github/workflows/ci.yml`) runs one job, `typecheck + unit`: `bun install`, `bun run check`
and `bun run test`. Every claim of a result names the command, the date, the commit and the
device.
