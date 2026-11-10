# Record 08, fourth run: a layered, spatial render of a hand-written plan, on a quiet container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures on the commit that the device runs will use. They do
> not stand for a GPU's time per block, and they decide nothing about the owner's devices. The
> device runs of experiment 8 are pending (`docs/experiments.md`, section 8).

This is the fourth container run of experiment 8. The first three are `docs/records/08-sound-design-container.md`
(record 08), `docs/records/08-sound-design-container-2.md` (record 08-2, commit `eef3eba5`) and
`docs/records/08-sound-design-container-3.md` (record 08-3, commit `7ecf6764`). Record 08-3 failed
`master.crestDb` on the layered render (23.28 dB, bound 20 dB). Two pull requests changed the render's
bits since, and no kernel: #63 (no more than two grains of one cloud sound at once) and #65 (the level of a
`footstep` or a `cloth` follows its intensity, not its draw). The owner said on 2026-11-09 to proceed toward
the better fix of the crest failure and its record. This run records the checklist with both pull requests.
It also measures the time per block on a quiet container, because record 08-3 ran under a load average of 2.7
to 5.7 and listed a rise of four fuse groups as open.

Records 08, 08-2 and 08-3 keep their numbers. The section "Against record 08-3" compares this run with
record 08-3, and the time per block with all three.

## The run

| Item                 | Value                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment           | 8, a layered, spatial render of a hand-written plan (`docs/experiments.md`, section 8)                                                                                                                                                                                                                                    |
| Command 1            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --out docs/records/08-sound-design-container-4.json` (run as `bun experiments/08-sound-design/run.ts --out docs/records/08-sound-design-container-4.json`, which is the same script) |
| Command 2            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --tier all --blocks 40 --repeat-blocks 2 --variant-seconds 0 --out docs/records/08-sound-design-container-4-tiers.json` (run as the same script with the same options)               |
| Options of command 1 | The defaults of `experiments/08-sound-design/run.ts`: blocks `cpu=0,webgpu=0,webgl2=40` (0 is the whole clip), repeat blocks `cpu=150,webgpu=150,webgl2=20`, variant seconds `cpu=2,webgpu=15,webgl2=0.5`                                                                                                                 |
| Date                 | Command 1: from 2026-11-09 23:32:45 UTC to 2026-11-10 00:21:58 UTC (49 minutes; the CPU tier took 27.8 minutes for the 1,407 blocks). Command 2: from 00:23:34 to 00:26:14 UTC on 2026-11-10                                                                                                                              |
| Commit               | Command 1: `3b0a4557f9b639cd2136737f0871c598526318a1` of `typeshade/typeaudio` (`main`, pull request #65), clean tree (the JSON says `dirty` false). Command 2: `025e1a0aaf570a63a5d105c0594f98810c6fe77d`, which is `3b0a455` plus the JSON file of command 1, clean tree. The two differ in no source file              |
| Compiler pin         | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null), the same pin as records 08, 08-2 and 08-3                                                                                                |
| Tools                | Bun 1.4.4, Node v22.23.4, Chrome Headless Shell 153.0.8010.12 (the same binary as records 08, 08-2 and 08-3)                                                                                                                                                                                                              |
| Raw data             | `docs/records/08-sound-design-container-4.json` (command 1) and `docs/records/08-sound-design-container-4-tiers.json` (command 2): the options, each tier's block timings, fuse groups, device info, the repeat and variant timings, the comparison across tiers, and the checklists                                      |
| Outputs              | The CPU arm writes the stems, the reverb's return, the mix and the one-layer mix as 32-bit float WAV into `experiments/08-sound-design/out/`, which Git ignores                                                                                                                                                           |

