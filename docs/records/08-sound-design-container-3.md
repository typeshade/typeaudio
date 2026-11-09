# Record 08, third run: a layered, spatial render of a hand-written plan, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures on the commit that the device runs will use. They do
> not stand for a GPU's time per block, and they decide nothing about the owner's devices. The
> device runs of experiment 8 are pending (`docs/experiments.md`, section 8).

This is the third container run of experiment 8. The first is `docs/records/08-sound-design-container.md`
(record 08). The second is `docs/records/08-sound-design-container-2.md` (record 08-2, pull request #58,
commit `eef3eba5`, in review when this run started and merged as `54a8084` while this run wrote its record). The owner decided on 2026-11-09 to run the container again after the kinds'
variation, the duration contract, the `dipDb` measure, the review fixes and the pre-impact ducking guard
landed, and to make that commit the reference commit of the device runs. Pull request #57 then changed the
kinds' kernels, so the owner asked for this run at `7ecf6764`, and this commit is the reference commit.
Record 08 and record 08-2 keep their numbers. The section "Against record 08" compares the three.

## The run

| Item                 | Value                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment           | 8, a layered, spatial render of a hand-written plan (`docs/experiments.md`, section 8)                                                                                                                                                                                                                                    |
| Command 1            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --out docs/records/08-sound-design-container-3.json` (run as `bun experiments/08-sound-design/run.ts --out docs/records/08-sound-design-container-3.json`, which is the same script) |
| Command 2            | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:08 --tier all --blocks 40 --repeat-blocks 2 --variant-seconds 0 --out docs/records/08-sound-design-container-3-tiers.json` (run as the same script with the same options)               |
| Options of command 1 | The defaults of `experiments/08-sound-design/run.ts`: blocks `cpu=0,webgpu=0,webgl2=40` (0 is the whole clip), repeat blocks `cpu=150,webgpu=150,webgl2=20`, variant seconds `cpu=2,webgpu=15,webgl2=0.5`                                                                                                                 |
| Date                 | Command 1: 2026-11-09, from 13:15:14 to 14:11:31 UTC (56 minutes; the CPU tier took 31.1 minutes for the 1,407 blocks). Command 2: from 14:12:04 to 14:15:14 UTC                                                                                                                                                          |
| Commit               | Command 1: `7ecf6764bc2f002b528d09f735aace92fcfe1181` of `typeshade/typeaudio` (`main`, pull request #57), clean tree (the JSON says `dirty` false). Command 2: `adaa1a5b06f2b78147ec09f3cc007ae94380eafc`, which is `7ecf6764` plus the JSON file of command 1, clean tree. The two differ in no source file             |
| Compiler pin         | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null), the same pin as records 08 and 08-2                                                                                                      |
| Tools                | Bun 1.4.4, Node v22.23.4, Chrome Headless Shell 153.0.8010.12 (the same binary as records 08 and 08-2)                                                                                                                                                                                                                    |
| Raw data             | `docs/records/08-sound-design-container-3.json` (command 1) and `docs/records/08-sound-design-container-3-tiers.json` (command 2): the options, each tier's block timings, fuse groups, device info, the repeat and variant timings, the comparison across tiers, and the checklists                                      |
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

The device table is the same as the tables of records 08 and 08-2.

The container is shared with other agent sessions, and the run did not reserve it. The runner recorded
the load average over 1, 5 and 15 minutes, on 4 cores, around each tier.

Command 1:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 3.41, 3.26, 3.16 | 4.17, 4.16, 4.08 |
| WebGPU   | 4.64, 4.25, 4.11 | 5.70, 4.95, 4.40 |
| WebGL2   | 5.70, 4.95, 4.40 | 2.67, 3.88, 4.12 |

Command 2:

| Tier     | Before           | After            |
| -------- | ---------------- | ---------------- |
| CPU tier | 2.68, 3.75, 4.07 | 2.90, 3.57, 3.97 |
| WebGPU   | 2.91, 3.56, 3.97 | 2.91, 3.56, 3.97 |
| WebGL2   | 2.91, 3.56, 3.97 | 2.00, 3.17, 3.80 |

Fact: the load was higher than in records 08 (1.3 to 2.0) and 08-2 (1.6 to 3.3), on 4 cores. The load
averages are the container's, not the run's alone. The WebGPU "after" and "before" rows of command 2 are the
same numbers, as the runner wrote them.

