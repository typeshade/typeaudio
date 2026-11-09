# Record 08: a layered, spatial render of a hand-written plan, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures, which tier runs which call, and what the checklist
> reads on a one-layer and on a layered render. They do not stand for a GPU's time per block, and
> they decide nothing about the owner's devices. The device runs of experiment 8 are pending
> (`docs/experiments.md`, section 8).

## The run

| Item                 | Value                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment           | 8, a layered, spatial render of a hand-written plan (`docs/experiments.md`, section 8)                                                                                                                                                                                                                                                                      |
| Command 1            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --out docs/records/08-sound-design-container.json`                                                                                                                                                                     |
| Command 2            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --tier all --blocks 40 --repeat-blocks 2 --variant-seconds 0 --out docs/records/08-sound-design-container-tiers.json`                                                                                                  |
| Options of command 1 | The defaults of `experiments/08-sound-design/run.ts`: blocks `cpu=0,webgpu=0,webgl2=40` (0 is the whole clip), repeat blocks `cpu=150,webgpu=150,webgl2=20`, variant seconds `cpu=2,webgpu=15,webgl2=0.5`                                                                                                                                                   |
| Date                 | Command 1: 2026-11-09, from 09:10:06 to about 10:02:38 UTC. Command 2: from 10:07:13 to about 10:10:44 UTC                                                                                                                                                                                                                                                  |
| Commit               | Command 1: `0f7572a23f4a69233af48c0feb0326abcf462888` of `typeshade/typeaudio`, branch `claude/exp8-render` (pull request #38), clean tree. Command 2: `45b9e4b63c57bf0774019c9e8892d86814edcb00`, the same branch, clean tree. The two differ in one thing: the harness keeps each group's tier, dispatches, `why` and mean GPU time from `45b9e4b` on     |
| Compiler pin         | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                                                                                                                                             |
| Tools                | Bun 1.4.4, Node v22.23.4, Vite 7.3.7, playwright-core 1.64.1                                                                                                                                                                                                                                                                                                |
| Raw data             | `docs/records/08-sound-design-container.json` (command 1) and `docs/records/08-sound-design-container-tiers.json` (command 2): the options, each tier's block timings, fuse groups, device info, the repeat and variant timings, the comparison across tiers, the checklist of both renders, the verdict of each rule and the load average around each tier |
| Outputs              | The CPU arm writes the five stems, the reverb's return, the mix and the one-layer mix as 32-bit float WAV into `experiments/08-sound-design/out/`, which Git ignores. Command 2 wrote its 40 blocks over command 1's files                                                                                                                                  |

The `webgl2-cpu` entry of `across` in the JSON of command 1 is not valid. WebGL2 rendered 40
blocks, and the master measured the loudness of those 40 blocks, while the CPU render it was held to
is the whole clip. The two have different gains (+25.1 dB and +6.3 dB). Command 2 renders the same
40 blocks on every tier and replaces the entry.

Status after the run: the harness and the render changed in pull request #43 (review of this
record's pull request #38), and the numbers of this record are the numbers of the old code. The
runner compares a page tier's mix with the CPU tier's only when both rendered the same blocks. An
event's key is a hash of the seed and its id, not of its place in the sorted list. A reflection later
than the history is left out. A footstep or a cloth always has a grain. A new run on the fixture
differs from this record in its noise, its grains and its checklist values.

## The devices

| Item     | CPU tier (Node)                                         | WebGPU                                                                                                                                               | WebGL2                                                                                       |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores; Linux 6.18.44 | the same                                                                                                                                             | the same                                                                                     |
| Runtime  | Node v22.23.4                                           | Chrome Headless Shell 153.0.8010.12, cross-origin isolated                                                                                           | the same                                                                                     |
| Graphics | none                                                    | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `subgroups` and `timestamp-query` | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The container is shared with other agent sessions, and the run did not reserve it. The runner
recorded the load average over 1, 5 and 15 minutes, on 4 cores, around each tier of command 1:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 1.43, 1.51, 1.73 | 1.30, 1.34, 1.38 |
| WebGPU   | 1.30, 1.34, 1.38 | 1.95, 1.57, 1.45 |
| WebGL2   | 1.95, 1.57, 1.45 | 1.26, 1.40, 1.41 |

The load was low during the run, so the times are close to what one busy core gives.

## The method

**The plan.** `experiments/08-sound-design/plan.json`: 30 s, 25 events, five layers, a stone room of
18 by 24 by 9 m, three cuts and five peaks of motion. Three events are `voice`. The repository holds
no recorded speech, so the harness synthesizes a stand-in stem for each (`stems.ts`: a buzz through
two formants under a syllabic envelope, peak 0.3).

**The render** (`src/render-plan.ts`). The plan is validated and sorted. Each event is one lane of
one bank of `Cue`s (`src/kinds/cue.shade.ts`). Each block of 1,024 frames at 48 kHz is one `dev.fuse`
scope of 33 calls:

| Calls                                                               | What they do                                                                                                                                    | Loop shape               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `cues`                                                              | every event's kind, one lane each, into `raw`                                                                                                   | V                        |
| `history`                                                           | keeps the last 4,096 frames of each lane beside the block                                                                                       | F, over a ping-pong pair |
| `place`                                                             | distance gain, air absorption, equal-power pan, six early reflections, the reverb send, and with `binaural` an interaural delay and head shadow | V                        |
| `layers`                                                            | sums the lanes of each layer                                                                                                                    | G                        |
| `strips`                                                            | ducks each layer under the dialogue layer and shelves it                                                                                        | V over the layers        |
| `sendSum`, `pad`, 22 `fftStage`, `store`, `accumulate2`, `overlap2` | the partitioned convolution of the send with a synthesized impulse response, two channels                                                       | F, G                     |
| `pack`                                                              | the block's 12 rows in one array, for one read                                                                                                  | F                        |

The kernels are `"use typeshade"` kernel functions and unit classes, with no entry. A kernel that
calls a method on an element of a bank writes that element (compiler Rule 8.29), and `dev.fuse`
plans the calls of a block (compiler surface section 71). The transform
is eleven radix-2 Stockham stages, each a kernel function whose lane writes its own element
(compiler surface section 65, "A loop that runs as a kernel"; Rule 11.7 for the `f32` arithmetic the
CPU tier shares). Each kernel's loop bounds are module constants or the output's `.length`. The
impulse response of the fixture's material, stone, is 2.5 s, 118 partitions of 1,024 frames, and
its partitions are transformed once before the first block.

**The master** (`src/master.ts`), host-side: the mix is measured once the clip is rendered,
scaled to `master.lufs` and limited by a look-ahead true-peak limiter at `master.truePeak`. Layered
render of the fixture: -29.28 LUFS before the master, +6.28 dB of gain, no gain from the limiter
(its deepest gain is 0 dB, since the true peak of the scaled mix is -5.51 dBTP).

**The one-layer render.** The plan's events are merged into moments (events that start within 0.1 s
of the one before are one moment), 17 moments from 25 events. Each moment is one `impact` on
`effects` with the loudest event's time, intensity and position. The render has no spatial chain,
no ducking, no shelves, no snap, no loudness target and no limiter.

