# Record 08, second run: a layered, spatial render of a hand-written plan, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures on the commit that the device runs will use. They do
> not stand for a GPU's time per block, and they decide nothing about the owner's devices. The
> device runs of experiment 8 are pending (`docs/experiments.md`, section 8).

This is the second container run of experiment 8. The first is `docs/records/08-sound-design-container.md`
(record 08). The owner decided on 2026-11-09 to run the container again after the review fixes, the
duration contract, the `dipDb` measure, the ducking guard and the kinds' variation landed, and to make
the commit of this run the reference commit of the device runs. Record 08 keeps its numbers. The section
"Against record 08" compares the two.

## The run

| Item                 | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment           | 8, a layered, spatial render of a hand-written plan (`docs/experiments.md`, section 8)                                                                                                                                                                                                                                                                                                                     |
| Command 1            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --out docs/records/08-sound-design-container-2.json`                                                                                                                                                                                                                  |
| Command 2            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --tier all --blocks 40 --repeat-blocks 2 --variant-seconds 0 --out docs/records/08-sound-design-container-2-tiers.json`                                                                                                                                               |
| Options of command 1 | The defaults of `experiments/08-sound-design/run.ts`: blocks `cpu=0,webgpu=0,webgl2=40` (0 is the whole clip), repeat blocks `cpu=150,webgpu=150,webgl2=20`, variant seconds `cpu=2,webgpu=15,webgl2=0.5`                                                                                                                                                                                                  |
| Date                 | Command 1: 2026-11-09, from 12:05:42 to about 13:03:29 UTC (58 minutes; the CPU tier took 30.6 minutes for the 1,407 blocks). Command 2: from 13:03:56 to about 13:06:59 UTC                                                                                                                                                                                                                               |
| Commit               | Command 1: `eef3eba5f5e234dde1e73977889ed90e61f394ec` of `typeshade/typeaudio` (`main`, pull request #52), clean tree. Command 2: `47606dce`, the same commit plus the JSON file of command 1, clean tree. The two differ in documents only                                                                                                                                                                |
| Compiler pin         | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                                                                                                                                                                                            |
| Tools                | Bun 1.4.4, Node v22.23.4, Chrome Headless Shell 153.0.8010.12 (the same binary as record 08)                                                                                                                                                                                                                                                                                                               |
| Raw data             | `docs/records/08-sound-design-container-2.json` (command 1) and `docs/records/08-sound-design-container-2-tiers.json` (command 2): the options, each tier's block timings, fuse groups, device info, the repeat and variant timings, the comparison across tiers, the checklist of both renders (command 1, on the CPU tier and on WebGPU), the verdict of each rule and the load average around each tier |
| Outputs              | The CPU arm writes the stems, the reverb's return, the mix and the one-layer mix as 32-bit float WAV into `experiments/08-sound-design/out/`, which Git ignores                                                                                                                                                                                                                                            |

The `webgl2-cpu` entry of `across` in the JSON of command 1 holds no comparison: the harness refuses it
(pull request #43) because WebGL2 rendered 40 blocks and the CPU tier the whole clip. The entry is
`skipped`, with the reason. This is the fix of the invalid entry in record 08. Command 2 renders the same
40 blocks on every tier and holds the comparison.

## The devices

| Item     | CPU tier (Node)                                         | WebGPU                                                                                                                                               | WebGL2                                                                                       |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores; Linux 6.18.44 | the same                                                                                                                                             | the same                                                                                     |
| Runtime  | Node v22.23.4                                           | Chrome Headless Shell 153.0.8010.12, cross-origin isolated                                                                                           | the same                                                                                     |
| Graphics | none                                                    | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `subgroups` and `timestamp-query` | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The device table is the same as record 08's.

The container is shared with other agent sessions, and the run did not reserve it. The runner recorded
the load average over 1, 5 and 15 minutes, on 4 cores, around each tier.

Command 1:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 2.30, 2.34, 2.97 | 2.77, 3.09, 3.02 |
| WebGPU   | 3.19, 3.18, 3.05 | 2.64, 3.31, 3.19 |
| WebGL2   | 2.64, 3.31, 3.19 | 1.63, 2.89, 3.09 |

Command 2:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 0.99, 2.58, 2.98 | 1.18, 2.21, 2.80 |
| WebGPU   | 1.25, 2.20, 2.80 | 1.23, 2.18, 2.79 |
| WebGL2   | 1.23, 2.18, 2.79 | 1.31, 2.03, 2.69 |

Facts: the load of command 1 was between 1.6 and 3.3 over 1 and 5 minutes, and record 08's was between
1.3 and 2.0. At 12:53 UTC, while command 1 was between its CPU tier and its WebGPU tier, another
session's CPU-tier run of experiment 8 (a Node process under `/home/user/typeaudio-kind-banks`) ran in the
container. `pgrep -fa 'chrome-headless-[s]hell'` found no Chromium before the WebGPU tier of command 1 started
(12:53 UTC) and none before command 2 started (13:03:48 UTC). The one check made while the WebGPU tier ran
found only this run's processes (all descendants of this run's `bun`). This run did not wait for another
agent's browser, and it did not check during the WebGL2 tier or during command 2.

## The method

The method is the method of record 08 (section "The method"), with these changes of the code since:

- The plan's `duration` is the sounding length of a `whoosh` and a `riser` (pull request #46).
- The kinds draw more of their sound from the event's key (pull request #49), and an event's key is a hash
  of the seed and its id (pull request #43).
- `strips` takes a gain input for the pre-impact ducking guard (pull request #48): before each hero impact,
  the layers other than the impact's fall by 6 dB. The fuse plan keeps its shape: 33 calls, 32 groups on
  WebGPU.
- `dynamics.dipDb` reads the layers other than the impact's layer (pull request #44).
- The harness scores the checklist on every tier that renders the whole clip (pull request #50), and the
  stand-in dialogue stems differ by event (pull request #52).
- `scripts/browser.ts` has a device mode (pull request #45). This run used the default mode, SwiftShader.

Layered render of the fixture: -29.31 LUFS before the master, +6.31 dB of gain, no gain from the limiter
(its deepest gain is 0 dB; the true peak of the scaled mix is -1.16 dBTP, 0.16 dB under the bound of -1).

## The numbers

### Time per block

Host time of a block: its `fuse` scope and the read of its output, in milliseconds. The first block builds
the pipelines and is apart. The budget of a block of 1,024 frames at 48 kHz is 21.33 ms. Real time is the
seconds of audio rendered per second of host time over the blocks.

Command 1:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |  1,407 |     1274.67 |  1525.56 |  1021.18 |  1776.27 |    1657.75 |         1,406 |    0.016x |               13.5 |
| WebGPU   | webgpu |  1,407 |       56.51 |    72.36 |    45.38 |   111.79 |     755.30 |         1,406 |    0.364x |                0.2 |
| WebGL2   | webgl2 |     40 |     1040.28 |  1177.86 |   934.28 |  1188.29 |    1109.73 |            39 |    0.020x |                9.5 |

Command 2, the same 40 blocks on every tier:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |     40 |     1338.10 |  1471.06 |  1230.50 |  1472.36 |    1471.38 |            39 |    0.016x |               12.1 |
| WebGPU   | webgpu |     40 |       53.05 |    72.88 |    48.23 |    74.51 |     634.97 |            39 |    0.310x |                0.2 |
| WebGL2   | webgl2 |     40 |      959.27 |  1038.63 |   855.05 |  1097.76 |    1037.30 |            39 |    0.022x |                9.5 |

No tier keeps the budget. Facts: WebGPU on SwiftShader takes 56.51 ms at the median, 2.6 times the budget;
the CPU tier takes 1,274.67 ms; WebGL2 takes 1,040.28 ms.

### Where the time goes on WebGPU

Mean GPU time of each group over the 40 blocks of command 2, from `gpuTime` of the fuse report. The sum is
47.46 ms.

| Group                                                   | GPU time (ms) |  Share |
| ------------------------------------------------------- | ------------: | -----: |
| `cues`                                                  |         33.52 | 70.6 % |
| `accumulate2`                                           |          3.42 |  7.2 % |
| `history`                                               |          3.09 |  6.5 % |
| `place`                                                 |          2.76 |  5.8 % |
| `fftStage` (22 stages, `store` fused into the eleventh) |          2.32 |  4.9 % |
| `layers`                                                |          0.91 |  1.9 % |
| `strips`                                                |          0.85 |  1.8 % |
| `pack`, `overlap2`, `pad`, `sendSum`                    |          0.58 |  1.2 % |

The report of the last block: `tier` `webgpu`, 32 dispatches, 1 submission. Only `fftStage` and `store` fuse.
Each other group stands apart for the reason that record 08 lists (a trip count that differs from the group
before it, or `fftStage` reading `inp[base + q + stride * p]`).

Inference: `cues` is a loop over 25 lanes, each a serial loop of 1,024 frames, so 25 invocations run on the
GPU. The group takes most of the block, as in record 08.

### Which calls the tiers ran

Command 2, the last block's report. On the CPU tier, all 33 groups ran on the CPU. On WebGPU, all 32 groups
ran on WebGPU. On WebGL2, **1 of 33 groups** ran on WebGL2 (`sendSum`: "WebGL2 runs the calls apart") and 32
ran on the CPU tier. Record 08 counted 1 of 33 as well. The sentences are the same as record 08's, word for
word:

| Calls                                           | `why` of the report                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cues`, `place`, `layers`, `strips`, `overlap2` | `<name> runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one`                                                                                                                                                                                                                                                                                                          |
| 22 `fftStage`, `accumulate2`                    | `<name> runs on the CPU, it runs on the CPU, loop 1 writes "out", whose element is not one f32, i32 or u32` (for `accumulate2`, `"sum"`)                                                                                                                                                                                                                                                                       |
| `pad`                                           | `pad runs on the CPU, it runs on the CPU, loop 1 writes "padded", whose element is not one f32, i32 or u32`                                                                                                                                                                                                                                                                                                    |
| `store`                                         | `store runs on the CPU, it runs on the CPU, loop 1 writes "line" other than at i`                                                                                                                                                                                                                                                                                                                              |
| `history`                                       | `history runs on the CPU, it runs on the CPU, its GLSL did not emit: typeshade [SD0111]: portable kernel outside the gather-only tier — 'history_gl0' writes to '_out' 2 times — the portable tier stores exactly once, \`\_out[_gid.x] = f(reads)\`, so fold the branches into a single value and store it once` (a second line, "hint: the portable tier is out[gid.x] = f(reads) ...", follows in the JSON) |
| `pack`                                          | the same sentence for `'pack_gl0'`, 3 times                                                                                                                                                                                                                                                                                                                                                                    |

These are the limits of ask AA of `docs/compiler-asks.md` (a loop that writes a `vec2`, writes off its counter
or writes two arrays, on WebGL2), met by the kernels of this experiment, and the one new form of record 08:
`history` and `pack` store in two branches. Nothing in the kernels changed since record 08, so the count is the
same.

### The eight dimensions

Command 1, the CPU arm: the one-layer render (17 events) and the layered render (25 events). A measure with no
rule has none in `DEFAULT_RULES`.

| Dimension   | Measure            | One layer | Layered | Rule               | One layer | Layered |
| ----------- | ------------------ | --------: | ------: | ------------------ | --------- | ------- |
| `layers`    | `heroEvents`       |     4.000 |   5.000 |                    |           |         |
| `layers`    | `eventsPerHero`    |     1.000 |   6.000 | 3 to 7 events      | fails     | met     |
| `layers`    | `layersPerHero`    |     1.000 |   3.000 |                    |           |         |
| `dynamics`  | `contrastLu`       |    10.351 |   7.780 | 6 or more LU       | met       | met     |
| `dynamics`  | `dipDb`            |       n/a |   5.904 | 3 or more dB       | n/a       | met     |
| `dynamics`  | `duckingDb`        |       n/a |   7.239 | 3 or more dB       | n/a       | met     |
| `balance`   | `tiltDbPerOctave`  |    -5.036 |  -4.723 | -6 to -1 dB/octave | met       | met     |
| `balance`   | `mudShare`         |     0.006 |   0.071 | 0.3 or less 1      | met       | met     |
| `balance`   | `airShare`         |     0.006 |   0.004 | 0.0005 or more 1   | met       | met     |
| `balance`   | `layerOverlap`     |       n/a |   0.238 | 0.7 or less 1      | n/a       | met     |
| `space`     | `correlation`      |     1.000 |   0.640 | 0.9 or less 1      | fails     | met     |
| `space`     | `reverbRatioDb`    |  -235.982 |  -2.754 | -20 to 0 dB        | fails     | met     |
| `position`  | `events`           |    17.000 |  25.000 |                    |           |         |
| `position`  | `panCorrelation`   |     0.000 |   0.832 | 0.7 or more 1      | fails     | met     |
| `sync`      | `pictureTimes`     |     8.000 |   8.000 |                    |           |         |
| `sync`      | `anchoredOnsets`   |     9.000 |   7.000 |                    |           |         |
| `sync`      | `medianAbsErrorMs` |     0.021 |  30.667 | 42 or less ms      | met       | met     |
| `variation` | `maxSimilarity`    |     0.938 |   0.939 | 0.95 or less 1     | met       | met     |
| `master`    | `lufs`             |   -25.663 | -23.000 | -24 to -22 LUFS    | fails     | met     |
| `master`    | `truePeakDbtp`     |    -9.773 |  -1.161 | -1 or less dBTP    | met       | met     |
| `master`    | `crestDb`          |    18.721 |  23.281 | 6 to 20 dB         | met       | fails   |
| `master`    | `clippedSamples`   |     0.000 |   0.000 | 0 or less samples  | met       | met     |

Facts of the table:

- The one-layer render fails, and the layered render meets: `layers.eventsPerHero`, `space.correlation`,
  `space.reverbRatioDb`, `position.panCorrelation` and `master.lufs`.
- Both meet: `dynamics.contrastLu`, `balance.tiltDbPerOctave`, `balance.mudShare`, `balance.airShare`,
  `sync.medianAbsErrorMs`, `variation.maxSimilarity`, `master.truePeakDbtp` and `master.clippedSamples`.
- The layered render fails and the one-layer render meets: `master.crestDb` (23.28 dB against 6 to 20 dB; the
  one-layer render has 18.72 dB).
- Not measurable on the one-layer render: `dynamics.dipDb` (no stem of another layer), `dynamics.duckingDb` (no
  dialogue stem) and `balance.layerOverlap` (one layer sounds).
- `master.truePeakDbtp` of the layered render, -1.16 dBTP, is 0.16 dB under its bound of -1.
  `sync.medianAbsErrorMs`, 30.67 ms, is 11.3 ms under its bound of 42.
- `space.reverbRatioDb` of the one-layer render, -236 dB, is a dry render: the analyzer floors the zero wet
  energy at 1e-20.

Command 1, the WebGPU arm scores the checklist too (pull request #50). The verdicts are the same as the CPU arm's. The values
differ in the third decimal at most: `dynamics.dipDb` 5.905 against 5.904, `master.lufs` -23.000 on both.

| Dimension   | Measure            | One layer | Layered | Rule               | One layer | Layered |
| ----------- | ------------------ | --------: | ------: | ------------------ | --------- | ------- |
| `layers`    | `heroEvents`       |     4.000 |   5.000 |                    |           |         |
| `layers`    | `eventsPerHero`    |     1.000 |   6.000 | 3 to 7 events      | fails     | met     |
| `layers`    | `layersPerHero`    |     1.000 |   3.000 |                    |           |         |
| `dynamics`  | `contrastLu`       |    10.351 |   7.780 | 6 or more LU       | met       | met     |
| `dynamics`  | `dipDb`            |       n/a |   5.905 | 3 or more dB       | n/a       | met     |
| `dynamics`  | `duckingDb`        |       n/a |   7.239 | 3 or more dB       | n/a       | met     |
| `balance`   | `tiltDbPerOctave`  |    -5.036 |  -4.723 | -6 to -1 dB/octave | met       | met     |
| `balance`   | `mudShare`         |     0.006 |   0.071 | 0.3 or less 1      | met       | met     |
| `balance`   | `airShare`         |     0.006 |   0.004 | 0.0005 or more 1   | met       | met     |
| `balance`   | `layerOverlap`     |       n/a |   0.238 | 0.7 or less 1      | n/a       | met     |
| `space`     | `correlation`      |     1.000 |   0.640 | 0.9 or less 1      | fails     | met     |
| `space`     | `reverbRatioDb`    |  -235.981 |  -2.754 | -20 to 0 dB        | fails     | met     |
| `position`  | `events`           |    17.000 |  25.000 |                    |           |         |
| `position`  | `panCorrelation`   |     0.000 |   0.832 | 0.7 or more 1      | fails     | met     |
| `sync`      | `pictureTimes`     |     8.000 |   8.000 |                    |           |         |
| `sync`      | `anchoredOnsets`   |     9.000 |   7.000 |                    |           |         |
| `sync`      | `medianAbsErrorMs` |     0.021 |  30.667 | 42 or less ms      | met       | met     |
| `variation` | `maxSimilarity`    |     0.938 |   0.939 | 0.95 or less 1     | met       | met     |
| `master`    | `lufs`             |   -25.664 | -23.000 | -24 to -22 LUFS    | fails     | met     |
| `master`    | `truePeakDbtp`     |    -9.773 |  -1.161 | -1 or less dBTP    | met       | met     |
| `master`    | `crestDb`          |    18.721 |  23.281 | 6 to 20 dB         | met       | fails   |
| `master`    | `clippedSamples`   |     0.000 |   0.000 | 0 or less samples  | met       | met     |

### Two variants of the A/B step

Two plans that differ in one correction (`{"kind": "whoosh", "set": {"macros": {"brightness": 0.4}, "intensity": 0.85}}`,
applied to every `whoosh` and nothing else), each rendered from the start of the clip. Cold is on a new device,
so the first render builds the pipelines and the transform of the partitions. Warm is the same pair again.

| Tier     | Seconds each | Blocks each | Cold: A, B, pair (s)   | Warm: A, B, pair (s)   |
| -------- | -----------: | ----------: | ---------------------- | ---------------------- |
| CPU tier |            2 |          94 | 139.68, 133.08, 272.76 | 139.09, 144.10, 283.18 |
| WebGPU   |           15 |         704 | 42.93, 42.66, 85.59    | 43.02, 42.18, 85.20    |
| WebGL2   |          0.5 |          24 | 36.11, 35.31, 71.42    | 34.40, 32.73, 67.13    |

The pair does not render in under a second on any tier. The WebGPU pair takes 85.59 s cold and 85.20 s warm for
15 s each. A render includes the master and the transform of the partitions (0.2 s on WebGPU, 13.5 s on the CPU
tier, 9.5 s on WebGL2).

### Determinism

The first blocks of the plan rendered twice on one device, the mixes compared bit for bit:

| Tier     | Blocks |  Values | Differ |
| -------- | -----: | ------: | -----: |
| CPU tier |    150 | 307,200 |      0 |
| WebGPU   |    150 | 307,200 |      0 |
| WebGL2   |     20 |  40,960 |      0 |

Command 2 repeats 2 blocks on each tier (4,096 values): 0 values differ on every tier.

Across tiers, command 2 (the mix of the same 40 blocks, 81,920 values):

| Pair                | Values that differ | Largest difference | CPU peak | Relative RMS |
| ------------------- | -----------------: | -----------------: | -------: | -----------: |
| WebGL2 and CPU tier |                  0 |                  0 |    0.439 |            0 |
| WebGPU and CPU tier |             81,917 |            5.23e-4 |    0.439 |      1.18e-3 |

Command 1, the whole clip (2,880,000 values): WebGPU and the CPU tier differ in 2,879,886, by at most 8.44e-4 of a
peak of 0.854, relative RMS 1.18e-3. The WebGL2 render is not compared with the CPU render in command 1 (40 blocks
against the whole clip). The WebGL2 render is the CPU tier's bit for bit in command 2, because 32 of its 33 groups
ran on the CPU tier. The WebGPU difference is the one the determinism report leaves a driver (`sin`, `cos`, `exp`
and `tanh`, compiler surface section 38), carried through the filters and the reverb and then scaled by the
master's gain.

## Against record 08

Record 08 ran at `0f7572a2` (command 1) and `45b9e4b6` (command 2). This record ran at `eef3eba5`. The pull
requests between record 08's commit in `main` (`aa30ef6c`, pull request #38) and this commit, from
`git log --oneline aa30ef6c..eef3eba5`:

| Pull request | Commit in `main` | What changed                                                                                                                                                                                               |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #43          | `e54628e`        | Review fixes: the comparison across tiers refuses mixes of different lengths, an event's key comes from its id, a reflection later than the history is dropped, a footstep and a cloth always have a grain |
| #46          | `b5cad48`        | The duration contract: `whoosh` and `riser` sound for the plan's `duration`                                                                                                                                |
| #44          | `2d0918a`        | The `dipDb` measure reads the layers other than the impact's layer                                                                                                                                         |
| #45          | `9c1266d`        | A device mode for the browser harness (no effect on this run)                                                                                                                                              |
| #48          | `6244198`        | The ducking guard before a hero impact                                                                                                                                                                     |
| #49          | `716813e`        | The kinds' variation: footstep, cloth, impact and whoosh draw more from the event's key                                                                                                                    |
| #50          | `9a423a0`        | The harness scores the checklist on every tier that renders the whole clip                                                                                                                                 |
| #52          | `eef3eba`        | The stand-in dialogue stems differ by event                                                                                                                                                                |

Pull requests #42 and #47 are documents.

### Time per block

| Tier     | Record 08 command 1 (ms) | This record command 1 (ms) | Change | Record 08 command 2 (ms) | This record command 2 (ms) | Change |
| -------- | -----------------------: | -------------------------: | -----: | -----------------------: | -------------------------: | -----: |
| CPU tier |                  1199.30 |                    1274.67 | +6.3 % |                  1315.92 |                    1338.10 | +1.7 % |
| WebGPU   |                    51.89 |                      56.51 | +8.9 % |                    52.28 |                      53.05 | +1.5 % |
| WebGL2   |                   946.67 |                    1040.28 | +9.9 % |                   925.48 |                     959.27 | +3.7 % |

Facts: no shader logic changed. The kernels and the fuse plan are the same (33 calls, 32 groups on WebGPU, 32
dispatches, 1 submission). Pull request #48 added one gain input to `strips`, and `strips` takes 0.85 ms of GPU
time against 0.82 ms in record 08. The mean GPU time of `cues` is 33.52 ms against 33.09 ms.

Inference: the load explains most of the change. The load average of command 1 was 1.6 to 3.3, and record 08's was
1.3 to 2.0. Command 2 ran at a lower 1-minute load (1.0 to 1.3), and its three changes are smaller (+1.5 % to
+3.7 %). This was not tested by a run on a quiet container.

Open: `history` takes 3.09 ms of GPU time against 2.24 ms in record 08 (+0.85 ms), and no pull request changed
`history`. The cause is not known. It may be the load.

Variants and reverb: the cold pair takes 272.76 s against 253.33 s (CPU tier), 85.59 s against 77.41 s (WebGPU)
and 71.42 s against 65.05 s (WebGL2). The reverb prepare takes 13.5 s against 11.3 s (CPU tier), 0.2 s against
0.2 s (WebGPU) and 9.5 s against 8.5 s (WebGL2). These move in the direction of the block times, with the load.

### The checklist

| Measure                   | Record 08: one layer / layered | This record: one layer / layered | Verdicts: one layer / layered |
| ------------------------- | ------------------------------ | -------------------------------- | ----------------------------- |
| `layers.heroEvents`       | 4.000 / 5.000                  | 4.000 / 5.000                    |                               |
| `layers.eventsPerHero`    | 1.000 / 6.000                  | 1.000 / 6.000                    | same: fails / met             |
| `layers.layersPerHero`    | 1.000 / 3.000                  | 1.000 / 3.000                    |                               |
| `dynamics.contrastLu`     | 9.796 / 7.027                  | 10.351 / 7.780                   | same: met / met               |
| `dynamics.dipDb`          | 16.794 / -2.202                | n/a / 5.904                      | met / fails to n/a / met      |
| `dynamics.duckingDb`      | n/a / 10.417                   | n/a / 7.239                      | same: n/a / met               |
| `balance.tiltDbPerOctave` | -5.072 / -4.666                | -5.036 / -4.723                  | same: met / met               |
| `balance.mudShare`        | 0.006 / 0.049                  | 0.006 / 0.071                    | same: met / met               |
| `balance.airShare`        | 0.006 / 0.004                  | 0.006 / 0.004                    | same: met / met               |
| `balance.layerOverlap`    | n/a / 0.271                    | n/a / 0.238                      | same: n/a / met               |
| `space.correlation`       | 1.000 / 0.670                  | 1.000 / 0.640                    | same: fails / met             |
| `space.reverbRatioDb`     | -236.164 / -2.354              | -235.982 / -2.754                | same: fails / met             |
| `position.events`         | 17.000 / 25.000                | 17.000 / 25.000                  |                               |
| `position.panCorrelation` | 0.000 / 0.824                  | 0.000 / 0.832                    | same: fails / met             |
| `sync.pictureTimes`       | 8.000 / 8.000                  | 8.000 / 8.000                    |                               |
| `sync.anchoredOnsets`     | 9.000 / 5.000                  | 9.000 / 7.000                    |                               |
| `sync.medianAbsErrorMs`   | 0.104 / 30.667                 | 0.021 / 30.667                   | same: met / met               |
| `variation.maxSimilarity` | 0.972 / 0.963                  | 0.938 / 0.939                    | fails / fails to met / met    |
| `master.lufs`             | -25.645 / -23.000              | -25.663 / -23.000                | same: fails / met             |
| `master.truePeakDbtp`     | -9.986 / -5.509                | -9.773 / -1.161                  | same: met / met               |
| `master.crestDb`          | 18.444 / 19.186                | 18.721 / 23.281                  | met / met to met / fails      |
| `master.clippedSamples`   | 0.000 / 0.000                  | 0.000 / 0.000                    | same: met / met               |

What moved, and why:

1. `dynamics.dipDb` of the layered render: -2.202 dB (fails) to 5.904 dB (met). Facts: pull request #44 changed
   the measure, #48 added the guard, and #46 and #49 changed the sounds before the impact. The pull requests
   report intermediate values: 0.60 dB after #44 alone, 2.58 dB before and 5.94 dB after #48 (both on WebGPU),
   and 5.905 dB after #52 (WebGPU). This record gives 5.904 dB on the CPU tier and 5.905 dB on WebGPU, so the two
   tiers agree. The one-layer render is `n/a` (it has no stem of another layer), where record 08 had 16.794 dB.
   Open: the pull requests of #44 (0.60 dB) and #48 (2.58 dB) name different values for the same state. The two
   states were not run again, so this record cannot settle it.
2. `variation.maxSimilarity`: 0.972 and 0.963 (both fail) to 0.938 and 0.939 (both met). Facts: #49 widened the
   draws, and its measure moved the one-layer value from 0.967 to 0.938 on the CPU tier. #49 reports that the layered
   value stayed at 1.000 because the stand-in voice stems were the same signal. #52 made them differ, and the layered
   value is 0.939 here.
3. `dynamics.duckingDb`: 10.417 dB to 7.239 dB. Inference: #52 (the stand-in dialogue stems differ by event) changed
   what the dialogue ducker acts on. Not tested.
4. `sync.anchoredOnsets`: 5 to 7 of the layered render. Inference: #46 (the duration contract changes where a
   `whoosh` and a `riser` have their onset against the anchor). Not tested. `sync.medianAbsErrorMs` is 30.667 ms in
   both.
5. `master.crestDb` of the layered render: 19.186 dB (met) to 23.281 dB (fails; the bound is 20 dB). `master.truePeakDbtp`:
   -5.509 dBTP to -1.161 dBTP. The CPU peak of the whole clip is 0.854, against 0.530 in record 08. The loudness
   target is the same (-23.000 LUFS), so the clip has a higher peak at the same loudness. Open: no pull request
   names this change, and this run did not find its cause. Candidates, not tested: the longer `whoosh` and `riser`
   (#46), the wider draws of `impact` (#49), the ducking guard (#48, which lowers the other layers before an impact,
   so the impact stands higher in the mix). Next action: score the stems and the dry render of the old and the new
   renders, to see which layer's peak rose.
   Status, 2026-11-09: the measurement is in progress on branch `claude/crest`; this paragraph holds its result when it ends.
6. Small moves with no single cause named: `dynamics.contrastLu` 7.027 to 7.780, `balance.mudShare` 0.049 to 0.071,
   `balance.layerOverlap` 0.271 to 0.238, `space.correlation` 0.670 to 0.640, `space.reverbRatioDb` -2.354 to -2.754,
   `position.panCorrelation` 0.824 to 0.832 and `balance.tiltDbPerOctave` -4.666 to -4.723. All the kinds and the
   guards changed, so no one pull request is named. No verdict of these measures changed. Listed as open.

Verdicts of the layered render: record 08 failed `dynamics.dipDb` and `variation.maxSimilarity`. This record fails
`master.crestDb` only. Verdicts of the one-layer render: record 08 failed `eventsPerHero`, `correlation`,
`reverbRatioDb`, `panCorrelation`, `lufs` and `variation.maxSimilarity`. This record fails the first five.

### Determinism

| Count                                                 | Record 08                                               | This record                                             |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Values that differ, the repeat, CPU tier (150 blocks) | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGPU (150 blocks)   | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGL2 (20 blocks)    | 0 of 40,960                                             | 0 of 40,960                                             |
| WebGPU and CPU tier, the whole clip                   | 2,879,893 of 2,880,000; largest 1.55e-3 of a peak 0.530 | 2,879,886 of 2,880,000; largest 8.44e-4 of a peak 0.854 |
| WebGPU and CPU tier, 40 blocks                        | 81,918 of 81,920; largest 6.40e-4                       | 81,917 of 81,920; largest 5.23e-4                       |
| WebGL2 and CPU tier, 40 blocks                        | 0 of 81,920                                             | 0 of 81,920                                             |

The determinism counts are the same. The largest difference against the peak is 1.0e-3 here (8.44e-4 of 0.854) and
2.9e-3 in record 08 (1.55e-3 of 0.530). Inference: the peak is higher, and the driver's difference stays the same
size, so the ratio is lower.

### WebGL2 groups

1 of 33 groups ran on WebGL2, as in record 08. The sentences are the same.

## What departs from the method

Each item has its disposition: closed, made part of the design by an amendment, or open. The numbers are those of
record 08's section of the same name, read against this run.

1. **Stand-in dialogue stems.** Still no recorded speech. The stems differ by event since #52. Open, as in record
   08: the ducking measure of 7.24 dB is the ducker acting on a stand-in. Next action: a recorded or licensed stem.
2. **Grains are synthesized bursts, and the scheduler is not used.** Open, as in record 08.
3. **No HRTF set.** Open, as in record 08. The run renders for speakers.
4. **The convolution's transform is kernel functions, not experiment 5's entry.** Closed, as in record 08.
5. **The master is host-side and runs after the render.** Closed, as the design of `src/master.ts`.
6. **The timed run is the whole clip only on the CPU tier and on WebGPU.** WebGL2 rendered 40 blocks, the variants
   are 2 s on the CPU tier and 0.5 s on WebGL2, and the determinism count is 150 blocks (20 on WebGL2). A full
   pass of the CPU tier took 30.6 minutes. Open. Next action: the device runs.
7. **No propagation delay.** Closed, as a design choice.
8. **`whoosh` and `riser` lengths.** Closed at #46. This run measures the closed state.
9. **The one-layer plan.** Closed as an interpretation, as in record 08.
10. **Levels of the kinds** (`KIND_GAIN`) were set from the peaks of the fixture's events, not by ear. Open. The
    higher peak of this run (see "Against record 08", item 5) may bear on it.
11. **The note's status sentence** ("Nothing in this note is built yet") is unchanged. Open. Next action: the owner.
12. **The `webgl2-cpu` entry of `across` in command 1's JSON.** Closed: the harness refuses the comparison and
    writes the reason (#43). Command 2 holds the valid comparison.
13. **The load of the container.** The container was loaded by other sessions during command 1
    (see "The devices"). The block times carry it. Open. Next action: the device runs.

## Open items

| Item                                                                                                               | Reason                                                                                                          | Next action                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No tier keeps the 21.33 ms budget                                                                                  | `cues` is 71 % of the GPU time of a block on WebGPU, and the CPU tier and WebGL2 run the convolution on the CPU | A device run; a `cues` that spreads one event over several lanes; change 0092 for the CPU tier |
| `history` and `pack` store twice                                                                                   | The WebGL2 sentence above names the fix                                                                         | Fold the branches into one store                                                               |
| `master.crestDb` fails on the layered render (23.28 dB, bound 20 dB), and the true peak is 0.16 dB under its bound | The peak of the clip rose from 0.530 to 0.854 at the same loudness. No cause is named                           | Score the stems and the dry render, and find the layer whose peak rose                         |
| `history` takes 0.85 ms more GPU time than in record 08                                                            | No pull request changed `history`                                                                               | Run it again on a quiet container                                                              |
| The values of `dipDb` after #44 (0.60 dB) and before #48 (2.58 dB) differ                                          | The two states were not run again                                                                               | None needed unless the history matters                                                         |
| Thresholds of `DEFAULT_RULES`                                                                                      | Starting values                                                                                                 | Fit them on more plans                                                                         |
| The device runs                                                                                                    | The container's SwiftShader is not a GPU                                                                        | The owner runs `docs/device-runs.md` at `eef3eba5`                                             |

## Checks of this pull request

- `bun run check`, 2026-11-09, `eef3eba` with this pull request's documents, Bun 1.4.4: exit 0.
- `bun run test`, the same configuration: 17 files, 163 tests passed.
- `bun run test:gpu`: not run. No kernel, unit, render or `explain` code changed.
- `bunx prettier --config /home/user/typeshade/.prettierrc.json --check` on the `.md` files this pull request writes
  or touches: see the pull request body.
