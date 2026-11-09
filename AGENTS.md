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
three kernels of their scheduler exist too (experiment 6). The harnesses of experiments 1, 2, 3, 4,
5, 6 and 7 are ready, and their container runs are recorded as reference numbers; their device runs
are pending. The code builds on decisions D1 to D6 of `docs/architecture.md`, which the owner
approved on 2026-11-02: D1, D2 and the block of D5 are built; D3, D4, the lookahead of D5 and the
device the engine makes (D6) wait for later pull requests. Nothing here is published to npm.

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
| `docs/compiler-asks.md` | The compiler proposals this engine rests on and its asks of the compiler (issues first), each with its status             |
| `docs/experiments.md`   | The experiments in order, with their status and what each decides                                                         |
| `docs/records/`         | The record of each run of an experiment: the command, the commit, the pin, the device, the numbers                        |
| `compiler-changes.md`   | The compiler proposals this repository has handled, recorded when the pin moves                                           |

## The code

| Path                                             | What it is                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/units/*.shade.ts`                           | The units, as exported classes: `Oscillator` (abstract), `Sine`, `Saw`, `OnePole`, `Biquad` (abstract), `Lowpass`, `Envelope`, `Grain`, `Cloud`                 |
| `src/kernels/*.shade.ts`                         | The kernels, each a loop and nothing else: `synth` over a bank of `Voice` (shape V), `mixdown` (G), `gain` and `drive` (F), `peak` (R)                          |
| `src/kernels/grains.shade.ts`                    | The grain scheduler's kernels: `cull` and `spawn` push onto a list whose count stays on the device, `play` renders it (shape G)                                 |
| `src/bank.ts`, `src/render.ts`, `src/explain.ts` | The host API, exported by `src/index.ts`: `bank`, `plan`, `render` (one `fuse` plan per block) and `explain`                                                    |
| `test/`                                          | The unit tests and their plain-JavaScript reference (`test/reference.ts`); `test/browser/`, the browser check                                                   |
| `experiments/01-round-trip/`                     | Experiment 1: its kernel, its harness and its runner                                                                                                            |
| `experiments/02-worklet/`                        | Experiment 2: its worklet processors, its page and its runner                                                                                                   |
| `experiments/03-fft/`                            | Experiment 3: the FFT entry in three twiddle variants, two probes, the `f64` reference, the harness and its runner; the 2,048-point table entry of experiment 5 |
| `experiments/04-additive/`                       | Experiment 4: its partials and sums, its plain-JavaScript reference, its harness and its runner                                                                 |
| `experiments/05-convolution/`                    | Experiment 5: the kernels of the partitioned convolution, the impulse response, the `f64` references, the oracle's run, the harness and its runner              |
| `experiments/06-granular/`                       | Experiment 6: its two kernels of measurement, its harness over the grain scheduler, its page and its runner                                                     |
| `experiments/07-sound-match/`                    | Experiment 7: the FM patch and its loss written by a generator, the four forms of the gradient, the harness and its runner                                      |
| `src/plan/`                                      | The plan of experiment 8: its types, the kind table (`kinds.ts`) and `validatePlan`; only a validated plan reaches a renderer                                   |
| `src/analyze/`                                   | The analyzers of experiment 8, host-side and pure: loudness, true peak, spectral tilt, onsets, correlation, similarity and `checklist`                          |
| `experiments/08-sound-design/`                   | Experiment 8: the fixture plan `plan.json`, a 30-second scene of 25 events in five layers (the renderer is a later pull request)                                |
| `scripts/`                                       | The Vite build, the headless Chromium and the CPU time of its threads, which the browser check and the experiments share                                        |

## Baselines

- Compiler: the pin, `typeshade` in `package.json`, a source tarball of `typeshade/typeshade`
  `main` at `87af4eb0d9d15f02b66b8341b72cab0944290472` (2026-11-02), set by pull request #15
  (`CLAUDE.md`, "The compiler pin"). The first pin was `145666068ca5d6ecfba32aa0ea4289cf0fc3b762`,
  set by pull request #5. At the pin, proposals 0108, 0109, 0110, 0116 and 0118 are `implemented`.
  `docs/compiler-asks.md` records each proposal's status, and `compiler-changes.md` the proposals
  that the moves of the pin passed.
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
- `bun run exp:05`: experiment 5, the partitioned convolution, on the compiler's oracle in Bun and
  on WebGPU and WebGL2 in headless Chromium, with a kernel check on the CPU tier in Node. It writes
  the result as JSON (`--out`) and the outputs' bits (`--raw`); its records are in `docs/records/`.
  CI does not run it.
- `bun run exp:06`: experiment 6, the grain scheduler, on the CPU tier in Node, and on WebGPU and
  WebGL2 in headless Chromium. It writes the result as JSON (`--out`) and keeps each tier's
  render in `experiments/06-granular/out/`; its records are in `docs/records/`. CI does not run it.
- `bun run exp:07`: experiment 7 on the CPU tier in Node, on the compiler's oracle in Bun, and on
  WebGPU and WebGL2 in headless Chromium. It times the render, the loss and a descent's step with
  the gradient of `grad` in four forms, per parameter count. It writes the result as JSON (`--out`);
  its records are in `docs/records/`. `bun run exp:07 --write` writes the patch's modules again.

CI (`.github/workflows/ci.yml`) runs one job, `typecheck + unit`: `bun install`, `bun run check`
and `bun run test`. Every claim of a result names the command, the date, the commit and the
device.

## Portable graphs and cross-repository feedback

`src/graph/` owns the procedural graph previously implemented by the Web editor.
Its public entries are `typeaudio/graph`, `typeaudio/graph/compiler` and
`typeaudio/graph/runtime`. The runtime entry does not import the compiler.
`src/feedback/` validates and replays source-only graph reproductions.
`fixtures/feedback/` is the shared Web and engine corpus; `test/graph-feedback.test.ts`
checks immediate output, numerical references, state continuity and event replay.

- `bun run feedback --out .feedback/report.json` records the shared corpus and its generated source.
- `bun run feedback <file.json>` replays an exported Web graph snapshot without the UI.
- `bun run test:feedback` runs graph contract regressions.
- `.github/workflows/feedback.yml` compares the pinned compiler with a verified candidate source archive.

See `docs/feedback-loop.md` for ownership, snapshot limits and version-pair promotion.
The TypeShade private-generator adapter remains a workaround tracked by ask F;
proposal 0122 is a draft, not an implemented compiler API. CPU timings do not
establish hardware real-time guarantees or measured output underruns.

## Website

`website/` holds the public overview and audio playground. `scripts/site-docs.ts`
renders the design documents into static pages. The playground runs the existing
engine in a worker, then plays rendered PCM with Web Audio.

- `bun run check:website`: type-check the browser and worker code.
- `bun run build:website`: build the site and documentation into `website/dist`.
- `bun run test:website`: check CPU and WebGPU synthesis, playback, WAV export,
  cancellation, unavailable WebGPU, documentation, and mobile layout in Chromium.
- `.github/workflows/deploy.yml`: deploy `main` to `audio.typeshade.dev` with
  Cloudflare Workers Static Assets and the existing `CLOUDFLARE_API_TOKEN` secret.
