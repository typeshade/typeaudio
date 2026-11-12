<!-- Generated: 2026-11-02 -->

# TypeAudio (`typeaudio`)

Every agent must read [CLAUDE.md](./CLAUDE.md) for this repository's operating rules. This file
is the map of the repository and of the design.

## Active TypeAudio program and recovery

Read [docs/continuity/README.md](docs/continuity/README.md) to resume immersive audio work without the prior chat or workspace.
It records owner decisions, exact repository snapshots, the implementation roadmap, validation gates and source recovery procedures.
Update that record when a task, compiler pin or cross-repository contract changes.
The owner's 2026-11-06 benchmark rule: SwiftShader supports functional checks and approximate controlled before/after comparisons.
It is not a hardware GPU performance indicator or evidence of game real-time guarantees.
Keep host CPU timing, software WebGPU correctness, hardware GPU timing and physical audio measurements separate.

## Purpose

TypeAudio is a GPU audio engine written in TypeScript on the TypeShade compiler
(`typeshade/typeshade`). TypeShade owns the language, the compiler, the generated programs and
the runtime. TypeAudio owns the audio semantics: signals, buses, nodes, units, the deferred
graph, the transports, and the unit and channel types. The design is `docs/vision.md`.

## Status

First code (pull request #5). The units, the kernels in the four loop shapes, a bank, `render` and
`explain` exist, with unit tests on the CPU tier and a browser check on WebGPU. The grains and the
three kernels of their scheduler exist too (experiment 6). The harnesses of experiments 1, 2, 3, 4,
5, 6, 7 and 8 are ready, and their container runs are recorded as reference numbers; their device runs
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

| Document                      | What it is                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `docs/vision.md`              | The developer-experience contract, the catalog of what the engine does, the architecture, the boundaries, the experiments    |
| `docs/architecture.md`        | The detail of the architecture: the loop shapes, the block plan, banks, buses, events, transports                            |
| `docs/compiler-asks.md`       | The compiler proposals this engine rests on and its asks of the compiler (issues first), each with its status                |
| `docs/experiments.md`         | The experiments in order, with their status and what each decides                                                            |
| `docs/sound-design-loop.md`   | The design of the sound-design loop: a model writes a plan, the engine renders it; the plan format and the checklist         |
| `docs/sound-design-theory.md` | The theory of sound for picture that the loop works from, and what experiment 9 found against it                             |
| `docs/lanes.md`               | A design note: spreading an event over several lanes, three options with costs and a recommendation, for the owner to decide |
| `docs/records/`               | The record of each run of an experiment: the command, the commit, the pin, the device, the numbers                           |
| `docs/device-runs.md`         | The procedure of a device run on the owner's machine, and the record it leaves                                               |
| `compiler-changes.md`         | The compiler proposals this repository has handled, recorded when the pin moves                                              |

## The code

| Path                                             | What it is                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/units/*.shade.ts`                           | The units, as exported classes: `Oscillator` (abstract), `Sine`, `Saw`, `OnePole`, `Biquad` (abstract), `Lowpass`, `Envelope`, `Grain`, `Cloud`                                                                                                                                               |
| `src/kernels/*.shade.ts`                         | The kernels, each a loop and nothing else: `synth` over a bank of `Voice` (shape V), `mixdown` (G), `gain` and `drive` (F), `peak` (R)                                                                                                                                                        |
| `src/kernels/grains.shade.ts`                    | The grain scheduler's kernels: `cull` and `spawn` push onto a list whose count stays on the device, `play` renders it (shape G)                                                                                                                                                               |
| `src/bank.ts`, `src/render.ts`, `src/explain.ts` | The host API, exported by `src/index.ts`: `bank`, `plan`, `render` (one `fuse` plan per block) and `explain`                                                                                                                                                                                  |
| `test/`                                          | The unit tests and their plain-JavaScript reference (`test/reference.ts`); `test/browser/`, the browser check                                                                                                                                                                                 |
| `experiments/01-round-trip/`                     | Experiment 1: its kernel, its harness and its runner                                                                                                                                                                                                                                          |
| `experiments/02-worklet/`                        | Experiment 2: its worklet processors, its page and its runner                                                                                                                                                                                                                                 |
| `experiments/03-fft/`                            | Experiment 3: the FFT entry in three twiddle variants, two probes, the `f64` reference, the harness and its runner; the 2,048-point table entry of experiment 5                                                                                                                               |
| `experiments/04-additive/`                       | Experiment 4: its partials and sums, its plain-JavaScript reference, its harness and its runner                                                                                                                                                                                               |
| `experiments/05-convolution/`                    | Experiment 5: the kernels of the partitioned convolution, the impulse response, the `f64` references, the oracle's run, the harness and its runner                                                                                                                                            |
| `experiments/06-granular/`                       | Experiment 6: its two kernels of measurement, its harness over the grain scheduler, its page and its runner                                                                                                                                                                                   |
| `experiments/07-sound-match/`                    | Experiment 7: the FM patch and its loss written by a generator, the four forms of the gradient, the harness and its runner                                                                                                                                                                    |
| `src/plan/`                                      | The plan of experiment 8: its types, the kind table (`kinds.ts`) and `validatePlan`; experiment 9 added the silences; only a validated plan reaches a renderer                                                                                                                                |
| `src/analyze/`                                   | The analyzers of experiment 8, host-side and pure: loudness, true peak, spectral tilt, onsets, correlation, similarity and `checklist`                                                                                                                                                        |
| `src/kinds/`                                     | The kinds of experiments 8 and 9, one unit class a file (`whoosh`, `impact`, `shimmer`, `riser`, `wind`, `drone`, `footstep`, `cloth`, `voice`, and `crack` and `rubble` on `stones.shade.ts`, `boom`, `roar`), `lanes.shade.ts` (one lane class and one kernel for each kind) and `makeLane` |
| `src/study/`                                     | The models, the processing and the mix of the perceptual study (`docs/studies/frieren-perceptual/` at `07670c9`), ported line by line, with a generator numpy can compute too (experiment 12); `src/kinds/functions/study.ts` holds the models that fit a typed function                      |
| `src/spatial/`                                   | The spatial chain of experiment 8: `place`, `layers`, `strips`, the transform and the partitioned convolution of the reverb send as kernel functions, and the room (`room.ts`)                                                                                                                |
| `src/render-plan.ts`, `src/master.ts`            | `renderPlan`: a validated plan to five layer stems and a mix, one `fuse` scope a block; the loudness target and the true-peak limiter                                                                                                                                                         |
| `experiments/08-sound-design/`                   | Experiment 8: the fixture plan `plan.json`, its harness and its runner (`bun run exp:08`)                                                                                                                                                                                                     |
| `experiments/09-force-passage/`                  | Experiment 9: the plan of the force passage of the study `plan.json`, its harness, its runner (`run.ts`) and its measures (`measure.ts`, `across.ts`, `study.json`)                                                                                                                           |
| `experiments/12-scene1-red-seal/`                | Experiment 12: scene 1 of the reference video, the red seal: the study's red passage (`red.ts`), the black hole (`scene.ts`), the runner and the measures, the parity scripts                                                                                                                 |
| `experiments/13-scene2-stone-giant/`             | Experiment 13: scene 2 of the reference video, the stone giant, with the study's models, joined to scene 1 in its scale (`scene2.ts`, `run.ts`)                                                                                                                                               |
| `experiments/14-scene3-lightning/`               | Experiment 14: scene 3 of the reference video, the lightning: three attacks that climb, joined to scene 2 in its scale (`scene3.ts`, `run.ts`)                                                                                                                                                |
| `scripts/`                                       | The Vite build, the headless Chromium and the CPU time of its threads, which the browser check and the experiments share                                                                                                                                                                      |

## Baselines

- Compiler: the pin, `typeshade` in `package.json`, a source tarball of `typeshade/typeshade`
  `main` at `415b276a7408936cb483d05ca8bb39e797b05966` (2026-11-08), set by pull request #34
  (`CLAUDE.md`, "The compiler pin"). The first pin was `145666068ca5d6ecfba32aa0ea4289cf0fc3b762`,
  set by pull request #5. The second was `87af4eb0d9d15f02b66b8341b72cab0944290472`, set by pull
  request #15. At the pin, proposals 0108, 0109, 0110, 0116, 0118, 0119, 0121, 0122, 0123, 0128
  and 0129 are `implemented`, and 0120 is `accepted` and not implemented.
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
- `bun experiments/09-force-passage/run.ts`: experiment 9, the plan of the force passage of the study, on WebGPU or WebGL2 in
  headless Chromium or on the CPU tier in Node (`--tier`). It writes the mix, the reverb's return
  and the stems as WAV and the result as JSON into `experiments/09-force-passage/out/`; its record
  is in `docs/records/`. CI does not run it.

CI (`.github/workflows/ci.yml`) runs type checks, unit and graph-feedback tests.
Separate jobs verify offline spatial/room worklet output, record host CPU timings, and restore one archived procedural event.
These checks do not establish hardware GPU performance or physical audio deadlines.
Every claim of a result names the command, the date, the commit and the device.

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

## Typed function graphs

`src/function-graph/` implements E2a through `typeaudio/function-graph`,
`typeaudio/function-graph/compiler` and `typeaudio/function-graph/runtime`.
The compiler entry reflects ordinary TypeShade functions and prepares a bounded synchronous CPU profile.
The runtime owns instance state, named controls and mono processing without importing the compiler.
`fixtures/function-graph/impact.json` is the source-only excitation/resonator/gain example.
`test/function-graph/` covers typed connections, compiler parity, state and actual AudioWorklet execution.

- `bun run test:function-worklet`: Chromium offline worklet output and control/reset parity.
- `bun run bench:functions`: 1/8/32-voice host CPU computation timing.
- `bun run demo:functions`: deterministic impact WAV and source document under `artifacts/functions/`.

Read `docs/function-graphs.md` and `docs/continuity/function-graph-verification.json` before extending this profile.
The private generator awaits proposal 0122; the inout adapter remains until promotion of the upstream #961 fix.
Web PR #47 adopts this profile with visual function nodes, full source modules and project version 3.
Read `docs/continuity/web-function-authoring-verification.json` for that integration and the source-edit API continuation.
Composition-source editing, event scheduling and native host integration remain open.

## Website

The site at `audio.typeshade.dev` is built and deployed from `typeshade/web` (`apps/typeaudio`),
which reads this repository at a pinned commit (`sources/typeaudio`): its `package.json`, `src/`
and `docs/`. Since 2026-11-05 this repository has no site and no deploy workflow; two repositories
must not deploy the same Worker (`docs/repository-migration.md` in `typeshade/web`). The Web
`pin TypeAudio` workflow moves the site to a merged engine revision.

## Spatial stereo bus

`src/spatial/` owns listener-relative stereo processing. Its public entry is
`typeaudio/spatial`. Prepare geometry on the control thread and send numeric targets
to the fixed-capacity `SpatialMixer`. The runtime is synchronous and compiler-free.
Existing compiled `GraphDsp` output supplies mono inputs at 48 kHz.

- `bun run test` includes `test/spatial/` regressions.
- `bun run test:spatial-worklet` checks an actual Chromium AudioWorklet against host PCM.
- `bun run bench:spatial` records 1/8/32/64-source CPU bus timing with device and commit metadata.
- `bun run demo:spatial` writes a short stereo WAV and cue description under `artifacts/spatial/`.
- CI uploads the worklet/timing job's listening artifact and benchmark as `spatial-runtime`.

See `docs/spatial-audio.md` for coordinates, models, buffer ownership and boundaries.
This stage provides stereo pan, distance damping and authored occlusion. It does not implement
HRTF, room reflections, Doppler or head tracking. CPU timing and offline worklet parity do not
establish physical-device deadlines or perceived spatial quality. Spatial shader/tier parity
remains open; the compiler pin and the procedural source path are unchanged.

## Room acoustics

`src/spatial/room/` extends the direct bus through the public `typeaudio/spatial/room` entry.
`prepareRoom` snapshots a rectangular room. `prepareRoomSource` prepares six image-source paths.
`RoomMixer` combines the direct bus, one `RoomVoice` per source and a shared `DiffuseTail`.
`ReflectionTap` owns fractional reads, moving-delay crossfades and material filtering.
Source control and room configuration remain separate from the synchronous processing path.

- `bun run test` includes `test/room/` geometry, delay, state and decay regressions.
- `bun run test:room-worklet` compares a real Chromium AudioWorklet with host PCM.
- `bun run bench:room` records static/moving 1/8/32-source timing and bounded delay storage.
- `bun run demo:room` writes matching dry, small-room and hall WAVs with room/cue data.
- CI uploads these files and verification receipts as `room-runtime`.

See `docs/room-acoustics.md` for the model, sample-rate contract and limitations.
The room stage has no HRTF, Doppler, measured impulse response, directional late field or Web editor integration.
CPU timings include observed block-budget overruns; they are not physical-device deadline guarantees.
