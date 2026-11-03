# Record 06: a granular scheduler on `push` and device-resident counts, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures, how the engine plans a block of grains and which
> tier runs what. They do not stand for a GPU, and they decide nothing about the owner's devices.
> The device runs of experiment 6 are pending (`docs/experiments.md`, section 6).

## The run

| Item         | Value                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 6, a granular scheduler on `push` and device-resident counts (`docs/experiments.md`, section 6)                                                                                                                                       |
| Command      | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:06 --tier all --blocks 1000 --warmup 10 --out docs/records/06-granular-container.json`              |
| Date         | 2026-11-02, from 16:47:50 to 16:59:10 UTC                                                                                                                                                                                             |
| Commit       | `9e9b7310954b40f886d69b1fc3bdc8de64185dfb` of `typeshade/typeaudio`, branch `claude/exp-06-granular` (pull request #11), with a clean tree at the start; `AGENTS.md` was edited while the run ran, and no bundle reads it             |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                       |
| Tools        | Bun 1.4.4, Node v22.23.4, Vite 7.3.7, playwright-core 1.64.1                                                                                                                                                                          |
| Raw data     | `docs/records/06-granular-container.json`: every arm's statistics, each device's `DeviceInfo`, the last fuse report and `explain()` of each arm, the log of the counts of every block, the comparisons and the digests of the renders |

The renders themselves, 1,034,240 samples a tier, are not committed: the runner keeps them in
`experiments/06-granular/out/`, and the JSON holds the SHA-256 of each.

## The devices

| Item                              | CPU tier                                                                                       | WebGPU                                                                                                                               | WebGL2                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Host                              | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same                                                                                                                             | the same                                            |
| Runtime                           | Node v22.23.4                                                                                  | Chrome Headless Shell 153.0.8010.12                                                                                                  | the same                                            |
| Graphics                          | none                                                                                           | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `timestamp-query` | ANGLE on Vulkan 1.3.0, SwiftShader Device (Subzero) |
| Clock step of `performance.now()` | 0.00006 ms                                                                                     | 0.005 ms (the page is cross-origin isolated)                                                                                         | 0.005 ms                                            |

The container is shared with other agent sessions, and the run did not reserve it. At 16:42 and at
16:47 UTC, `ps` showed another session's CPU-tier render on one core and other sessions' test runs
on the others. The runner recorded the load average over 1, 5 and 15 minutes, on 4 cores, around
each tier:

| Tier     | Before            | After              |
| -------- | ----------------- | ------------------ |
| CPU tier | 3.42, 7.67, 6.80  | 5.97, 6.72, 6.64   |
| WebGPU   | 6.05, 6.72, 6.64  | 14.28, 8.93, 7.41  |
| WebGL2   | 14.28, 8.93, 7.41 | 12.79, 12.33, 9.31 |

Inference: the numbers hold that load, the 99th percentiles and the maxima more than the medians.

## The method

- The engine's grain unit and kernels, written for this experiment: `src/units/grain.shade.ts`
  (`Grain`, a sine burst under a Hann window whose sample at a frame is computed from its age;
  `Cloud`, the density and the ranges each grain is drawn from) and `src/kernels/grains.shade.ts`
  (`cull`, `spawn`, `play`). `test/grains.test.ts` holds them on the CPU tier to plain JavaScript,
  bit for bit.
- The cloud: 10,000 grains a second, each 20 to 100 ms long (960 to 4,800 frames), at 220 to
  1,760 Hz, its peak drawn from 0.01 to 0.02, seed 1, at 48 kHz. Every draw is `hash32` and
  `uniform` of `typeshade/random` over the seed and the frame.
- One block of 1,024 frames is one `dev.fuse` plan of six calls, in this order:
  1. `cull`: the grains of the other list that still sound at the block's first frame go to the
     head of this block's list, and their count to its count (a push, and a store after the
     loop). Its loop runs over the list's capacity, 2,048 (deviation 1; ask W of
     `docs/compiler-asks.md`).
  2. `tally`: the count is stored in the log (the harness's kernel).
  3. `spawn`: the block's new grains are appended after the count, `{ array, length }`, a push
     after a held length (change 0094). The call leaves the new count in the `Resident`.
  4. `tally`: the new count is stored in the log.
  5. `play`: the list is rendered into the block, `min(count[0], grains.length)` grains summed in
     the list's order for each frame, into a scratch array.
  6. `keep`: the block is copied into the tape (the harness's kernel). Its index is written
     `n * 1 + at`, because the loop proof refuses `at + n` (ask X of `docs/compiler-asks.md`).
- The two lists (`Resident<Grain[]>` of 2,048 grains) and their counts (`Resident<Uint32Array>`)
  are swapped each block. The log (2 words a block) and the tape (1,024 samples a block) stay on
  the device. Each arm reads the tape, the log and the last list once, after its last block.
- For each tier the harness runs four arms, each on a new device and from the same seed:
  - `fenced`: each block is timed from the `fuse` call to `dev.wait()` after it, the fence.
  - `again`: `fenced` again: the second render of the same seed.
  - `stream`: the blocks are submitted one after another with no fence and no read. The median
    is the time of each `fuse` call alone; "Stream" is the time from the first timed call to one
    fence after the last, over 1,000. On WebGPU the device is one the page requests without
    `timestamp-query` and passes as `createDevice({ device })`.
  - `stamped`: `stream` on the default WebGPU device, which has `timestamp-query`. WebGPU only.
- The timing is experiment 1's: 10 blocks of warm-up, the first timed apart as "first block",
  then 1,000 timed blocks; the median and the 99th percentile by nearest rank.
- The page counts the reads of the device while the timed blocks run: each `mapAsync` of a
  WebGPU buffer and each `readPixels` and `getBufferSubData` of a WebGL2 context, whoever makes
  them. `dev.statistics.readBytes` counts the host's own `read()` calls.
- On WebGL2 the arms run with `prefer: ['webgl2', 'cpu']`, as experiment 1 does. The harness also
  calls each kernel, and the block's plan, on a device of WebGL2 alone, `prefer: ['webgl2']`, and
  keeps each error's message.

## The numbers

### Time per block

A block of 1,024 frames lasts 21.33 ms at 48 kHz.

| Tier     | Arm     | Ran on | Median (ms) | p99 (ms) | Min (ms) | Max (ms) | First block (ms) | Stream (ms per block) | GPU median (ms) | GPU p99 (ms) | Device reads |
| -------- | ------- | ------ | ----------: | -------: | -------: | -------: | ---------------: | --------------------: | --------------: | -----------: | -----------: |
| CPU tier | fenced  | cpu    |      99.902 |  188.965 |   75.935 |  266.079 |          183.747 |                       |                 |              |              |
| CPU tier | again   | cpu    |     111.228 |  185.232 |   91.470 |  277.413 |           84.786 |                       |                 |              |              |
| CPU tier | stream  | cpu    |     105.887 |  183.719 |   89.993 |  284.615 |           87.774 |               110.663 |                 |              |              |
| WebGPU   | fenced  | webgpu |      13.550 |   32.360 |    9.095 |  121.950 |          433.305 |                       |           9.373 |       27.405 |        1,000 |
| WebGPU   | again   | webgpu |      15.285 |   91.260 |    8.540 |  462.270 |          336.500 |                       |          10.392 |       65.787 |        1,000 |
| WebGPU   | stream  | webgpu |       3.170 |   14.760 |    2.560 |  100.960 |          261.330 |                14.442 |                 |              |            0 |
| WebGPU   | stamped | webgpu |      16.030 |  123.940 |    9.335 |  339.695 |          280.540 |                20.649 |          11.729 |       91.755 |        1,000 |
| WebGL2   | fenced  | cpu    |      85.350 |  146.170 |   66.480 |  274.455 |          150.140 |                       |                 |              |            0 |
| WebGL2   | again   | cpu    |      81.320 |  117.095 |   65.265 |  302.950 |           45.220 |                       |                 |              |            0 |
| WebGL2   | stream  | cpu    |      81.645 |  121.080 |   69.965 |  235.970 |           35.500 |                84.578 |                 |              |            0 |

"Ran on" is the fuse report's tier: the best tier any call of the plan ran on. "GPU" is the sum of
the groups' `gpuTime` of a block, where the device measured one. No arm's host `read()` returned a
byte while its timed blocks ran.

### Where a block's GPU time goes, on WebGPU

The mean `gpuTime` of each group over the 1,000 timed blocks, in milliseconds:

| Arm     |  cull | tally | spawn | tally | play + keep | Sum of the means |
| ------- | ----: | ----: | ----: | ----: | ----------: | ---------------: |
| fenced  | 0.807 | 0.028 | 0.524 | 0.030 |       9.339 |           10.727 |
| again   | 0.945 | 0.026 | 0.579 | 0.025 |      12.627 |           14.202 |
| stamped | 1.049 | 0.030 | 0.713 | 0.035 |      14.073 |           15.900 |

### The grains of each block

The log of the counts, over the 1,000 timed blocks. Every arm of every tier gave these numbers.

| Count                                    | Median | p99 | Min | Max |  Mean |
| ---------------------------------------- | -----: | --: | --: | --: | ----: |
| Grains in the list `play` rendered       |    814 | 869 | 719 | 891 | 813.3 |
| Grains `cull` kept from the block before |    601 | 648 | 517 | 666 | 600.0 |
| Grains `spawn` appended                  |    213 | 243 | 173 | 252 | 213.2 |

`spawn` appended 9,995 grains a second over the timed blocks. The largest list of any block, the
warm-up included, held 891 grains, 44 % of its capacity of 2,048, so no push was dropped. Every
arm's last list, 816 grains, held its grains in the order they started.

### How the plan ran

The fuse report of the last block, on each tier:

| Tier     | Dispatches | Submissions | Groups                                                                                                                                                                        |
| -------- | ---------: | ----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGPU   |         10 |           1 | `cull`; `tally`; `spawn`; `tally`; `play + keep`, fused, one dispatch at `[64, 1, 1]`. `cull` and `spawn` each have one workgroup shape, `[64, 1, 1]`; each `tally` has none. |
| WebGL2   |          0 |           0 | One group for each of the six calls, none fused, and no `why`; the report's tier is `cpu`.                                                                                    |
| CPU tier |          0 |           0 | One group for each of the six calls, none fused.                                                                                                                              |

The `why` of each group on WebGPU, word for word:

| Group         | `why`                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| `cull`        | none: the first group                                                                      |
| `tally`       | `cull and tally run as two dispatches because tally stores into an array after its loops`  |
| `spawn`       | `tally and spawn run as two dispatches because spawn pushes after a held length`           |
| `tally`       | `spawn and tally run as two dispatches because tally stores into an array after its loops` |
| `play + keep` | `tally and play run as two dispatches because tally stores into an array after its loops`  |

`explain()` of the `fenced` arm on WebGPU, as the engine prints it:

```
1000 blocks on WebGPU, each block one fuse plan
the last block: 10 dispatches, 1 submission
  1. cull: 1 dispatch, 0.683 ms GPU
  2. tally: 0 dispatches, 0.010 ms GPU
     cull and tally run as two dispatches because tally stores into an array after its loops
  3. spawn: 1 dispatch, 0.775 ms GPU
     tally and spawn run as two dispatches because spawn pushes after a held length
  4. tally: 0 dispatches, 0.042 ms GPU
     spawn and tally run as two dispatches because tally stores into an array after its loops
  5. play + keep: fused into one dispatch, 5.750 ms GPU
     tally and play run as two dispatches because tally stores into an array after its loops