Waiting for the browser (the rule of the run: one whole-clip browser render at a time in the container): `pgrep -fa chrome-headless-shell` showed
no browser before command 1 started (13:15 UTC), and none before command 2 started (14:12 UTC), so this run
did not wait. The runner starts each tier's browser by itself, and this run could not check the second browser
tier between the CPU tier and the WebGPU tier. The log of command 1 shows no closed page. Not checked: whether
another agent's browser ran during the WebGPU tier of command 1.

## The method

The method is the method of record 08 (section "The method") and of record 08-2 (changes of the code up to
`eef3eba5`), with this change of the code since:

- Pull request #57 (`7ecf676`): the render calls one bank and one kernel for each kind present in the plan
  (`whooshes`, `impacts`, `shimmers`, `risers`, `winds`, `drones`, `footsteps`, `cloths`, `voices`) and not
  `cues`. Nine `gather` calls follow them and put the kinds' outputs in the lane order. A block is one `dev.fuse`
  scope of 50 calls (33 in records 08 and 08-2). The lane's loop invariants are hoisted out of the frame loop
  (`docs/lanes.md`, "Step 2"). The pull request held the CPU render bit for bit.

Layered render of the fixture: -29.31 LUFS before the master, +6.31 dB of gain, no gain from the limiter (its
deepest gain is 0 dB; the true peak of the scaled mix is -1.16 dBTP, 0.16 dB under the bound of -1). These are
the numbers of record 08-2, to the digit.

## The numbers

### Time per block

Host time of a block: its `fuse` scope and the read of its output, in milliseconds. The first block builds the
pipelines and is apart. The budget of a block of 1,024 frames at 48 kHz is 21.33 ms. Real time is the seconds of
audio rendered per second of host time over the blocks.

Command 1:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |  1,407 |     1299.35 |  1499.79 |  1030.41 |  1702.83 |    1699.44 |         1,406 |    0.016x |               13.6 |
| WebGPU   | webgpu |  1,407 |       25.51 |    33.91 |    17.55 |    79.24 |     949.18 |         1,328 |    0.791x |                0.2 |
| WebGL2   | webgl2 |     40 |     1023.84 |  1282.19 |   872.46 |  1284.57 |    1252.19 |            39 |    0.020x |                9.0 |

Command 2, the same 40 blocks on every tier:

| Tier     | Ran on | Blocks | Median (ms) | p95 (ms) | Min (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) |
| -------- | ------ | -----: | ----------: | -------: | -------: | -------: | ---------: | ------------: | --------: | -----------------: |
| CPU tier | cpu    |     40 |     1437.19 |  1566.99 |  1371.46 |  1578.47 |    1561.86 |            39 |    0.015x |               12.4 |
| WebGPU   | webgpu |     40 |       27.58 |    33.34 |    21.90 |    38.60 |     938.16 |            39 |    0.422x |                0.2 |
| WebGL2   | webgl2 |     40 |     1004.04 |  1156.61 |   908.68 |  1257.76 |    1088.72 |            39 |    0.021x |                9.2 |

No tier keeps the budget. Facts: WebGPU on SwiftShader takes 25.51 ms at the median, 1.2 times the budget, and
1,328 of its 1,407 blocks are over the budget (record 08-2: 1,406). The CPU tier takes 1,299.35 ms and WebGL2
takes 1,023.84 ms. Real time on WebGPU is 0.791x (0.364x in record 08-2).

### Where the time goes on WebGPU

Mean GPU time of each group over the 40 blocks of command 2, from `gpuTime` of the fuse report. The sum is
20.67 ms (47.46 ms in record 08-2). The kinds' kernels replace `cues`.

| Group                                                                        | GPU time (ms) |  Share |
| ---------------------------------------------------------------------------- | ------------: | -----: |
| `accumulate2`                                                                |          4.75 | 23.0 % |
| `place`                                                                      |          3.20 | 15.5 % |
| the nine kinds' kernels (`whooshes+impacts` fused, then eight single groups) |          2.94 | 14.2 % |
| `fftStage` (22 stages, `store` fused into the eleventh)                      |          2.83 | 13.7 % |
| `history`                                                                    |          2.52 | 12.2 % |
| the nine `gather` groups                                                     |          1.77 |  8.5 % |
| `layers`                                                                     |          1.20 |  5.8 % |
| `strips`                                                                     |          0.92 |  4.4 % |
| `pack`, `overlap2`, `pad`, `sendSum`                                         |          0.53 |  2.6 % |