The `webgl2-cpu` entry of `across` in the JSON of command 1 holds no comparison: the harness refuses it
(pull request #43) because WebGL2 rendered 40 blocks and the CPU tier the whole clip. The entry is
`skipped`, with the reason. Command 2 renders the same 40 blocks on every tier and holds the comparison.

## The devices

| Item     | CPU tier (Node)                                         | WebGPU                                                                                                                                               | WebGL2                                                                                       |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores; Linux 6.18.44 | the same                                                                                                                                             | the same                                                                                     |
| Runtime  | Node v22.23.4                                           | Chrome Headless Shell 153.0.8010.12, cross-origin isolated                                                                                           | the same                                                                                     |
| Graphics | none                                                    | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `subgroups` and `timestamp-query` | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The device table is the same as the tables of records 08, 08-2 and 08-3. The WebGPU adapter reports subgroups
of size 4 (64 subgroups).

### The load of the container

The runner recorded the load average over 1, 5 and 15 minutes, on 4 cores, around each tier. In this run no
other agent used the container (the orchestrator started none until this run reported). A tier's own work
raises the load: the CPU tier keeps one core busy, and SwiftShader uses several.

Command 1:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 0.16, 0.49, 0.65 | 1.26, 1.16, 1.14 |
| WebGPU   | 1.26, 1.16, 1.14 | 2.35, 1.67, 1.34 |
| WebGL2   | 2.35, 1.67, 1.34 | 1.45, 1.46, 1.31 |

Command 2:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 0.43, 1.07, 1.19 | 1.08, 1.15, 1.20 |
| WebGPU   | 1.08, 1.15, 1.20 | 1.08, 1.15, 1.20 |
| WebGL2   | 1.08, 1.15, 1.20 | 1.32, 1.21, 1.21 |

Fact: the load before command 1 was 0.16 (the runner) and 0.09 (`/proc/loadavg` at 23:32). Record 08-3 recorded
2.68 to 5.70 around its tiers, record 08-2 1.0 to 3.3 and record 08 1.3 to 2.0. The WebGPU "before" and "after"
rows of command 2 are the same numbers, as the runner wrote them.

Waiting for the browser (the rule of the run: start a command only when no browser runs and the one-minute load
is under 0.5). Before command 1, `pgrep -fa chrome-headless-shell` showed no browser and the load was 0.09, so
this run did not wait. Before command 2, the load was 0.87 at 00:22 UTC, after command 1's last tier. This run
waited one minute. At 00:23:30 UTC the load was 0.32 and no browser ran, and command 2 started. The runner
starts each tier's browser by itself, so this run checked for a second browser before each command only. Not
checked: whether a browser of another agent ran between the tiers of a command. The logs show no closed page.

## The method

The method is the method of records 08, 08-2 and 08-3, with this change of the code since record 08-3
(`git diff --stat 7ecf6764 3b0a455 -- src experiments test package.json bun.lock`: `src/index.ts`,
`src/kinds/make.ts` and `test/kinds.test.ts`; no kernel, no unit, no harness file):

- Pull request #63 (`4b083ad`): `drawGrains` in `src/kinds/make.ts` skips a drawn start that would be the third
  grain sounding in one cloud (`MAX_SOUNDING = 2`). The draw stays deterministic from the event's key.
- Pull request #65 (`3b0a455`): `KIND_PEAK = 0.5`. `footstep` and `cloth` scale every grain so that the event's
  peak before the spatial chain is its intensity times `KIND_PEAK`. `KIND_GAIN` loses `footstep` and `cloth`.

Layered render of the fixture: -29.69 LUFS before the master, +6.69 dB of gain, no gain from the limiter (its
deepest gain is 0 dB; the true peak of the scaled mix is -5.30 dBTP, 4.30 dB under the bound of -1). Record 08-3:
-29.31 LUFS, +6.31 dB, -1.16 dBTP.

## The numbers

### Time per block

Host time of a block: its `fuse` scope and the read of its output, in milliseconds. The first block builds the
pipelines and is apart. The budget of a block of 1,024 frames at 48 kHz is 21.33 ms. Real time is the seconds of
audio rendered per second of host time over the blocks.

Command 1:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |  1,407 |     1162.94 |  1344.04 |  1010.60 |  1984.77 |    1355.96 |         1,406 |    0.018x |               11.0 |
| WebGPU   | webgpu |  1,407 |       21.05 |    27.93 |    16.02 |    42.16 |     771.94 |           651 |    0.958x |                0.1 |
| WebGL2   | webgl2 |     40 |      908.16 |  1058.20 |   844.26 |  1125.94 |    1143.58 |            39 |    0.023x |                8.2 |

Command 2, the same 40 blocks on every tier:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |     40 |     1133.83 |  1272.23 |  1056.60 |  1278.43 |    1194.29 |            39 |    0.019x |               10.4 |
| WebGPU   | webgpu |     40 |       18.79 |    23.15 |    15.04 |    28.10 |     692.54 |             4 |    0.598x |                0.1 |
| WebGL2   | webgl2 |     40 |      910.96 |  1011.57 |   824.41 |  1028.45 |    1030.52 |            39 |    0.023x |                8.0 |

Facts. WebGPU on SwiftShader takes 21.05 ms at the median over the whole clip. That is 0.99 times the budget,
and 651 of its 1,407 blocks are over the budget (record 08-3: 1,328). The p95 is 27.93 ms. On the first 40
blocks, WebGPU takes 18.79 ms at the median, under the budget, and 4 of 40 blocks are over. The CPU tier
takes 1,162.94 ms and WebGL2 takes 908.16 ms: both are far over the budget. Real time on WebGPU is 0.958x
(0.791x in record 08-3). The whole-clip median of WebGPU is above the budget by 0.28 ms, so the budget is met
on about half of the blocks and not at the median of the clip.

### Where the time goes on WebGPU

Mean GPU time of each group over the 40 blocks of command 2, from `gpuTime` of the fuse report. The sum is
13.60 ms (20.67 ms in record 08-3, 47.46 ms in record 08-2).

| Group                                                                        | GPU time (ms) |  Share |
| ---------------------------------------------------------------------------- | ------------: | -----: |
| `place`                                                                      |          2.76 | 20.3 % |
| `accumulate2`                                                                |          2.34 | 17.2 % |
| the nine kinds' kernels (`whooshes+impacts` fused, then eight single groups) |          1.71 | 12.6 % |
| `fftStage` (22 stages, `store` fused into the eleventh)                      |          1.68 | 12.4 % |
| `history`                                                                    |          1.68 | 12.4 % |
| the nine `gather` groups                                                     |          1.39 | 10.2 % |
| `layers`                                                                     |          0.90 |  6.6 % |
| `strips`                                                                     |          0.79 |  5.8 % |
| `pack`, `overlap2`, `pad`, `sendSum`                                         |          0.35 |  2.5 % |

The report of the last block: `tier` `webgpu`, 48 dispatches, 1 submission, 48 groups from 50 calls. Two
pairs fuse: `whooshes` with `impacts` and `fftStage` with `store`. Each other group stands apart for the reason
that the fuse report gives. The 48 groups and their `why` sentences are the same as in record 08-3, word for
word (compared by script over the two JSON files: 0 groups differ). The sentences are "impacts and shimmers run
as two dispatches because the trip counts differ (4 and 3)", and the same sentence for the next kinds (3 and 1,
1 and 2, 2 and 3, 3 and 4, 4 and 1, 1 and 3), then "voices and gather run as two dispatches because the trip
counts differ (3 and 25)". The other eight `gather` calls stand apart for the sentence "gather and gather run as
two dispatches because gather writes an array gather also writes". `history` follows with "gather and history
run as two dispatches because the trip counts differ (25 and 128000)".