all blocks: 10000 dispatches, 1000 submissions, 10727.446 ms GPU
```

### The same seed, twice and across the tiers

Each tape holds 1,034,240 samples, the 1,010 blocks of an arm. Values are compared by their bits.

| Compared                                            | Samples that differ | Largest difference | Log of the counts | Last list (816 grains) |
| --------------------------------------------------- | ------------------: | -----------------: | ----------------- | ---------------------- |
| CPU tier: `again` and `stream` to `fenced`          |                   0 |                  0 | the same          | the same               |
| WebGPU: `again`, `stream` and `stamped` to `fenced` |                   0 |                  0 | the same          | the same               |
| WebGL2: `again` and `stream` to `fenced`            |                   0 |                  0 | the same          | the same               |
| CPU tier in Node to the WebGL2 arm                  |                   0 |                  0 | the same          | the same               |
| CPU tier to WebGPU                                  |           1,034,073 |       1.21 × 10^-4 | the same          | the same               |

Between the CPU tier and WebGPU the median difference is 1.48 × 10^-5 and the 99th percentile
5.67 × 10^-5. No difference is above 2^-11. The render's peak is 0.761 and its RMS 0.162. The 167
samples that agree include the first three frames, which are silent on every tier.

### What WebGL2 refuses

On a device of WebGL2 alone (`dev.tier` `webgl2`), each call and the plan threw these errors, word
for word:

| Call     | Error                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cull`   | `cull(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 pushes onto an array, which the WebGL2 tier does not run (change 0078)).`                                             |
| `spawn`  | `spawn(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 pushes onto an array, which the WebGL2 tier does not run (change 0078)).`                                            |
| `play`   | `play(): no tier it may use can run it (webgl2: it runs on the CPU, its GLSL did not emit: glsl-es300: arrayLength has no GLSL ES 3.00 spelling (no storage buffers, no runtime-sized arrays)).` |
| `keep`   | `keep(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 writes "tape" other than at i).`                                                                                      |
| `tally`  | `tally(): no tier it may use can run it (webgl2: it runs on the CPU, it has no loop to draw).`                                                                                                   |
| the plan | `cull(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 pushes onto an array, which the WebGL2 tier does not run (change 0078)).`                                             |