**The checklist.** The analyzers of `src/analyze/` score each render with its stems and its dry
render (the stems summed). `DEFAULT_RULES` holds the thresholds, `layerOverlap` 0.7 or less,
`duckingDb` 3 or more and `reverbRatioDb` -20 to 0 among the new ones. They are starting values.

## The numbers

### Time per block

Host time of a block: its `fuse` scope and the read of its output, in milliseconds. The first block
builds the pipelines and is apart. The budget of a block of 1,024 frames at 48 kHz is 21.33 ms. Real
time is the seconds of audio rendered per second of host time over the blocks.

Command 1:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |  1,407 |     1199.30 |  1401.62 |   998.09 |  1758.43 |    1402.09 |         1,406 |    0.018x |               11.3 |
| WebGPU   | webgpu |  1,407 |       51.89 |    62.16 |    41.93 |    82.71 |     632.68 |         1,406 |    0.401x |                0.2 |
| WebGL2   | webgl2 |     40 |      946.67 |  1085.71 |   840.08 |  1099.23 |    1053.17 |            39 |    0.023x |                8.5 |

Command 2, the same 40 blocks on every tier:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |     40 |     1315.92 |  1485.30 |  1144.83 |  1558.25 |    1509.41 |            39 |    0.016x |               10.7 |
| WebGPU   | webgpu |     40 |       52.28 |    60.16 |    47.12 |    68.48 |     623.61 |            39 |    0.318x |                0.2 |
| WebGL2   | webgl2 |     40 |      925.48 |  1048.27 |   820.90 |  1131.31 |    1132.49 |            39 |    0.023x |                8.5 |

