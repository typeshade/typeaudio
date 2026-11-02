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

Design phase. The repository holds documents and no library code. The first experiments of
`docs/experiments.md` decide the first implementation. Nothing here is published to npm.

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
| `compiler-changes.md`   | The compiler proposals this repository has handled, recorded when the pin moves                                           |

## Baselines

- Compiler: `typeshade/typeshade` `main` at `9822490f` (2026-11-02), which holds proposals 0109,
  0110 and 0116 as `implemented` and 0108 as `accepted`, with items 1 to 3 implemented and item 4
  (Amendment 1) in progress. `docs/compiler-asks.md` records each proposal's status. The first
  pin is set with the first code (pull request #5).
- This repository: the head of `main` is the baseline. A pull request names the commit it starts
  from; the merged pull requests (#1, the design; #2, the icon) are its history.

## Checks

None yet. The first code brings `bun run check` (types), `bun run test` (the unit tests, on the
CPU tier of the compiler, with no device) and the device runs of the experiments. Every claim of
a result names the command, the date, the commit and the device.