## Observations

These are facts of this run.

1. On WebGPU each block ran as one plan of 10 dispatches in 1 submission. `play` and `keep` fused
   into one dispatch. The other four calls stood apart: `cull` and `spawn` because they push, each
   `tally` because it stores after its loops.
2. On WebGPU the `stream` arm submitted 1,000 blocks with no fence and no read: the page counted no
   device read while they ran. The blocks took 14.442 ms each, to one fence after the last. Each
   `fuse` call took a median of 3.170 ms.
3. On the default WebGPU device, which has `timestamp-query`, every plan made one device read:
   1,000 in each of `fenced`, `again` and `stamped`. With no fence, each `fuse` call of `stamped`
   took a median of 16.030 ms, against 3.170 ms in `stream`.
4. On WebGPU the median of a fenced block, 13.550 ms and 15.285 ms, and the stream's 14.442 ms are
   below the block's 21.33 ms. The 99th percentiles, 32.360 ms to 123.940 ms, are above it. The
   load average rose from 6.05 to 14.28 while the WebGPU arms ran.
5. Of a block's GPU time on WebGPU, `play + keep` took 87 % in `fenced` (9.339 ms of 10.727 ms).
   `cull` took 0.807 ms over 2,048 iterations, and `spawn` 0.524 ms over 1,024.