No tier keeps the budget. Facts: WebGPU on SwiftShader takes 51.89 ms at the median, 2.4 times the
budget; the CPU tier takes 1,199.30 ms; WebGL2 takes 946.67 ms.

### Where the time goes on WebGPU

Mean GPU time of each group over the 40 blocks of command 2, from `gpuTime` of the fuse report. The
sum is 46.05 ms.

| Group                                                   | GPU time (ms) |  Share |
| ------------------------------------------------------- | ------------: | -----: |
| `cues`                                                  |         33.09 | 71.8 % |
| `accumulate2`                                           |          3.43 |  7.5 % |
| `place`                                                 |          2.76 |  6.0 % |
| `fftStage` (22 stages, `store` fused into the eleventh) |          2.26 |  4.9 % |
| `history`                                               |          2.24 |  4.9 % |
| `layers`                                                |          0.95 |  2.1 % |
| `strips`                                                |          0.82 |  1.8 % |
| `pack`, `overlap2`, `pad`, `sendSum`                    |          0.50 |  1.1 % |

The report of the last block: `tier` `webgpu`, 32 dispatches, 1 submission. Only `fftStage` and `store`
fuse. Each other group stands apart because its trip count differs from the group before it (for
example "cues and history run as two dispatches because the trip counts differ (25 and 128000)"), and
each `fftStage` because it "reads `inp[base + q + stride * p]` (line 46)".

Inference: `cues` is a loop over 25 lanes, each a serial loop of 1,024 frames, so 25 invocations
run on the GPU. The group takes most of the block, and it is where the plan's size matters: the
fixture has 25 events.

### Which calls the tiers ran

Command 2, the last block's report. On the CPU tier, all 33 groups ran on the CPU. On WebGPU, all 32
groups ran on WebGPU. On WebGL2, 1 group ran on WebGL2 (`sendSum`: "WebGL2 runs the calls apart") and
32 ran on the CPU tier, with these sentences, word for word:

| Calls                                           | `why` of the report                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cues`, `place`, `layers`, `strips`, `overlap2` | `<name> runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one`                                                                                                                                                                                                           |
| 22 `fftStage`, `accumulate2`                    | `<name> runs on the CPU, it runs on the CPU, loop 1 writes "out", whose element is not one f32, i32 or u32` (for `accumulate2`, `"sum"`)                                                                                                                                                                        |
| `pad`                                           | `pad runs on the CPU, it runs on the CPU, loop 1 writes "padded", whose element is not one f32, i32 or u32`                                                                                                                                                                                                     |
| `store`                                         | `store runs on the CPU, it runs on the CPU, loop 1 writes "line" other than at i`                                                                                                                                                                                                                               |
| `history`                                       | `history runs on the CPU, it runs on the CPU, its GLSL did not emit: typeshade [SD0111]: portable kernel outside the gather-only tier — 'history_gl0' writes to '_out' 2 times — the portable tier stores exactly once, `\_out[_gid.x] = f(reads)`, so fold the branches into a single value and store it once` |
| `pack`                                          | the same sentence for `'pack_gl0'`, 3 times                                                                                                                                                                                                                                                                     |

These are the limits of ask AA of `docs/compiler-asks.md` (a loop that writes a `vec2`, writes off its
counter or writes two arrays, on WebGL2), met by kernels this experiment wrote. A kernel that mutates
the lanes of a bank counts as writing more than one array. `history` and `pack` are the one new
form: two stores in two branches. The sentence names the fix, and this pull request leaves it as an open item.

### The eight dimensions

Command 1, the CPU arm: the one-layer render (17 events) and the layered render (25 events). A
measure with no rule has none in `DEFAULT_RULES`.

| Dimension   | Measure            | One layer | Layered | Rule               | One layer | Layered |
| ----------- | ------------------ | --------: | ------: | ------------------ | --------- | ------- |
| `layers`    | `heroEvents`       |     4.000 |   5.000 |                    |           |         |
| `layers`    | `eventsPerHero`    |     1.000 |   6.000 | 3 to 7 events      | fails     | met     |
| `layers`    | `layersPerHero`    |     1.000 |   3.000 |                    |           |         |
| `dynamics`  | `contrastLu`       |     9.796 |   7.027 | 6 or more LU       | met       | met     |
| `dynamics`  | `dipDb`            |    16.794 |  -2.202 | 3 or more dB       | met       | fails   |
| `dynamics`  | `duckingDb`        |       n/a |  10.417 | 3 or more dB       | n/a       | met     |
| `balance`   | `tiltDbPerOctave`  |    -5.072 |  -4.666 | -6 to -1 dB/octave | met       | met     |
| `balance`   | `mudShare`         |     0.006 |   0.049 | 0.3 or less 1      | met       | met     |
| `balance`   | `airShare`         |     0.006 |   0.004 | 0.0005 or more 1   | met       | met     |
| `balance`   | `layerOverlap`     |       n/a |   0.271 | 0.7 or less 1      | n/a       | met     |
| `space`     | `correlation`      |     1.000 |   0.670 | 0.9 or less 1      | fails     | met     |
| `space`     | `reverbRatioDb`    |  -236.164 |  -2.354 | -20 to 0 dB        | fails     | met     |
| `position`  | `events`           |    17.000 |  25.000 |                    |           |         |
| `position`  | `panCorrelation`   |     0.000 |   0.824 | 0.7 or more 1      | fails     | met     |
| `sync`      | `pictureTimes`     |     8.000 |   8.000 |                    |           |         |
| `sync`      | `anchoredOnsets`   |     9.000 |   5.000 |                    |           |         |
| `sync`      | `medianAbsErrorMs` |     0.104 |  30.667 | 42 or less ms      | met       | met     |
| `variation` | `maxSimilarity`    |     0.972 |   0.963 | 0.95 or less 1     | fails     | fails   |
| `master`    | `lufs`             |   -25.645 | -23.000 | -24 to -22 LUFS    | fails     | met     |
| `master`    | `truePeakDbtp`     |    -9.986 |  -5.509 | -1 or less dBTP    | met       | met     |
| `master`    | `crestDb`          |    18.444 |  19.186 | 6 to 20 dB         | met       | met     |
| `master`    | `clippedSamples`   |     0.000 |   0.000 | 0 or less samples  | met       | met     |

Facts of the table:

- The one-layer render fails, and the layered render meets: `layers.eventsPerHero`,
  `space.correlation`, `space.reverbRatioDb`, `position.panCorrelation` and `master.lufs`.
- Both meet: `dynamics.contrastLu`, `balance.tiltDbPerOctave`, `balance.mudShare`,
  `balance.airShare`, `sync.medianAbsErrorMs`, `master.truePeakDbtp`, `master.crestDb` and
  `master.clippedSamples`.
- Both fail: `variation.maxSimilarity` (0.972 and 0.963 against 0.95 or less).
- The layered render fails and the one-layer render meets: `dynamics.dipDb` (-2.20 dB and 16.79 dB
  against 3 or more).
- Not measurable on the one-layer render: `dynamics.duckingDb` (no dialogue stem) and
  `balance.layerOverlap` (one layer sounds).
- `space.reverbRatioDb` of the one-layer render, -236 dB, is a dry render: the wet energy is zero and
  the analyzer floors it at 1e-20.
- `master.crestDb` of the layered render, 19.19 dB, is 0.81 dB under its bound of 20. `sync.medianAbsErrorMs`,
  30.67 ms, is 11.3 ms under its bound of 42.

Inferences, not facts: the layered render has less dip before an impact because the wind and the
drone are still sounding there, and the guards do not make silence, a plan does. The 0.95 bound on
`variation.maxSimilarity` is too tight for these kinds, or the kinds vary too little. Both
need a listener or a change of the kinds to decide.

The `dipDb` measure changed at `b4607e1eb2218db2a1dca54f4a071fc95a6794a6` (pull request #44): it now reads the layers other than the impact's. The numbers above are the old measure's.

### Two variants of the A/B step

Two plans that differ in one correction (`{"kind": "whoosh", "set": {"macros": {"brightness": 0.4},
"intensity": 0.85}}`, applied to every `whoosh` and nothing else), each rendered from the start of the
clip. Cold is on a new device, so the first render builds the pipelines and the transform of the
partitions; warm is the same pair again.

| Tier     | Seconds each | Blocks each | Cold: A, B, pair (s)   | Warm: A, B, pair (s)   |
| -------- | -----------: | ----------: | ---------------------- | ---------------------- |
| CPU tier |            2 |          94 | 126.38, 126.95, 253.33 | 126.00, 125.18, 251.19 |
| WebGPU   |           15 |         704 | 38.84, 38.57, 77.41    | 39.65, 38.94, 78.59    |
| WebGL2   |          0.5 |          24 | 32.39, 32.67, 65.05    | 32.33, 32.35, 64.68    |

The pair does not render in under a second on any tier. The WebGPU pair takes 77.41 s cold and
78.59 s warm for 15 s each. A render includes the master and the transform of the partitions
(0.2 s on WebGPU, 11.3 s on the CPU tier, 8.5 s on WebGL2).

### Determinism

The first blocks of the plan rendered twice on one device, the mixes compared bit for bit:

| Tier     | Blocks |  Values | Differ |
| -------- | -----: | ------: | -----: |
| CPU tier |    150 | 307,200 |      0 |
| WebGPU   |    150 | 307,200 |      0 |
| WebGL2   |     20 |  40,960 |      0 |

Across tiers, command 2 (the mix of the same 40 blocks, 81,920 values):

| Pair                | Values that differ | Largest difference | CPU peak | Relative RMS |
| ------------------- | -----------------: | -----------------: | -------: | -----------: |
| WebGL2 and CPU tier |                  0 |                  0 |    0.486 |            0 |
| WebGPU and CPU tier |             81,918 |            6.40e-4 |    0.486 |      1.11e-3 |

Command 1, the whole clip (2,880,000 values): WebGPU and the CPU tier differ in 2,879,893, by at most
1.55e-3 of a peak of 0.530, relative RMS 1.47e-3. The WebGL2 render is the CPU tier's bit for bit
because 32 of its 33 groups ran on the CPU tier. The WebGPU difference is the one the determinism
report leaves a driver (`sin`, `cos`, `exp` and `tanh`, compiler surface section 38), carried
through the filters and the reverb and then scaled by the master's gain.

## What departs from the method

Each item has its disposition: closed, made part of the design by an amendment, or open.

1. **Stand-in dialogue stems.** No recorded speech is in the repository. The three `voice` stems are
   synthesized (`stems.ts`). Open: the ducking measure of 10.4 dB is the ducker acting on a stand-in.
   Next action: a recorded or recorded-and-licensed stem.
2. **Grains are synthesized bursts, and the scheduler is not used.** `footstep` and `cloth` take
   eight grains of experiment 6's `Grain`, drawn on the host from experiment 6's `Cloud`
   (`src/kinds/make.ts`), because each event must be a lane of its own for the spatial chain, and
   the scheduler's lists mix events. The source is a windowed sine, not a recording. Open. Next
   action: a recorded grain source, and a scheduler that keeps the event of each grain.
3. **No HRTF set.** The repository holds no measured set. The `binaural` stage is an interaural delay of
   up to 0.66 ms and a head-shadow lowpass on the far ear, behind the `binaural` option. The run
   renders for speakers, with the option off. `test/browser/page-spatial.ts` renders it on WebGPU.
   Open. Next action: a measured set and a convolution stage.
4. **The convolution's transform is kernel functions, not experiment 5's entry.** The CPU tier
   refuses the entry at the pin (change 0092 is accepted, not implemented). Eleven stages of one kernel
   function run on every tier, at 22 dispatches a block. Closed. If change 0092 is implemented, the
   entry would be one dispatch for each transform.
5. **The master is host-side and runs after the render.** Integrated loudness needs the whole clip.
   Closed, as the design of `src/master.ts`.
6. **The timed run is the whole clip only on the CPU tier and on WebGPU.** WebGL2 rendered 40
   blocks (0.93 s of audio), the variants are 2 s on the CPU tier and 0.5 s on WebGL2 instead of 15 s,
   and the determinism count is the first 150 blocks (20 on WebGL2), not the clip. The reason is the
   time per block: a full pass of the CPU tier takes 28.8 minutes. Open. Next action: the device
   runs.
7. **No propagation delay.** The distance gain and the air act, and the delay of sound over distance does
   not, so that an onset keeps its time in the picture. Closed, as a design choice.
8. **`whoosh` and `riser` lengths.** The sounding length is the plan's `duration` times a factor of
   the macros (`speed` for the whoosh, `length` for the riser), and `arrive` ends that sound at `t`.
   The checklist reads the span from the plan's `duration`. Open. Next action: the owner decides
   whether the note says so.
9. **The one-layer plan.** "The same moments, one effects sound at each" is read as one `impact` for
   each moment, a moment being events within 0.1 s (`onePlan`). Closed as an interpretation. Another
   reading, one `impact` for every event, would leave `layers.eventsPerHero` equal on the two renders.
10. **Levels of the kinds** (`KIND_GAIN`) were set from the peaks of the fixture's events, not by
    ear. Open.
11. **The note's status sentence** ("Nothing in this note is built yet") is unchanged: the brief
    limits the amendment to the ten items. Open. Next action: the owner.
12. **The `webgl2-cpu` entry of `across` in command 1's JSON is invalid** (see "The run"). Closed by
    command 2.

## Open items

| Item                                            | Reason                                                                                                          | Next action                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No tier keeps the 21.33 ms budget               | `cues` is 72 % of the GPU time of a block on WebGPU, and the CPU tier and WebGL2 run the convolution on the CPU | A device run; a `cues` that spreads one event over several lanes; change 0092 for the CPU tier  |
| `history` and `pack` store twice                | The WebGL2 sentence above names the fix                                                                         | Fold the branches into one store                                                                |
| `variation.maxSimilarity` fails on both renders | See "The eight dimensions"                                                                                      | A study with listeners, or other variation in the kinds                                         |
| `dynamics.dipDb` fails on the layered render    | The beds sound before each impact                                                                               | The plan, not a guard, makes the silence: decide whether a rule on the mix is the right measure |
| Thresholds of `DEFAULT_RULES`                   | Starting values; this run shows which side of them one fixture falls                                            | Fit them on more plans                                                                          |