### Which calls the tiers ran

Command 2, the last block's report. On the CPU tier, all 50 groups ran on the CPU. On WebGPU, all 48 groups ran
on WebGPU. On WebGL2, **1 of 50 groups** ran on WebGL2 (`sendSum`: "WebGL2 runs the calls apart") and 49 ran on
the CPU tier. Record 08-3 counted 1 of 50, and records 08 and 08-2 counted 1 of 33. The sentences are the
sentences of record 08-3, word for word:

| Calls                                                                       | `why` of the report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the nine kinds' kernels, `place`, `layers`, `strips`, `overlap2` (13 calls) | `<name> runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| nine `gather`                                                               | `gather runs on the CPU, it runs on the CPU, loop 1 writes "raws" other than at i`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 22 `fftStage`, `accumulate2`                                                | `<name> runs on the CPU, it runs on the CPU, loop 1 writes "out", whose element is not one f32, i32 or u32` (for `accumulate2`, `"sum"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pad`                                                                       | `pad runs on the CPU, it runs on the CPU, loop 1 writes "padded", whose element is not one f32, i32 or u32`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `store`                                                                     | `store runs on the CPU, it runs on the CPU, loop 1 writes "line" other than at i`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `history`                                                                   | `history runs on the CPU, it runs on the CPU, its GLSL did not emit: typeshade [SD0111]: portable kernel outside the gather-only tier — 'history_gl0' writes to '_out' 2 times — the portable tier stores exactly once, _out[_gid.x] = f(reads), so fold the branches into a single value and store it once` and a second line, "hint: the portable tier is out[gid.x] = f(reads): a 1-D gid and workgroup, one u32 storage output written once at the invocation index, a vec4<u32> dispatch uniform, no raw statements — restructure or drop portable to keep the kernel WebGPU-only" |
| `pack`                                                                      | the same two lines for `'pack_gl0'`, 3 times                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The first row holds 13 calls: the nine kinds' kernels, `place`, `layers`, `strips` and `overlap2`. The
backticks that the original sentence of `history` puts around `_out[_gid.x] = f(reads)` and `portable` are left
out of the table cell, so that the cell is one code span. The words are the same. Fact: 1 of 50 groups ran on
WebGL2, as in record 08-3. No new kind of refusal appeared.

These are the limits of ask AA of `docs/compiler-asks.md` (a loop that writes a `vec2`, writes off its counter
or writes two arrays, on WebGL2), met by the kernels of this experiment, and the form of record 08: `history`
and `pack` store in two branches.

### The eight dimensions

Command 1, the CPU arm: the one-layer render (17 events) and the layered render (25 events). A measure with no
rule has none in `DEFAULT_RULES`.

| Dimension   | Measure            | One layer | Layered | Rule               | One layer | Layered |
| ----------- | ------------------ | --------: | ------: | ------------------ | --------- | ------- |
| `layers`    | `heroEvents`       |     4.000 |   5.000 |                    |           |         |
| `layers`    | `eventsPerHero`    |     1.000 |   6.000 | 3 to 7 events      | fails     | met     |
| `layers`    | `layersPerHero`    |     1.000 |   3.000 |                    |           |         |
| `dynamics`  | `contrastLu`       |    10.351 |   7.610 | 6 or more LU       | met       | met     |
| `dynamics`  | `dipDb`            |       n/a |   5.904 | 3 or more dB       | n/a       | met     |
| `dynamics`  | `duckingDb`        |       n/a |   7.239 | 3 or more dB       | n/a       | met     |
| `balance`   | `tiltDbPerOctave`  |    -5.036 |  -4.842 | -6 to -1 dB/octave | met       | met     |
| `balance`   | `mudShare`         |     0.006 |   0.075 | 0.3 or less 1      | met       | met     |
| `balance`   | `airShare`         |     0.006 |   0.004 | 0.0005 or more 1   | met       | met     |
| `balance`   | `layerOverlap`     |       n/a |   0.244 | 0.7 or less 1      | n/a       | met     |
| `space`     | `correlation`      |     1.000 |   0.629 | 0.9 or less 1      | fails     | met     |
| `space`     | `reverbRatioDb`    |  -235.982 |  -2.594 | -20 to 0 dB        | fails     | met     |
| `position`  | `events`           |    17.000 |  25.000 |                    |           |         |
| `position`  | `panCorrelation`   |     0.000 |   0.832 | 0.7 or more 1      | fails     | met     |
| `sync`      | `pictureTimes`     |     8.000 |   8.000 |                    |           |         |
| `sync`      | `anchoredOnsets`   |     9.000 |   6.000 |                    |           |         |
| `sync`      | `medianAbsErrorMs` |     0.021 |  30.667 | 42 or less ms      | met       | met     |
| `variation` | `maxSimilarity`    |     0.938 |   0.939 | 0.95 or less 1     | met       | met     |
| `master`    | `lufs`             |   -25.663 | -23.000 | -24 to -22 LUFS    | fails     | met     |
| `master`    | `truePeakDbtp`     |    -9.773 |  -5.302 | -1 or less dBTP    | met       | met     |
| `master`    | `crestDb`          |    18.721 |  19.160 | 6 to 20 dB         | met       | met     |
| `master`    | `clippedSamples`   |     0.000 |   0.000 | 0 or less samples  | met       | met     |