6. On the CPU tier in Node a block took a median of 99.902 ms to 111.228 ms, 4.7 to 5.2 times its
   duration.
7. On a device that opened on WebGL2, every call of the block fell to the CPU tier. The report's
   tier is `cpu`, and no group says why. A block took a median of 81.320 ms to 85.350 ms, and the
   page counted no device read.
8. Each tier rendered the same seed with the same bits in every arm. The CPU tier in Node and the
   CPU tier in Chromium gave the same bits. WebGPU differed from the CPU tier in 1,034,073 of
   1,034,240 samples, by at most 1.21 × 10^-4.
9. The lists and the logs were the same bits on the three tiers: the same grains, in the same
   order, with the same lengths, pitches and levels.
10. Every last list held its grains in the order they started. A push appends in the order of a
    sequential run on every tier (compiler surface §65), so `cull` keeps the survivors' order and
    `spawn` appends the new grains after them in the order of their frames.
11. `explain()` printed "1 dispatch" for `cull` and "0 dispatches" for each `tally`, in a plan whose
    report counts 10. It counts a group's workgroup shapes as its dispatches. A loop that pushes has
    one shape for its count, scan and store, and the stores after the loops have none (surface §71).
12. The first block of an arm built its pipelines: 433.305 ms on WebGPU, 183.747 ms on the CPU tier
    in Node, 150.140 ms in the WebGL2 arm.

