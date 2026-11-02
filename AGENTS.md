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
`explain` exist, with unit tests on the CPU tier and a browser check on WebGPU. Experiment 1's
harness is ready, and its container run is recorded as reference numbers; its device runs are
pending. The code takes decisions D1 to D6 of `docs/architecture.md` (pull request #4, pending the
owner's approval) as working assumptions. Nothing here is published to npm.

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

| Document                  | What it is                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `docs/vision.md`          | The developer-experience contract, the catalog of what the engine does, the architecture, the boundaries, the experiments |
| `docs/compiler-asks.md`   | The compiler proposals this engine rests on and asks for, each with its status                  |
| `docs/experiments.md`     | The experiments in order, with their status and what each decides                               |
| `compiler-changes.md`     | The compiler proposals this repository has handled, recorded when the pin moves                 |
| `docs/records/`           | The record of each run of an experiment: the command, the commit, the pin, the device, the numbers |

## The code

| Path                                         | What it is                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/units/*.shade.ts`                       | The units, as exported classes: `Oscillator` (abstract), `Sine`, `Saw`, `OnePole`, `Biquad` (abstract), `Lowpass` |
| `src/kernels/*.shade.ts`                     | The kernels, each a loop and nothing else: `synth` over a bank of `Voice` (shape V), `mixdown` (G), `gain` and `drive` (F), `peak` (R) |
| `src/bank.ts`, `src/render.ts`, `src/explain.ts` | The host API, exported by `src/index.ts`: `bank`, `plan`, `render` (one `fuse` plan per block) and `explain` |
| `test/`                                      | The unit tests and their plain-JavaScript reference (`test/reference.ts`); `test/browser/`, the browser check |
| `experiments/01-round-trip/`                 | Experiment 1: its kernel, its harness and its runner                                           |
| `scripts/`                                   | The Vite build and the headless Chromium that the browser check and the experiments share      |

## Baselines

- Compiler: the pin, `typeshade` in `package.json`, a source tarball of `typeshade/typeshade`
  `main` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (2026-11-02), set by pull request #5
  (`CLAUDE.md`, "The compiler pin"). At that commit proposals 0109 and 0110 are `implemented`, and
  0108 and 0116 are `accepted`. `docs/compiler-asks.md` records each proposal's status.
- This repository: the head of `main` is the baseline. A pull request names the commit it starts
  from; the merged pull requests (#1, the design; #2, the icon) are its history.

## Checks

- `bun install` installs the pinned compiler and writes the host views (`prepare`: `tshc sync`).
- `bun run check`: the host views are up to date (`tshc sync --check`), the shader modules check
  as the editor checks them (`tshc check src experiments`), and both TypeScript projects check
  (`tsconfig.json`, the host code; `tsconfig.node.json`, the scripts).
- `bun run test`: the unit tests, Vitest on the CPU tier of the compiler, with no device.
- `bun run test:gpu`: the browser check, `render` on WebGPU against the CPU tier in headless
  Chromium on SwiftShader. `TYPESHADE_CHROMIUM` names the Chromium binary. CI does not run it.
- `bun run exp:01`: experiment 1 on the CPU tier in Node, and on WebGPU and WebGL2 in headless
  Chromium. It writes the result as JSON (`--out`); its records are in `docs/records/`.

CI (`.github/workflows/ci.yml`) runs one job, `typecheck + unit`: `bun install`, `bun run check`
and `bun run test`. Every claim of a result names the command, the date, the commit and the
device.