The report of the last block: `tier` `webgpu`, 48 dispatches, 1 submission, 48 groups from 50 calls. Two
pairs fuse: `whooshes` with `impacts` (the trip counts of both are 4) and `fftStage` with `store`. Each other
group stands apart for the reason that the fuse report gives, word for word: "impacts and shimmers run as two
dispatches because the trip counts differ (4 and 3)", and the same sentence for the next kinds (3 and 1, 1 and
2, 2 and 3, 3 and 4, 4 and 1, 1 and 3), then "voices and gather run as two dispatches because the trip counts
differ (3 and 25)". The first `gather` stands apart for that reason. The other eight `gather` calls stand apart
for the sentence "gather and gather run as two dispatches because gather writes an array gather also writes".
`history` follows with "gather and history run as two dispatches because the trip counts differ (25 and
128000)".

Fact: the fuse report (what `explain` prints) gave one kernel group for each of the nine kinds present in the plan (eight dispatches, as
`whooshes+impacts` fuse) and nine `gather` groups, as expected. Inference: the nine `gather`
groups cost 1.77 ms and the kinds cost 2.94 ms, so the split by kind costs 4.71 ms against the 33.52 ms of
`cues` in record 08-2. The fixed groups (`accumulate2`, `place`, `fftStage`, `history`) are now 64 % of the
GPU time.

### Which calls the tiers ran

Command 2, the last block's report. On the CPU tier, all 50 groups ran on the CPU. On WebGPU, all 48 groups ran
on WebGPU. On WebGL2, **1 of 50 groups** ran on WebGL2 (`sendSum`: "WebGL2 runs the calls apart") and 49 ran on
the CPU tier. Record 08 and record 08-2 counted 1 of 33. The sentences are the sentences of record 08 for the
old calls, word for word, and one new sentence for the `gather` calls:

| Calls                                                                       | `why` of the report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the nine kinds' kernels, `place`, `layers`, `strips`, `overlap2` (13 calls) | `<name> runs on the CPU, it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| nine `gather`                                                               | `gather runs on the CPU, it runs on the CPU, loop 1 writes "raws" other than at i`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 22 `fftStage`, `accumulate2`                                                | `<name> runs on the CPU, it runs on the CPU, loop 1 writes "out", whose element is not one f32, i32 or u32` (for `accumulate2`, `"sum"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pad`                                                                       | `pad runs on the CPU, it runs on the CPU, loop 1 writes "padded", whose element is not one f32, i32 or u32`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `store`                                                                     | `store runs on the CPU, it runs on the CPU, loop 1 writes "line" other than at i`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `history`                                                                   | `history runs on the CPU, it runs on the CPU, its GLSL did not emit: typeshade [SD0111]: portable kernel outside the gather-only tier — 'history_gl0' writes to '_out' 2 times — the portable tier stores exactly once, _out[_gid.x] = f(reads), so fold the branches into a single value and store it once` and a second line, "hint: the portable tier is out[gid.x] = f(reads): a 1-D gid and workgroup, one u32 storage output written once at the invocation index, a vec4<u32> dispatch uniform, no raw statements — restructure or drop portable to keep the kernel WebGPU-only" |
| `pack`                                                                      | the same two lines for `'pack_gl0'`, 3 times                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The first row holds 13 calls: the nine kinds' kernels, `place`, `layers`, `strips` and `overlap2`. Fact: the count
is 1 of 50 and not 1 of 33, because `cues` became nine kind calls and nine `gather` calls (33 - 1 + 18 = 50). The
only new sentence is the one of `gather`. Inference: the nine kinds' kernels met the refusal that `cues` met
(a loop that writes more than one array), and `gather` meets the `store` form (a write other than at the loop
counter). No new kind of refusal appeared.

These are the limits of ask AA of `docs/compiler-asks.md` (a loop that writes a `vec2`, writes off its counter
or writes two arrays, on WebGL2), met by the kernels of this experiment, and the new form of record 08:
`history` and `pack` store in two branches.