## Inferences

These are inferences, not results.

- On the container's WebGPU the pair runs 10,000 grains a second at blocks of 1,024 frames with no
  host read per block, by the median and by the stream's rate (observations 2 and 4). It does not
  by the 99th percentile on a machine this loaded. A real GPU decides, and the owner's devices are
  pending.
- The device can hold the whole schedule. The host submits one plan per block with the block's
  first frame and the cloud, and keeps no count. This supports decision D3 of
  `docs/architecture.md` for grains: `push` and a count that stays on the device.
- Where WebGPU is missing, the same kernels run on the CPU tier and give the same lists, so the
  host-side fallback needs no second scheduler. At this density the CPU tier does not keep up on
  the container (observation 6); a lower density, or the CPU tier's speed (ask S), would.
- The grain order needs no stable sort here (observations 9 and 10): compiler issue #539 is not
  needed by one cloud's list. A sort would matter to a list merged from several sources by start
  frame, or ordered by another key. This run measures neither.
- A host that wants no read per block passes a device with no `timestamp-query`; its reports then
  carry no `gpuTime` (observation 3). The general part is ask Z of `docs/compiler-asks.md`.
- `cull` over the capacity costs little at this headroom: 0.807 ms of 10.727 ms. Its cost grows
  with the capacity, not with the grains (ask W of `docs/compiler-asks.md`).

## Open questions

- The time per block and its 99th percentile on the owner's devices, with a real GPU's queue.
- Whether the method's step 1 names `cull` as a third kernel, or `cull` moves into `spawn` as a
  first loop that pushes onto the same list (deviation 1).
- On WebGL2: whether the engine schedules on the CPU tier and renders on WebGL2. `play` reads
  `grains.length`, which has no GLSL ES 3.00 spelling (ask J), so the render falls to the CPU tier
  too. This run does not measure a render on WebGL2.
- How `explain()` should word a group that pushes or stores after its loops (observation 11). The
  report gives no dispatch count per group (ask Y of `docs/compiler-asks.md`).

## Deviations from the method

Each with its disposition.

1. **Three kernels, not two.** The method's step 1 names two kernels; the scheduler has three.
   A list that only grows by `push` holds every grain ever started: about 213,000 grains after
   1,000 blocks, all read by each render. `cull` keeps the list to the grains that sound, and it is a
   push too. Disposition: open, for the owner. The alternative lowers for WebGPU at the pin too: one
   kernel whose first loop pushes the survivors and whose second pushes the new grains onto the
   same list (change 0094). A probe compiled with the pinned compiler's `hostFace` showed it; the
   probe is not in the tree.
2. **Two kernels of the harness in each plan.** `tally` and `keep` keep the counts and the block
   on the device, so a run reads nothing back until its end; the time per block includes them.
   Disposition: closed. Their GPU time is in the table: about 0.03 ms for each `tally`, and `keep`
   fused with `play`.
3. **A block is timed to a fence, not to a read.** Experiment 1 times a block to the host's read of
   it; this question excludes a read per block, so `fenced` times a block to `dev.wait()`, and
   `stream` and `stamped` time blocks with no fence. Disposition: closed.
4. **Two arms beyond the method.** `again` is the second render of the same seed (step 3), and
   `stamped` separates the cost of the timestamps from the fence. Disposition: closed.
5. **WebGL2 with the CPU tier after it.** The arms on WebGL2 run with `prefer: ['webgl2', 'cpu']`,
   as experiment 1's do, and every call fell to the CPU tier. The refusals come from a device of
   WebGL2 alone. Disposition: closed.

## What this run does not measure

- The owner's devices, on WebGPU and on WebGL2: one record per device, `06-granular-<device>.md`.
- A machine with no other load: the container is shared (section "The devices").
- A real GPU's queue and its fences: SwiftShader runs the GPU's work on the host's CPU.
- A list that overflows its capacity: no block came near it. `test/grains.test.ts` holds that path
  on the CPU tier.
- Several clouds in one list, and grains that read a recorded sample: these grains are sine bursts.
- The way to the audio thread: a ring of blocks and an AudioWorklet (`docs/architecture.md`,
  section 8, "Real time").