Facts of the table:

- Every rule of the layered render reads "met". No rule of the layered render reads "fails".
- The one-layer render fails, and the layered render meets: `layers.eventsPerHero`, `space.correlation`,
  `space.reverbRatioDb`, `position.panCorrelation` and `master.lufs`.
- Both meet: `dynamics.contrastLu`, `balance.tiltDbPerOctave`, `balance.mudShare`, `balance.airShare`,
  `sync.medianAbsErrorMs`, `variation.maxSimilarity` (0.938 and 0.939 against 0.95 or less), `master.truePeakDbtp`,
  `master.crestDb` (18.72 and 19.16 dB against 6 to 20 dB) and `master.clippedSamples`.
- `master.crestDb` of the layered render, 19.160 dB, is 0.840 dB under its bound of 20 dB. `master.truePeakDbtp`,
  -5.302 dBTP, is 4.302 dB under its bound of -1. `sync.medianAbsErrorMs`, 30.67 ms, is 11.3 ms under its bound
  of 42.
- Not measurable on the one-layer render: `dynamics.dipDb`, `dynamics.duckingDb` (no dialogue stem) and
  `balance.layerOverlap` (one layer sounds).
- `space.reverbRatioDb` of the one-layer render, -236 dB, is a dry render: the wet energy is zero and the analyzer
  floors it at 1e-20.