The backticks that the original sentence of `history` puts around `_out[_gid.x] = f(reads)` and `portable` are left
out of the table cell, so that the cell is one code span. The words are the same.

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
  `sync.medianAbsErrorMs`, `variation.maxSimilarity` (0.938 and 0.939 against 0.95 or less), `master.truePeakDbtp`
  and `master.clippedSamples`.
- The layered render fails and the one-layer render meets: `master.crestDb` (23.28 dB against 6 to 20 dB; the
  one-layer render is 18.72 dB).
- The layered render meets `dynamics.dipDb` (5.904 dB against 3 or more dB). The one-layer render has no stem of
  another layer, so the measure is `n/a`.
- Not measurable on the one-layer render: `dynamics.dipDb`, `dynamics.duckingDb` (no dialogue stem) and
  `balance.layerOverlap` (one layer sounds).
- `space.reverbRatioDb` of the one-layer render, -236 dB, is a dry render: the wet energy is zero and the analyzer
  floors it at 1e-20.
- `master.truePeakDbtp` of the layered render, -1.161 dBTP, is 0.161 dB under its bound of -1. `sync.medianAbsErrorMs`,
  30.67 ms, is 11.3 ms under its bound of 42.
- The WebGPU arm scores the checklist too (since pull request #50). Its verdict of every rule is the CPU arm's.
  Its values differ in the third decimal or less: `dipDb` 5.905 dB (CPU tier 5.904), `variation.maxSimilarity`
  0.9386 (0.9386), `dynamics.duckingDb` 7.2385 (7.2389), `master.crestDb` 23.281 (23.281). The WebGL2 tier writes no
  checklist (it rendered 40 blocks, and a short render has a different master gain).
- Every value of the checklist of the CPU tier and of the WebGPU tier is equal, to the last digit of the JSON,
  to the value in `docs/records/08-sound-design-container-2.json`. The `mix` field of the CPU tier is equal too.

Inference: the render's bits did not change from `eef3eba5` to `7ecf6764` on the CPU tier and on WebGPU, which
agrees with pull request #57, which held the CPU render bit for bit.

### Two variants of the A/B step

Two plans that differ in one correction (`{"kind": "whoosh", "set": {"macros": {"brightness": 0.4},
"intensity": 0.85}}`, applied to every `whoosh` and nothing else), each rendered from the start of the clip. Cold
is on a new device, so the first render builds the pipelines and the transform of the partitions; warm is the
same pair again.

| Tier     | Seconds each | Blocks each | Cold: A, B, pair (s)   | Warm: A, B, pair (s)   |
| -------- | -----------: | ----------: | ---------------------- | ---------------------- |
| CPU tier |            2 |          94 | 146.65, 146.26, 292.92 | 146.19, 149.25, 295.43 |
| WebGPU   |           15 |         704 | 20.89, 19.08, 39.97    | 19.46, 20.36, 39.82    |
| WebGL2   |          0.5 |          24 | 35.09, 33.71, 68.80    | 34.58, 33.52, 68.10    |

The pair does not render in under a second on any tier. The WebGPU pair takes 39.97 s cold and 39.82 s warm for
15 s each. A render includes the master and the transform of the partitions (0.2 s on WebGPU, 13.6 s on the CPU
tier, 9.0 s on WebGL2).

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

Command 1, the whole clip (2,880,000 values): WebGPU and the CPU tier differ in 2,879,886, by at most 8.44e-4 of a
peak of 0.854, relative RMS 1.18e-3. The WebGL2 render is the CPU tier's bit for bit because 49 of its 50 groups
ran on the CPU tier. The WebGPU difference is the one the determinism report leaves a driver (`sin`, `cos`,
`exp` and `tanh`, compiler surface section 38), carried through the filters and the reverb and then scaled by the
master's gain.

## Against record 08

Record 08 ran at `0f7572a2` (command 1) and `45b9e4b6` (command 2). Record 08-2 (pull request #58, merged as `54a8084`) ran at `eef3eba5` (command 1) and `47606dce` (command 2). This record ran at `7ecf6764`. The pull
requests between record 08's commit in `main` (`aa30ef6c`, pull request #38) and this commit, from
`git log --oneline aa30ef6c..origin/main` (read at `7ecf6764`):

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
| #57          | `7ecf676`        | One bank and one kernel for each kind, with the lane hoisted out of the frame loop (the change between record 08-2 and this record)                                                                        |

Pull requests #42, #47, #51, #53, #54, #55 and #56 are documents or notes (#53 says where the device files go,
#54 is a candidate compiler issue, #55 and #56 are asks AC and AB). They change no number.

### Time per block

Median of the block time, in milliseconds. The three columns of each command are the three records. The change is
this record against record 08-2.

| Tier, command | Record 08 | Record 08-2 | This record | Change against 08-2 | Change against 08 |
| ------------- | --------: | ----------: | ----------: | ------------------: | ----------------: |
| CPU tier, 1   |   1199.30 |     1274.67 |     1299.35 |              +1.9 % |            +8.3 % |
| WebGPU, 1     |     51.89 |       56.51 |       25.51 |             -54.9 % |           -50.8 % |
| WebGL2, 1     |    946.67 |     1040.28 |     1023.84 |              -1.6 % |            +8.2 % |
| CPU tier, 2   |   1315.92 |     1338.10 |     1437.19 |              +7.4 % |            +9.2 % |
| WebGPU, 2     |     52.28 |       53.05 |       27.58 |             -48.0 % |           -47.2 % |
| WebGL2, 2     |    925.48 |      959.27 |     1004.04 |              +4.7 % |            +8.5 % |

Facts:

- WebGPU: the median fell by 55 % (command 1) and 48 % (command 2) against record 08-2. The p95 fell from 72.36
  to 33.91 ms (command 1). The blocks over the budget fell from 1,406 to 1,328 of 1,407. The sum of the mean GPU
  times of the groups fell from 47.46 ms to 20.67 ms (command 2). `docs/lanes.md`, "Step 2", reports a fall of the
  block median from about 54 to 24 ms on SwiftShader at 40 blocks.
- The cause of the WebGPU fall is pull request #57: `cues` took 33.52 ms of GPU time in record 08-2, and the
  kinds and the `gather` calls take 4.71 ms now. Fact: the other groups did not get faster. See the next list.
- CPU tier and WebGL2: the medians moved by +1.9 % to +7.4 %, and by -1.6 % to +4.7 %. These tiers run the same
  kernels on the CPU. The load average of this run (2.7 to 5.7) was higher than that of record 08-2 (1.0 to
  3.3), and the p95 of the CPU tier moved with the median. Inference: the load explains the slower CPU tier. It
  was not tested by a run on a quiet container.
- The variants: the cold pair takes 292.92 s against 272.76 s (CPU tier, +7.4 %), 39.97 s against 85.59 s (WebGPU,
  -53 %) and 68.80 s against 71.42 s (WebGL2, -3.7 %). The reverb prepare takes 13.6 s against 13.5 s (CPU tier),
  0.2 s against 0.2 s (WebGPU) and 9.0 s against 9.5 s (WebGL2).
- The first block of WebGPU takes 949.18 ms against 755.30 ms (command 1). Inference: the 50 calls build more
  pipelines (48 dispatches against 32). Not tested.

Fixed groups on WebGPU (the mean GPU time over the 40 blocks of command 2, in milliseconds):

| Group                         | Record 08 | Record 08-2 | This record |
| ----------------------------- | --------: | ----------: | ----------: |
| `accumulate2`                 |      3.43 |        3.42 |        4.75 |
| `place`                       |      2.76 |        2.76 |        3.20 |
| `fftStage` (22 stages)        |      2.26 |        2.32 |        2.83 |
| `history`                     |      2.24 |        3.09 |        2.52 |
| `layers`                      |      0.95 |        0.91 |        1.20 |
| `strips`                      |      0.82 |        0.85 |        0.92 |
| `cues`, or kinds and `gather` |     33.09 |       33.52 |        4.71 |

Open: `accumulate2` (+39 %), `place` (+16 %), `fftStage` (+22 %) and `layers` (+32 %) take more GPU time than in
record 08-2, and no pull request changed them. Pull request #57 changed `cues` and added `gather`. Candidates, not
tested: the higher load of this run (SwiftShader runs on the same CPU as the load), and the new `gather` calls
that write the lanes in another order. `history` fell from 3.09 ms to 2.52 ms, and no pull request changed
`history`; record 08-2 listed its rise from 2.24 ms as open. This run does not decide it.

### The checklist

The CPU tier and the WebGPU tier of this run give the numbers of record 08-2, to the last digit of the JSON. The
table gives the layered values, and the one-layer values that moved.

| Measure                   | Record 08: one layer / layered | Record 08-2: one layer / layered | This record: one layer / layered | Verdicts of this record against record 08 |
| ------------------------- | ------------------------------ | -------------------------------- | -------------------------------- | ----------------------------------------- |
| `layers.heroEvents`       | 4.000 / 5.000                  | 4.000 / 5.000                    | 4.000 / 5.000                    |                                           |
| `layers.eventsPerHero`    | 1.000 / 6.000                  | 1.000 / 6.000                    | 1.000 / 6.000                    | same: fails / met                         |
| `layers.layersPerHero`    | 1.000 / 3.000                  | 1.000 / 3.000                    | 1.000 / 3.000                    |                                           |
| `dynamics.contrastLu`     | 9.796 / 7.027                  | 10.351 / 7.780                   | 10.351 / 7.780                   | same: met / met                           |
| `dynamics.dipDb`          | 16.794 / -2.202                | n/a / 5.904                      | n/a / 5.904                      | met / fails to n/a / met                  |
| `dynamics.duckingDb`      | n/a / 10.417                   | n/a / 7.239                      | n/a / 7.239                      | same: n/a / met                           |
| `balance.tiltDbPerOctave` | -5.072 / -4.666                | -5.036 / -4.723                  | -5.036 / -4.723                  | same: met / met                           |
| `balance.mudShare`        | 0.006 / 0.049                  | 0.006 / 0.071                    | 0.006 / 0.071                    | same: met / met                           |
| `balance.airShare`        | 0.006 / 0.004                  | 0.006 / 0.004                    | 0.006 / 0.004                    | same: met / met                           |
| `balance.layerOverlap`    | n/a / 0.271                    | n/a / 0.238                      | n/a / 0.238                      | same: n/a / met                           |
| `space.correlation`       | 1.000 / 0.670                  | 1.000 / 0.640                    | 1.000 / 0.640                    | same: fails / met                         |
| `space.reverbRatioDb`     | -236.164 / -2.354              | -235.982 / -2.754                | -235.982 / -2.754                | same: fails / met                         |
| `position.events`         | 17.000 / 25.000                | 17.000 / 25.000                  | 17.000 / 25.000                  |                                           |
| `position.panCorrelation` | 0.000 / 0.824                  | 0.000 / 0.832                    | 0.000 / 0.832                    | same: fails / met                         |
| `sync.pictureTimes`       | 8.000 / 8.000                  | 8.000 / 8.000                    | 8.000 / 8.000                    |                                           |
| `sync.anchoredOnsets`     | 9.000 / 5.000                  | 9.000 / 7.000                    | 9.000 / 7.000                    |                                           |
| `sync.medianAbsErrorMs`   | 0.104 / 30.667                 | 0.021 / 30.667                   | 0.021 / 30.667                   | same: met / met                           |
| `variation.maxSimilarity` | 0.972 / 0.963                  | 0.938 / 0.939                    | 0.938 / 0.939                    | fails / fails to met / met                |
| `master.lufs`             | -25.645 / -23.000              | -25.663 / -23.000                | -25.663 / -23.000                | same: fails / met                         |
| `master.truePeakDbtp`     | -9.986 / -5.509                | -9.773 / -1.161                  | -9.773 / -1.161                  | same: met / met                           |
| `master.crestDb`          | 18.444 / 19.186                | 18.721 / 23.281                  | 18.721 / 23.281                  | met / met to met / fails                  |
| `master.clippedSamples`   | 0.000 / 0.000                  | 0.000 / 0.000                    | 0.000 / 0.000                    | same: met / met                           |

What moved against record 08, and why. The reasons are the reasons of record 08-2, since no value moved between
record 08-2 and this record:

1. `dynamics.dipDb` of the layered render: -2.202 dB (fails) to 5.904 dB (met). Fact: pull request #44 changed the
   measure, #48 added the guard, and #46 and #49 changed the sounds before the impact. The one-layer render is
   `n/a` (it has no stem of another layer), where record 08 had 16.794 dB. Open, from record 08-2: the pull
   requests #44 (0.60 dB) and #48 (2.58 dB) name different values for the same state. This run did not run those
   states.
2. `variation.maxSimilarity`: 0.972 and 0.963 (both fail) to 0.938 and 0.939 (both met). Fact: #49 widened the
   draws, and #52 made the stand-in voice stems differ by event. Record 08-2 gives the intermediate values.
3. `dynamics.duckingDb`: 10.417 dB to 7.239 dB. Inference, from record 08-2: #52 changed what the dialogue ducker
   acts on. Not tested.
4. `sync.anchoredOnsets`: 5 to 7 of the layered render. Inference, from record 08-2: #46 changes where a `whoosh`
   and a `riser` have their onset against the anchor. Not tested.
5. `master.crestDb` of the layered render: 19.186 dB (met) to 23.281 dB (fails; the bound is 20 dB).
   `master.truePeakDbtp`: -5.509 dBTP to -1.161 dBTP. The CPU peak of the whole clip is 0.854 against 0.530 in
   record 08, at the same loudness target. Fact, from record 08-2 item 5 (the measurement of pull request #61, made
   at `eef3eba5` and not repeated here): the peak is the `foley` stem alone, at 3.2285 s, the event `cloth-1`. The
   id-based event key of #43 gives it four grains that start within 8 ms of each other, and they sum. This run
   renders the same bits as `eef3eba5` (see above), so the fact holds for this commit. Open: the clump is a draw of
   grain starts, and the record names no change of the kinds that spreads them.
   The level of a footstep and a cloth follows its intensity since f7ce2e1 (pull request #65); the numbers above are
   before it.
6. Small moves with no single cause named: `dynamics.contrastLu`, `balance.mudShare`, `balance.layerOverlap`,
   `space.correlation`, `space.reverbRatioDb`, `position.panCorrelation` and `balance.tiltDbPerOctave`. No verdict
   of these measures changed. Listed as open, as in record 08-2.

Fact against record 08-2: pull request #57 moved no value of the checklist (equal to the last digit), no value of
the master (-29.307 LUFS before, +6.307 dB), and no value of the comparison across tiers. This is what the pull
request said it would do.

Verdicts of the layered render: record 08 failed `dynamics.dipDb` and `variation.maxSimilarity`. This record fails
`master.crestDb` only. Verdicts of the one-layer render: record 08 failed `eventsPerHero`, `correlation`,
`reverbRatioDb`, `panCorrelation`, `lufs` and `variation.maxSimilarity`. This record fails the first five.

### Determinism

| Count                                                 | Record 08                                               | Record 08-2                                             | This record                                             |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Values that differ, the repeat, CPU tier (150 blocks) | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGPU (150 blocks)   | 0 of 307,200                                            | 0 of 307,200                                            | 0 of 307,200                                            |
| Values that differ, the repeat, WebGL2 (20 blocks)    | 0 of 40,960                                             | 0 of 40,960                                             | 0 of 40,960                                             |
| WebGPU and CPU tier, the whole clip                   | 2,879,893 of 2,880,000; largest 1.55e-3 of a peak 0.530 | 2,879,886 of 2,880,000; largest 8.44e-4 of a peak 0.854 | 2,879,886 of 2,880,000; largest 8.44e-4 of a peak 0.854 |
| WebGPU and CPU tier, 40 blocks                        | 81,918 of 81,920; largest 6.40e-4                       | 81,917 of 81,920; largest 5.23e-4                       | 81,917 of 81,920; largest 5.23e-4                       |
| WebGL2 and CPU tier, 40 blocks                        | 0 of 81,920                                             | 0 of 81,920                                             | 0 of 81,920                                             |

The determinism counts are the same as in record 08-2, to the digit. The reason is that the render's bits did
not change (see "The checklist").

### WebGL2 groups

1 of 50 groups ran on WebGL2, against 1 of 33 in records 08 and 08-2. The same group (`sendSum`) is the one. The
sentences are the sentences of record 08, and one new sentence for `gather` (see "Which calls the tiers ran").

## What departs from the method

Each item has its disposition: closed, made part of the design by an amendment, or open. The items are those of
record 08-2, read against this run.

1. **Stand-in dialogue stems.** Still no recorded speech. The stems differ by event since #52. Open: the ducking
   measure of 7.24 dB is the ducker acting on a stand-in. Next action: a recorded or licensed stem.
2. **Grains are synthesized bursts, and the scheduler is not used.** Open, as in record 08.
3. **No HRTF set.** Open, as in record 08. The run renders for speakers.
4. **The convolution's transform is kernel functions, not experiment 5's entry.** Closed, as in record 08.
5. **The master is host-side and runs after the render.** Closed, as the design of `src/master.ts`.
6. **The timed run is the whole clip only on the CPU tier and on WebGPU.** WebGL2 rendered 40 blocks, the variants
   are 2 s on the CPU tier and 0.5 s on WebGL2, and the determinism count is 150 blocks (20 on WebGL2). A full pass
   of the CPU tier took 31.1 minutes. Open. Next action: the device runs.
7. **No propagation delay.** Closed, as a design choice.
8. **`whoosh` and `riser` lengths.** Closed at #46. This run measures the closed state.
9. **The one-layer plan.** Closed as an interpretation, as in record 08.
10. **Levels of the kinds** (`KIND_GAIN`) were set from the peaks of the fixture's events, not by ear. Open. The
    higher peak of the layered render (see "Against record 08", item 5) may bear on it.
    The level of a footstep and a cloth is scaled to its intensity since f7ce2e1 (pull request #65); the numbers above
    are before it.
11. **The note's status sentence** ("Nothing in this note is built yet") is unchanged. Open. Next action: the owner.
12. **The `webgl2-cpu` entry of `across` in command 1's JSON.** Closed: the harness refuses the comparison and
    writes the reason (#43). Command 2 holds the valid comparison.
13. **The load of the container.** Other sessions loaded the container during both commands (load average 2.7 to
    5.7, on 4 cores). The block times carry it, most on the CPU tier and WebGL2. Open. Next action: the device
    runs.
14. **The second browser tier was not checked for another agent's browser.** The runner starts the browser of
    each tier by itself. This run checked before command 1 and before command 2 only (see "The devices"). Open.
    No tier of the run lost its page, and the logs show no error. Next action: none unless a record shows a lost
    page.
15. **Record 08-2 was in review when this run started.** Pull request #58 merged as `54a8084` while this record
    was written. "Against record 08" reads the merged files (the blob of the record is the blob of its branch).
    Closed.

## Open items

| Item                                                                                         | Reason                                                                                                                                                 | Next action                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| No tier keeps the 21.33 ms budget                                                            | WebGPU takes 25.51 ms at the median (1,328 of 1,407 blocks are over); the CPU tier and WebGL2 run the convolution and the lanes on the CPU             | A device run; the next steps of `docs/lanes.md`; change 0092 for the CPU tier                |
| `history` and `pack` store twice                                                             | The WebGL2 sentence above names the fix                                                                                                                | Fold the branches into one store                                                             |
| `gather` writes `raws` other than at `i`                                                     | The WebGL2 sentence above; nine calls                                                                                                                  | Decide whether `gather` has a form that WebGL2 can draw                                      |
| `master.crestDb` fails on the layered render (23.28 dB, bound 20 dB)                         | The peak of the clip rose from 0.530 to 0.854 at the same loudness. The cause is the grain starts of `cloth-1` (record 08-2, item 5, pull request #61) | Spread the grain starts of a footstep and a cloth (a change of the kinds, the owner decides) |
| `accumulate2`, `place`, `fftStage` and `layers` take 16 % to 39 % more GPU time than in 08-2 | No pull request changed them. The load of this run was higher                                                                                          | Run command 2 again on a quiet container                                                     |
| Thresholds of `DEFAULT_RULES`                                                                | Starting values                                                                                                                                        | Fit them on more plans                                                                       |
| The device runs                                                                              | The container's SwiftShader is not a GPU                                                                                                               | The owner runs `docs/device-runs.md` at `7ecf6764bc2f002b528d09f735aace92fcfe1181`           |

## Checks of this pull request

- `bun run check`, 2026-11-09, `7ecf6764` plus this pull request's documents and the merge of `54a8084`, Bun 1.4.4: exit 0.
- `bun run test`, the same configuration: 18 files, 168 tests passed.
- `bun run test:gpu`: not run. No kernel, unit, render or `explain` code changed; this pull request holds documents and the JSON of the harness.
- `bunx prettier --config /home/user/typeshade/.prettierrc.json --check` on the three `.md` files this pull request writes or touches: see the pull request body.