- The WebGPU arm scores the checklist too (since pull request #50). Its verdict of every rule is the CPU arm's.
  Its values differ in the third decimal or less: `dipDb` 5.905 dB (CPU tier 5.904), `contrastLu` 7.609 (7.610),
  the one-layer `space.reverbRatioDb` -235.981 (-235.982) and the one-layer `master.lufs` -25.664 (-25.663). The WebGL2 tier writes no checklist (it rendered 40 blocks, and a short
  render has a different master gain).
- The WebGPU values equal the values that pull request #65 measured on WebGPU: `master.crestDb` 19.160 dB,
  `master.truePeakDbtp` -5.302 dBTP, `dynamics.dipDb` 5.905 dB, `variation.maxSimilarity` 0.939 (0.9386),
  `master.lufs` -23.000. The configuration of that measurement is the pull request's text, not this run's.

### Two variants of the A/B step

Two plans that differ in one correction (`{"kind": "whoosh", "set": {"macros": {"brightness": 0.4},
"intensity": 0.85}}`, applied to every `whoosh` and nothing else), each rendered from the start of the clip. Cold
is on a new device, so the first render builds the pipelines and the transform of the partitions; warm is the
same pair again.

| Tier     | Seconds each | Blocks each | Cold: A, B, pair (s)   | Warm: A, B, pair (s)   |
| -------- | -----------: | ----------: | ---------------------- | ---------------------- |
| CPU tier |            2 |          94 | 118.97, 123.75, 242.72 | 125.00, 126.91, 251.92 |
| WebGPU   |           15 |         704 | 17.01, 15.81, 32.81    | 15.57, 15.43, 30.99    |
| WebGL2   |          0.5 |          24 | 31.50, 30.87, 62.37    | 30.84, 31.51, 62.35    |

The pair does not render in under a second on any tier. The WebGPU pair takes 32.81 s cold and 30.99 s warm for
15 s each (record 08-3: 39.97 s and 39.82 s). A render includes the master and the transform of the partitions
(0.1 s on WebGPU, 11.0 s on the CPU tier, 8.2 s on WebGL2).

### Determinism

The first blocks of the plan rendered twice on one device, the mixes compared bit for bit:

| Tier     | Blocks |  Values | Differ |
| -------- | -----: | ------: | -----: |
| CPU tier |    150 | 307,200 |      0 |
| WebGPU   |    150 | 307,200 |      0 |
| WebGL2   |     20 |  40,960 |      0 |

Command 2 repeated 2 blocks (4,096 values) on each tier: 0 values differ on all three.

Across tiers, command 2 (the mix of the same 40 blocks, 81,920 values):

| Pair                | Values that differ | Largest difference | CPU peak | Relative RMS |
| ------------------- | -----------------: | -----------------: | -------: | -----------: |
| WebGL2 and CPU tier |                  0 |                  0 |    0.439 |            0 |
| WebGPU and CPU tier |             81,917 |            5.23e-4 |    0.439 |      1.18e-3 |

Command 1, the whole clip (2,880,000 values): WebGPU and the CPU tier differ in 2,879,881, by at most 8.82e-4 of a
peak of 0.543, relative RMS 1.21e-3. The WebGL2 render is the CPU tier's bit for bit because 49 of its 50 groups
ran on the CPU tier. The WebGPU difference is the one the determinism report leaves a driver (`sin`, `cos`,
`exp` and `tanh`, compiler surface section 38), carried through the filters and the reverb and then scaled by the
master's gain.

## Against record 08-3

Record 08-3 ran at `7ecf6764` (command 1) and `adaa1a5b` (command 2). This record ran at `3b0a455` (command 1)
and `025e1a0` (command 2). The pull requests between the two, from `git log --oneline 7ecf6764..origin/main` (read
at `3b0a455`):

| Pull request | Commit in `main` | What changed                                                                                                                                                |
| ------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #61          | `c6757c5`        | A record: the cause of the layered render's crest factor rise (no code)                                                                                     |
| #62          | `3123556`        | A record: record 08-3 (no code)                                                                                                                             |
| #64          | `730df20`        | A record: record 08-3 names the cause of the crest rise (no code)                                                                                           |
| #63          | `4b083ad`        | `MAX_SOUNDING = 2`: no more than two grains of one cloud sound at once (`src/kinds/make.ts`). **Moves the render's bits.** No kernel                        |
| #65          | `3b0a455`        | `KIND_PEAK = 0.5`: the level of a `footstep` or a `cloth` follows its intensity, not its draw (`src/kinds/make.ts`). **Moves the render's bits.** No kernel |

The commits `54a8084` (record 08-2, #58), `dc3830c` (asks AD and AE, #59) and `c76ba1b` (Vitest option, #60) are
listed by `git log` too, because they merged in a different order than `7ecf6764`. They are documents or a test
option, and `git diff --stat 7ecf6764 3b0a455 -- src experiments test` names three files only (see "The method").

### The checklist

Both the CPU arm and the WebGPU arm of this run give the values below, to the third decimal, except where the
WebGPU value differs in the last digit (see "The eight dimensions"). The table gives the layered values that
changed. The pull request is the one that the text of the pull request names for the value. Where a value moved
and no pull request measured it, the cell says so.

| Measure (layered)         | Record 08-3 | This record | Verdict, 08-3 to this record | What changed it                                                                                                                                                |
| ------------------------- | ----------: | ----------: | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master.crestDb`          |      23.281 |      19.160 | fails to met                 | #63 (23.281 to 20.957, fails) and #65 (20.957 to 19.160), as the two pull requests measured them on WebGPU                                                     |
| `master.truePeakDbtp`     |      -1.161 |      -5.302 | met to met                   | #63 (-1.161 to -3.624) and #65 (-3.624 to -5.302), as measured by the pull requests                                                                            |
| `dynamics.contrastLu`     |       7.780 |       7.610 | met to met                   | #63 (7.780 to 7.609, as measured by the pull request). The text of #65 does not list it                                                                        |
| `balance.tiltDbPerOctave` |      -4.723 |      -4.842 | met to met                   | #63 and #65 together. Inference: the render's spectrum moved with its grains. The split is not measured                                                        |
| `balance.mudShare`        |       0.071 |       0.075 | met to met                   | #63 and #65 together. The split is not measured                                                                                                                |
| `balance.layerOverlap`    |       0.238 |       0.244 | met to met                   | #63 and #65 together. The split is not measured                                                                                                                |
| `space.correlation`       |       0.640 |       0.629 | met to met                   | #63 and #65 together. The split is not measured                                                                                                                |
| `space.reverbRatioDb`     |      -2.754 |      -2.594 | met to met                   | #63 and #65 together. The split is not measured                                                                                                                |
| `sync.anchoredOnsets`     |       7.000 |       6.000 | no rule                      | #63 and #65 together. Inference: one onset of a `footstep` or a `cloth` left the anchor's window when its grains moved. Not tested. Listed as open (see below) |

Facts of the comparison:

- Every other value of the layered render is equal to record 08-3 to the third decimal: `layers.heroEvents`,
  `layers.eventsPerHero`, `layers.layersPerHero`, `dynamics.dipDb` (5.904), `dynamics.duckingDb` (7.239),
  `balance.airShare`, `position.events`, `position.panCorrelation` (0.832), `sync.pictureTimes`,
  `sync.medianAbsErrorMs` (30.667), `variation.maxSimilarity` (0.939), `master.lufs` and
  `master.clippedSamples`.
- Every value of the one-layer render is equal to record 08-3 to the third decimal. Pull request #65 said the
  one-layer render did not move.
- The master: -29.694 LUFS before the master (record 08-3: -29.307) and +6.694 dB of gain (+6.307). The CPU peak of
  the whole clip is 0.543 (0.854 in record 08-3, 0.530 in record 08). Fact: the peak of record 08-3 was the
  `foley` stem alone, the event `cloth-1`, at 3.2285 s (record 08-3, item 5). Pull request #63 text says the clip's
  peak was still `cloth-1` at 3.2301 s after #63, and that the next peak is `impact-d` at 23.067 s. This run did
  not measure the location of the peak. Inference: the peak of this render is no longer `cloth-1`.

Verdicts of both renders next to record 08-3's:

| Rule                      | 08-3: one layer / layered | This record: one layer / layered |
| ------------------------- | ------------------------- | -------------------------------- |
| `layers.eventsPerHero`    | fails / met               | fails / met                      |
| `dynamics.contrastLu`     | met / met                 | met / met                        |
| `dynamics.dipDb`          | n/a / met                 | n/a / met                        |
| `dynamics.duckingDb`      | n/a / met                 | n/a / met                        |
| `balance.tiltDbPerOctave` | met / met                 | met / met                        |
| `balance.mudShare`        | met / met                 | met / met                        |
| `balance.airShare`        | met / met                 | met / met                        |
| `balance.layerOverlap`    | n/a / met                 | n/a / met                        |
| `space.correlation`       | fails / met               | fails / met                      |
| `space.reverbRatioDb`     | fails / met               | fails / met                      |
| `position.panCorrelation` | fails / met               | fails / met                      |
| `sync.medianAbsErrorMs`   | met / met                 | met / met                        |
| `variation.maxSimilarity` | met / met                 | met / met                        |
| `master.lufs`             | fails / met               | fails / met                      |
| `master.truePeakDbtp`     | met / met                 | met / met                        |
| `master.crestDb`          | met / **fails**           | met / **met**                    |
| `master.clippedSamples`   | met / met                 | met / met                        |

One verdict changed: `master.crestDb` of the layered render, from "fails" to "met". The layered render fails no
rule. The one-layer render fails the same five rules as in record 08-3 (`eventsPerHero`, `correlation`,
`reverbRatioDb`, `panCorrelation`, `lufs`). The one-layer render is a plan with one sound at each moment, and
those five rules are the ones that the layered, spatial render exists to meet.

### Time per block

Median of the block time, in milliseconds, in records 08, 08-2, 08-3 and this record.

| Tier, command | Record 08 | Record 08-2 | Record 08-3 | This record | Change against 08-3 |
| ------------- | --------: | ----------: | ----------: | ----------: | ------------------: |
| CPU tier, 1   |   1199.30 |     1274.67 |     1299.35 |     1162.94 |             -10.5 % |
| WebGPU, 1     |     51.89 |       56.51 |       25.51 |       21.05 |             -17.5 % |
| WebGL2, 1     |    946.67 |     1040.28 |     1023.84 |      908.16 |             -11.3 % |
| CPU tier, 2   |   1315.92 |     1338.10 |     1437.19 |     1133.83 |             -21.1 % |
| WebGPU, 2     |     52.28 |       53.05 |       27.58 |       18.79 |             -31.9 % |
| WebGL2, 2     |    925.48 |      959.27 |     1004.04 |      910.96 |              -9.3 % |

Facts:

- Every tier is faster than in record 08-3, on both commands, by 9 % to 32 %. The CPU tier and WebGL2 are faster
  than in record 08 (command 1: -3.0 % and -4.1 %; command 2: -13.8 % and -1.6 %) too.
- The CPU tier and WebGL2 run the same kernels on the CPU. The code of the kernels did not change since record
  08-3. The load before command 1 was 0.16, against 3.41 in record 08-3. Inference: the load of record 08-3
  made its CPU tier and WebGL2 slower, as record 08-3 inferred. This run supports the inference, with one
  quiet container. It did not vary the load on purpose, so it does not prove it.
- WebGPU command 1: the median fell from 25.51 to 21.05 ms, the p95 from 33.91 to 27.93 ms, the blocks over the
  budget from 1,328 to 651 of 1,407, and the first block from 949.18 to 771.94 ms.
- The CPU tier takes 1,162.94 ms at the median over the whole clip (command 1) and 1,133.83 ms over 40 blocks
  (command 2). In record 08-3 the two were 1,299.35 and 1,437.19 ms: the 40-block value was higher than the
  whole-clip value by 138 ms. This run has the 40-block value lower than the whole-clip value by 29 ms. Open: this
  run does not say why the 40-block pass of record 08-3 ran 10 % slower than its whole-clip pass.
- The cold pair takes 242.72 s against 292.92 s (CPU tier, -17 %), 32.81 s against 39.97 s (WebGPU, -18 %) and 62.37
  s against 68.80 s (WebGL2, -9 %). The reverb prepare takes 11.0 s against 13.6 s (CPU tier), 0.1 s against
  0.2 s (WebGPU) and 8.2 s against 9.0 s (WebGL2).

GPU time of each fuse group on WebGPU (the mean over the 40 blocks of command 2, in milliseconds):

| Group                                | Record 08 | Record 08-2 | Record 08-3 | This record | Change against 08-3 |
| ------------------------------------ | --------: | ----------: | ----------: | ----------: | ------------------: |
| `accumulate2`                        |      3.43 |        3.42 |        4.75 |        2.34 |             -50.7 % |
| `place`                              |      2.76 |        2.76 |        3.20 |        2.76 |             -13.8 % |
| `fftStage` (22 stages)               |      2.26 |        2.32 |        2.83 |        1.68 |             -40.6 % |
| `history`                            |      2.24 |        3.09 |        2.52 |        1.68 |             -33.2 % |
| `layers`                             |      0.95 |        0.91 |        1.20 |        0.90 |             -25.1 % |
| `strips`                             |      0.82 |        0.85 |        0.92 |        0.79 |             -14.6 % |
| the nine kinds' kernels              |           |             |        2.94 |        1.71 |             -41.7 % |
| the nine `gather` groups             |           |             |        1.77 |        1.39 |             -21.5 % |
| `cues`                               |     33.09 |       33.52 |             |             |                     |
| `pack`, `overlap2`, `pad`, `sendSum` |      0.50 |        0.59 |        0.54 |        0.35 |             -36.0 % |
| Sum                                  |     46.05 |       47.46 |       20.67 |       13.60 |             -34.2 % |

Facts:

- The rise that record 08-3 listed as open (`accumulate2` +39 %, `place` +16 %, `fftStage` +22 %, `layers`
  +32 % against record 08-2) is not there on the quiet container. Against record 08-2, this run reads:
  `accumulate2` 2.34 against 3.42 ms (-32 %), `place` 2.76 against 2.76 (0 %), `fftStage` 1.68 against 2.32
  (-28 %) and `layers` 0.90 against 0.91 (-1 %).
- Every group of the table is faster than in record 08-3, and the sum fell by 34 %. The nine kinds' kernels fell
  by 42 %, though pull requests #63 and #65 changed their data only (`src/kinds/make.ts` runs on the host).
- `history` fell below its record 08 value (2.24 ms): 1.68 ms. Record 08-2 listed its rise from 2.24 to 3.09 ms
  as open, and record 08-3 did not decide it (2.52 ms). This run reads 1.68 ms.
- Inference, labelled: the groups' GPU time includes the CPU that SwiftShader runs on. Records 08-2 and 08-3 ran
  under loads of 1.0 to 3.3 and 2.7 to 5.7. This run ran under a load of 0.16 to 2.35, of which the run itself was
  the larger part. The shared fall of every group fits the load as the cause. It was not tested by a run under a
  controlled load.
- Not explained: `place` equals its record 08 and 08-2 value (2.76 ms) to the digit. This run does not explain
  why `place` stayed at 2.76 ms in three of four runs while the other groups moved. Listed as open, with low
  weight: the value could be the floor of the group on this SwiftShader.

### Determinism

| Count                                                 | Record 08                                               | Record 08-2                                             | Record 08-3                                             | This record                                             |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Values that differ, the repeat, CPU tier (150 blocks) | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGPU (150 blocks)   | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGL2 (20 blocks)    | 0 of 40,960                                             | 0 of 40,960                                             | 0 of 40,960                                             | 0 of 40,960                                             |
| Values that differ, the repeat, command 2 (2 blocks)  | 0 of 4,096 on each tier                                 | 0 of 4,096 on each tier                                 | 0 of 4,096 on each tier                                 | 0 of 4,096 on each tier                                 |
| WebGPU and CPU tier, the whole clip                   | 2,879,893 of 2,880,000; largest 1.55e-3 of a peak 0.530 | 2,879,886 of 2,880,000; largest 8.44e-4 of a peak 0.854 | 2,879,886 of 2,880,000; largest 8.44e-4 of a peak 0.854 | 2,879,881 of 2,880,000; largest 8.82e-4 of a peak 0.543 |
| WebGPU and CPU tier, 40 blocks                        | 81,918 of 81,920; largest 6.40e-4                       | 81,917 of 81,920; largest 5.23e-4                       | 81,917 of 81,920; largest 5.23e-4                       | 81,917 of 81,920; largest 5.23e-4                       |
| WebGL2 and CPU tier, 40 blocks                        | 0 of 81,920                                             | 0 of 81,920                                             | 0 of 81,920                                             | 0 of 81,920                                             |

Facts: every repeat count is 0 on every tier. The WebGL2 render equals the CPU tier's bit for bit over the 40
blocks. The 40-block comparison of WebGPU and the CPU tier is equal to record 08-3 to the digit (the first 40
blocks hold events that the two pull requests did not change). The whole-clip comparison moved with the render's
bits (the peak, and so the master's gain): 2,879,881 values differ, against 2,879,886.

### WebGL2 groups

1 of 50 groups ran on WebGL2, against 1 of 50 in record 08-3 and 1 of 33 in records 08 and 08-2. The same group
(`sendSum`) is the one. The sentences are the sentences of record 08-3 (see "Which calls the tiers ran").

## What departs from the method

Each item has its disposition: closed, made part of the design by an amendment, or open. The items are those of
record 08-3, read against this run.

1. **Stand-in dialogue stems.** Still no recorded speech. The stems differ by event since #52. Open: the ducking
   measure of 7.24 dB is the ducker acting on a stand-in. Next action: a recorded or licensed stem.
2. **Grains are synthesized bursts, and the scheduler is not used.** Open, as in record 08.
3. **No HRTF set.** Open, as in record 08. The run renders for speakers.
4. **The convolution's transform is kernel functions, not experiment 5's entry.** Closed, as in record 08.
5. **The master is host-side and runs after the render.** Closed, as the design of `src/master.ts`.
6. **The timed run is the whole clip only on the CPU tier and on WebGPU.** WebGL2 rendered 40 blocks, the variants
   are 2 s on the CPU tier and 0.5 s on WebGL2, and the determinism count is 150 blocks (20 on WebGL2). A full pass
   of the CPU tier took 27.8 minutes. Open. Next action: the device runs.
7. **No propagation delay.** Closed, as a design choice.
8. **`whoosh` and `riser` lengths.** Closed at #46. This run measures the closed state.
9. **The one-layer plan.** Closed as an interpretation, as in record 08.
10. **Levels of the kinds** (`KIND_GAIN`, `KIND_PEAK`). The levels of the other kinds were set from the peaks of
    the fixture's events, not by ear. Since #65 the level of a `footstep` and a `cloth` follows the event's
    intensity (`KIND_PEAK = 0.5`). Open: `wind` is not held to `KIND_PEAK` (pull request #65: 0.443 at gust 0.3,
    1.105 at gust 0.8). Next action: the owner decides whether `wind` follows its intensity too.
11. **The note's status sentence** ("Nothing in this note is built yet") is unchanged. Open. Next action: the owner.
12. **The `webgl2-cpu` entry of `across` in command 1's JSON.** Closed: the harness refuses the comparison and
    writes the reason (#43). Command 2 holds the valid comparison.
13. **The load of the container.** Closed for this run: the container was quiet (see "The load of the container"),
    and the block times carry no load of other agents. Not tested: a run under a controlled load.
14. **The second browser tier was not checked for another agent's browser.** The runner starts the browser of
    each tier by itself. This run checked before each command (see "The devices"). Open, with low weight. No tier of
    the run lost its page, and the logs show no error. Next action: none unless a record shows a lost page.
15. **The render of `7ecf6764` has a known defect** (the grains of `cloth-1` sum within 8 ms and make the clip's
    peak). Closed: #63 and #65 removed it, and this record is the first with the fix. Record 08-3 stays as the
    record of the render with the defect.

## Open items

| Item                                                                                         | State now                                                                                                                                                                                                 | Next action                                                                           |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| No tier keeps the 21.33 ms budget                                                            | Still open. WebGPU takes 21.05 ms at the median over the whole clip (651 of 1,407 blocks over; 4 of 40 over on the first 40 blocks). The CPU tier and WebGL2 run the convolution and the lanes on the CPU | A device run; the next steps of `docs/lanes.md`; change 0092 for the CPU tier         |
| `history` and `pack` store twice                                                             | Still open. The WebGL2 sentence names the fix                                                                                                                                                             | Fold the branches into one store                                                      |
| `gather` writes `raws` other than at `i`                                                     | Still open. Nine calls                                                                                                                                                                                    | Decide whether `gather` has a form that WebGL2 can draw                               |
| `master.crestDb` fails on the layered render (23.28 dB, bound 20 dB)                         | **Closed.** This run reads 19.160 dB on the CPU arm and on the WebGPU arm, under the bound of 20 dB. Pull requests #63 (grain overlap) and #65 (level by intensity) closed it. The margin is 0.84 dB      | None. Keep the rule in the next record                                                |
| `accumulate2`, `place`, `fftStage` and `layers` take 16 % to 39 % more GPU time than in 08-2 | **Closed.** On the quiet container the four groups are at or under their record 08-2 values (`place` equal). Inference: the load of record 08-3 caused the rise                                           | None                                                                                  |
| `place` stays at 2.76 ms in records 08, 08-2 and this record                                 | New, low weight. Not explained                                                                                                                                                                            | Read it again on a device run                                                         |
| 40-block CPU pass 10 % slower than the whole-clip pass in record 08-3                        | New, low weight. This run does not show it (the 40-block pass is 2.5 % faster)                                                                                                                            | None unless it returns                                                                |
| `sync.anchoredOnsets` fell from 7 to 6 on the layered render                                 | New. No rule. Inference: a footstep or cloth onset left the anchor's window. Not tested                                                                                                                   | Name the onset that left the window, or state that the measure has no rule on purpose |
| `dynamics.dipDb`: #44 (0.60 dB) and #48 (2.58 dB) name different values for the same state   | Still open, from record 08-2. This run did not run those states. This run reads 5.904 dB                                                                                                                  | None until someone repeats the two states                                             |
| Thresholds of `DEFAULT_RULES`                                                                | Still open. Starting values. The crest margin is 0.84 dB                                                                                                                                                  | Fit them on more plans                                                                |
| The device runs                                                                              | Still pending. The container's SwiftShader is not a GPU                                                                                                                                                   | The owner runs `docs/device-runs.md` at `3b0a4557f9b639cd2136737f0871c598526318a1`    |

## Checks of this pull request

- `bun run check`, 2026-11-10, `3b0a455` plus this pull request's documents and JSON files, Bun 1.4.4: exit 0 (0 errors, 1 warning: `moduleSuffixes is not supported yet`, as before).
- `bun run test`, the same configuration: 18 files, 174 tests passed.
- `bun run test:gpu`: not run. No kernel, unit, render or `explain` code changed; this pull request holds documents and the JSON of the harness.
- `bunx prettier --config /home/user/typeshade/.prettierrc.json --check` on the three `.md` files this pull request writes or touches (`docs/records/08-sound-design-container-4.md`, `docs/experiments.md`, `docs/device-runs.md`): see the pull request body.
- Document audit: the numbers of this record are read from the two JSON files by script; the numbers of records 08, 08-2 and 08-3 are read from their own JSON files and are unchanged (`git diff --stat` shows no change to them). `AGENTS.md` lists no records of experiment 8 by name, so it is unchanged.
