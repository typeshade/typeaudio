# Record 04: a 10,000-partial additive render with the fuse report read, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say how the engine plans a block of 10,000 partials, what the plan costs on this
> container and how close each tier comes to a plain-JavaScript reference. They do not stand for a
> GPU, and they decide nothing about the owner's devices. The device runs of experiment 4 are
> pending (`docs/experiments.md`, section 4).

## The answers

Facts of this run, on the container (sections "The numbers" and "The fuse report, as the run gave
it" hold them in full):

- **How many dispatches `fuse` plans.** On WebGPU the engine's block of 10,000 partials is one plan
  of 3 dispatches in 1 submission, in 2 groups, in every one of the 1,000 timed blocks: `additive`
  alone, at `[64, 1, 1]`; `mixdown`, `gain` and `peak` fused into one loop dispatch at
  `[256, 1, 1]`; and the fold of the meter's 4 partials. On WebGL2 it is 2 draws and 0
  submissions; on the CPU tier, 0 and 0 in 4 groups.
- **Where the reduction lands.** The meter `peak`, a reduction, ends the fused group after the
  gather and the gain (fact F6 of surface §71). A sum of the partials in the tree order of Rule 7.2
  lands in no fused group: as one reduction per frame (`tree`) it is 1,024 groups of their own and
  3,075 dispatches per block, and as a scatter (`scatter`) it runs on the CPU tier.
- **The time per block** of the engine's plan, the median and the 99th percentile of 1,000 timed
  blocks: WebGPU 367.280 and 598.365 ms; WebGL2 1,780.025 and 2,420.165 ms; the CPU tier
  1,493.971 and 1,822.967 ms. A block is 21.33 ms of audio at 48 kHz.

## The run

| Item         | Value                                                                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 4, a 10,000-partial additive render with the fuse report read (`docs/experiments.md`, section 4)                                                                                                                                                                                                                                              |
| Runs         | Nine invocations of `bun run exp:04`, one at a time, each with `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` and its own `--out` (the table below)                                                                                                                   |
| Date         | 2026-11-02, from 15:53 UTC to 18:16 UTC                                                                                                                                                                                                                                                                                                       |
| Commits      | `14240eab041ede4f258cdae0b6b43be0e6642a92` (R1-cpu) and `73c6888e182b93cf50de415f52d0bf4d9eafdcf2` (the other runs) of `typeshade/typeaudio`, branch `claude/exp-04-additive` (pull request #10), each with a clean tree (deviation 6)                                                                                                        |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                                                                                                                               |
| Tools        | Bun 1.4.4, Vite 7.3.7, playwright-core 1.64.1, Node v22.23.4, Chrome Headless Shell 153.0.8010.12                                                                                                                                                                                                                                             |
| Raw data     | `docs/records/04-additive-container.json`: the runs as `runs`, each with its label, its arguments and the JSON it wrote: the options, the rows, the last block's fuse report, the comparisons with the reference, the coefficients, the sums alone, the tier of each kernel, each device's `DeviceInfo` and the load average around each part |

| Run        | Arguments after `bun run exp:04`                                                    | Started (UTC) | Commit    | Load average over 1, 5 and 15 minutes, before; after                                          |
| ---------- | ----------------------------------------------------------------------------------- | ------------- | --------- | --------------------------------------------------------------------------------------------- |
| R1-cpu     | `--tier cpu --variants gather --blocks 1000 --warmup 10`                            | 15:53         | `14240ea` | Node: 13.22, 9.22, 6.36; 7.24, 4.02, 4.45                                                     |
| R1-webgpu  | `--tier webgpu --variants gather,resident --blocks 1000 --warmup 10`                | 16:34         | `73c6888` | Node: 6.69, 4.23, 4.50; 3.60, 7.85, 6.84 / WebGPU: 3.60, 7.85, 6.84; 7.02, 10.74, 9.13        |
| R1-webgl2  | `--tier webgl2 --variants gather --blocks 1000 --warmup 10`                         | 17:01         | `73c6888` | WebGL2: 6.62, 10.59, 9.10; 10.85, 10.15, 8.70                                                 |
| R3-webgpu  | `--tier webgpu --variants tree,scatter --blocks 5 --warmup 1 --sums no`             | 17:36         | `73c6888` | Node: 11.02, 10.19, 8.72; 11.72, 10.40, 8.81 / WebGPU: 12.06, 10.49, 8.85; 13.97, 11.88, 9.55 |
| R3b-webgpu | `--tier webgpu --variants gather,tree --frames 512 --blocks 5 --warmup 1 --sums no` | 17:38         | `73c6888` | Node: 14.16, 11.98, 9.61; 13.90, 11.97, 9.61 / WebGPU: 13.90, 11.97, 9.61; 10.32, 11.27, 9.46 |
| R2-webgpu  | `--tier webgpu --variants host,f64 --blocks 1000 --warmup 10 --sums no`             | 17:39         | `73c6888` | Node: 9.65, 11.12, 9.42; 1.18, 4.04, 6.74 / WebGPU: 1.18, 4.04, 6.74; 5.15, 4.08, 5.65        |
| R4-cpu     | `--tier cpu --variants host,f64,resident --blocks 20 --warmup 2 --sums no`          | 17:59         | `73c6888` | Node: 5.30, 4.13, 5.66; 1.80, 3.26, 5.10                                                      |
| R3-cpu     | `--tier cpu --variants tree,scatter --blocks 1 --warmup 1 --sums no`                | 18:01         | `73c6888` | Node: 1.73, 3.22, 5.08; 2.51, 3.30, 4.24                                                      |
| R4-webgl2  | `--tier webgl2 --variants host,f64,resident --blocks 20 --warmup 2 --sums no`       | 18:12         | `73c6888` | Node: 2.87, 3.36, 4.25; 2.79, 3.30, 4.20 / WebGL2: 2.97, 3.32, 4.20; 5.35, 3.81, 4.24         |

The container is shared with other agent sessions, and the runs did not reserve it. The load
average over 1 minute moved between 1.18 and 14.16 over the runs, on 4 cores, so the medians and,
more, the 99th percentiles hold the load of other processes. A Node part computed the reference,
and R1-webgl2 reused the reference of R1-webgpu (`reference` in the JSON says which). The session's
shell set `BUN_OPTIONS=--smol` for the runner, which Bun runs; the timed work runs in Node and in
Chromium.

## The devices

| Item                              | CPU tier                                                                                       | WebGPU                                                                                                                               | WebGL2                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Host                              | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same                                                                                                                             | the same                                            |
| Runtime                           | Node v22.23.4                                                                                  | Chrome Headless Shell 153.0.8010.12                                                                                                  | the same                                            |
| Graphics                          | none                                                                                           | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `timestamp-query` | ANGLE on Vulkan 1.3.0, SwiftShader Device (Subzero) |
| Clock step of `performance.now()` | 0.000055 ms                                                                                    | 0.005 ms (the page is cross-origin isolated)                                                                                         | 0.005 ms                                            |

## The method

The harness is `experiments/04-additive/`, run by `bun run exp:04`. It follows the method of
experiment 1 (`docs/records/01-round-trip-container.md`, "The method"): Vite bundles the harness
for Node, which runs the CPU tier, and for a page, which headless Chromium opens with WebGPU and
WebGL2 on SwiftShader, one browser per tier and one at a time.

- **The bank.** 10,000 partials, one lane each, one bank per concrete class (decision D2). A
  partial is a `Sine` (the engine's oscillator) through a lowpass at the level of an `Envelope`
  (a unit this pull request adds, `src/units/envelope.shade.ts`). The partials are spaced evenly
  in pitch from 20 Hz to 20 kHz, each at the level `0.25 / sqrt(10000)`, its filter's cutoff an
  octave above it with the quality 0.707, its envelope rising in 5 to 15 ms and falling in 4 s
  (the lowest) to 0.2 s (the highest) toward a sustain of 0.2 to 0.5 (`spec` in `options.ts`).
- **The block.** 1,024 frames at 48 kHz, one `dev.fuse()` scope per block, as `render()` runs one
  (`docs/architecture.md`, section 3):
  1. `additive(lanes, partials, 1024, sweep)`, shape V: lane `v` moves its filter's cutoff to
     `sweep` times its own (`retune`), then writes its 1,024 frames to `lanes[v * 1024 + n]`;
  2. the sum of the lanes into `mixed`, which the variant chooses;
  3. `gain(master, mixed, 0.5)`, shape F, the engine's kernel;
  4. `peak(master)`, shape R, the engine's meter, a reduction at the end of the scope.

  `lanes` (10,240,000 numbers) and `mixed` are scratch arrays of the scope. The master is a
  `Resident` of 1,024 numbers, read once per block. The sweep of block `b` is
  `2 ** (2 * sin(2π b / 256))`: every cutoff moves between a quarter and four times its own, over
  256 blocks, below 0.45 of the sample rate.
- **The variants.** Three sums of the lanes, with the coefficients designed on the device in
  `f32` by the engine's `Lowpass`:
  - `gather`: the engine's `mixdown`, shape G, one invocation per frame adding the 10,000 lanes
    one after another. This is the engine's plan, and the variant every tier ran over 1,000
    blocks.
  - `tree`: `sumFrame` once per frame, 1,024 calls per block, each a reduction over the 10,000
    lanes, so the sum is in the tree order of Rule 7.2 on every tier (method step 3 as written).
  - `scatter`: `sumScatter`, `out[n] += lanes[v * 1024 + n]` over the lanes, the form an author
    writes to add every lane into the block. The CPU tier folds it in the tree order of Rule 7.2;
    the proof refuses it for the GPU.

  Two variants of where a partial's filter gets the coefficients of the new cutoff, with the
  `gather` sum (ask D):
  - `host`: the host designs them in JavaScript doubles (`design.ts`) and writes them to a
    `Resident` before each block, and `additiveHost` hands each lane its five;
  - `f64`: `Lowpass64` designs them on the device in the emulated `f64` (surface §39).

  One variant of where the lanes live, with the `gather` sum:
  - `resident`: a `Resident` the device makes once and every block writes again. A scratch array
    that two groups share is a new device buffer in every plan, which the plan destroys when it
    has run (`ScratchState.release`, `src/core/fuse-record.ts` of the pin): here 40,960,000 bytes
    per block.
- **The time.** Each variant runs its warm-up blocks first (10 in R1 and R2, 2 in R4, 1 in R3),
  the first of them timed apart as "first block". Then it times each block with
  `performance.now()`, from the `fuse` call to the host's read of the master and of the peak. The
  median and the 99th percentile are by nearest rank. "GPU time" is the mean, over the timed
  blocks, of the `gpuTime` of the plan's groups.
- **The reference.** Node runs a plain-JavaScript reference of the same blocks
  (`experiments/04-additive/reference.ts`, built on `test/reference.ts`): each operation rounded
  to an `f32`, the sums in the variant's order. It runs in the process that ran the CPU tier, so
  both call one `Math.sin`. Each tier's samples, 1,034,240 in R1 and R2 (10 warm-up and 1,000
  timed blocks of 1,024), and its bank after the last block are held to it.
- **The sums alone.** After the variants of R1, each tier runs the three sums on one block of
  fixed lanes, the same `f32` values on every host (`lanesInput`), and holds each to the
  plain-JavaScript sum of the same order. This separates the order of a sum from the lanes a tier
  computes. The other runs skip it (`--sums no`).
- **The tier of each kernel.** In R1, each kernel runs alone in a scope of its own, at 64 partials
  of 64 frames, on a device of the run's tiers. A plan of one call reports that call's tier. A
  plan's report names only its best tier (`docs/compiler-asks.md`, P), so the record reads each
  group's tier from here, and checks it against the dispatches or draws the plan counts.
- **The coefficients.** The bank after the last block holds the last block's coefficients. Each
  is held to the lowpass designed in doubles, unrounded, for the partial's cutoff at that block's
  sweep: the relative error of `b0`, `b1` and `b2`, and the cutoff the coefficients give,
  `2 asin(sqrt(b1 / (1 + a2)))`, against the partial's own.
- **The tiers of a device.** A device opens with `prefer: [tier, 'cpu']` on WebGPU and on WebGL2,
  so a call the GPU tier cannot run falls to the CPU tier, as on a device the engine opens.
  Experiment 1 opened WebGPU alone.

## The numbers

### The time per block

From the `fuse` call to the host's read of the master and of the peak. "GPU time" is the mean of
the timed blocks' `gpuTime`, summed over the plan's groups, where the device measured it. The runs
ran at different loads (section "The run"), so a median compares best with one of the same run.

WebGPU:

| Run        | Variant    | Frames | Timed blocks | Median (ms) |   p99 (ms) | First block (ms) |   Min (ms) |   Max (ms) |  Mean (ms) | GPU time (ms) | Dispatches | Submissions |
| ---------- | ---------- | -----: | -----------: | ----------: | ---------: | ---------------: | ---------: | ---------: | ---------: | ------------: | ---------: | ----------: |
| R1-webgpu  | `gather`   |  1,024 |        1,000 |     367.280 |    598.365 |          546.240 |    175.060 |    761.555 |    369.410 |       343.738 |          3 |           1 |
| R1-webgpu  | `resident` |  1,024 |        1,000 |     406.245 |    838.050 |          993.695 |    142.600 |  1,349.860 |    417.910 |       397.807 |          3 |           1 |
| R3-webgpu  | `tree`     |  1,024 |            5 |  12,130.720 | 13,194.030 |       11,581.990 | 10,505.485 | 13,194.030 | 11,776.817 |               |      3,075 |           1 |
| R3-webgpu  | `scatter`  |  1,024 |            5 |   5,407.840 |  6,440.195 |        6,245.300 |  5,253.780 |  6,440.195 |  5,595.245 |       385.055 |          3 |           3 |
| R3b-webgpu | `gather`   |    512 |            5 |     128.970 |    175.210 |          426.565 |    114.205 |    175.210 |    139.887 |       120.930 |          3 |           1 |
| R3b-webgpu | `tree`     |    512 |            5 |   4,602.000 |  5,062.095 |        4,012.535 |  3,577.860 |  5,062.095 |  4,468.537 |     4,397.112 |      1,539 |           1 |
| R2-webgpu  | `host`     |  1,024 |        1,000 |     201.105 |    312.690 |          595.235 |    164.035 |    403.420 |    208.426 |       188.955 |          3 |           1 |
| R2-webgpu  | `f64`      |  1,024 |        1,000 |     216.925 |    395.455 |          541.730 |    163.600 |    481.605 |    233.570 |       213.784 |          3 |           1 |

WebGL2:

| Run       | Variant    | Frames | Timed blocks | Median (ms) |  p99 (ms) | First block (ms) |  Min (ms) |  Max (ms) | Mean (ms) | GPU time (ms) | Dispatches | Submissions |
| --------- | ---------- | -----: | -----------: | ----------: | --------: | ---------------: | --------: | --------: | --------: | ------------: | ---------: | ----------: |
| R1-webgl2 | `gather`   |  1,024 |        1,000 |   1,780.025 | 2,420.165 |        2,131.190 | 1,497.385 | 3,112.475 | 1,824.272 |               |          2 |           0 |
| R4-webgl2 | `host`     |  1,024 |           20 |   1,926.745 | 2,136.520 |        2,149.690 | 1,863.335 | 2,136.520 | 1,947.508 |               |          2 |           0 |
| R4-webgl2 | `f64`      |  1,024 |           20 |   1,927.115 | 2,118.525 |        1,943.325 | 1,800.475 | 2,118.525 | 1,933.134 |               |          2 |           0 |
| R4-webgl2 | `resident` |  1,024 |           20 |   2,063.615 | 2,360.650 |        2,117.135 | 1,847.610 | 2,360.650 | 2,096.926 |               |          2 |           0 |

CPU tier:

| Run    | Variant    | Frames | Timed blocks | Median (ms) |    p99 (ms) | First block (ms) |    Min (ms) |    Max (ms) |   Mean (ms) | GPU time (ms) | Dispatches | Submissions |
| ------ | ---------- | -----: | -----------: | ----------: | ----------: | ---------------: | ----------: | ----------: | ----------: | ------------: | ---------: | ----------: |
| R1-cpu | `gather`   |  1,024 |        1,000 |   1,493.971 |   1,822.967 |        1,790.894 |   1,296.663 |   2,028.596 |   1,507.996 |               |          0 |           0 |
| R4-cpu | `host`     |  1,024 |           20 |   1,873.429 |   2,127.101 |        3,361.789 |   1,765.021 |   2,127.101 |   1,886.539 |               |          0 |           0 |
| R4-cpu | `f64`      |  1,024 |           20 |   1,874.815 |   2,220.549 |        1,885.325 |   1,780.784 |   2,220.549 |   1,909.452 |               |          0 |           0 |
| R4-cpu | `resident` |  1,024 |           20 |   1,758.320 |   1,927.998 |        1,889.921 |   1,654.592 |   1,927.998 |   1,764.975 |               |          0 |           0 |
| R3-cpu | `tree`     |  1,024 |            1 | 316,073.214 | 316,073.214 |      312,040.921 | 316,073.214 | 316,073.214 | 316,073.214 |               |          0 |           0 |
| R3-cpu | `scatter`  |  1,024 |            1 |   9,286.553 |   9,286.553 |        9,240.074 |   9,286.553 |   9,286.553 |   9,286.553 |               |          0 |           0 |

### Against the reference

Every warm-up and timed block, and the bank after the last block (11 values per partial: the
phase and its step, the envelope's rise and fall, the five coefficients and the two states). The
largest magnitude of the reference is 0.682 in every run.

| Run        | Variant    | Tier     | Samples with the reference's bits | Largest difference | Bank values with the reference's bits | Bank: largest difference | Blocks whose peak has the reference's bits |
| ---------- | ---------- | -------- | --------------------------------: | -----------------: | ------------------------------------: | -----------------------: | -----------------------------------------: |
| R1-cpu     | `gather`   | CPU tier |            1,034,240 of 1,034,240 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                             1,010 of 1,010 |
| R1-webgpu  | `gather`   | WebGPU   |                    2 of 1,034,240 |          1.960e-01 |                     40,012 of 110,000 |                8.037e-01 |                                 0 of 1,010 |
| R1-webgpu  | `resident` | WebGPU   |                    2 of 1,034,240 |          1.960e-01 |                     40,012 of 110,000 |                8.037e-01 |                                 0 of 1,010 |
| R1-webgl2  | `gather`   | WebGL2   |            1,034,240 of 1,034,240 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                             1,010 of 1,010 |
| R3-webgpu  | `tree`     | WebGPU   |                        1 of 6,144 |          1.960e-01 |                     40,023 of 110,000 |                2.918e-01 |                                     0 of 6 |
| R3-webgpu  | `scatter`  | WebGPU   |                        1 of 6,144 |          1.960e-01 |                     40,023 of 110,000 |                2.918e-01 |                                     0 of 6 |
| R3b-webgpu | `gather`   | WebGPU   |                        1 of 3,072 |          1.830e-01 |                     40,021 of 110,000 |                2.532e-01 |                                     0 of 6 |
| R3b-webgpu | `tree`     | WebGPU   |                        1 of 3,072 |          1.830e-01 |                     40,021 of 110,000 |                2.532e-01 |                                     0 of 6 |
| R2-webgpu  | `host`     | WebGPU   |                  202 of 1,034,240 |          4.858e-05 |                     90,004 of 110,000 |                3.890e-04 |                                 0 of 1,010 |
| R2-webgpu  | `f64`      | WebGPU   |                  226 of 1,034,240 |          4.858e-05 |                     90,000 of 110,000 |                3.890e-04 |                                 0 of 1,010 |
| R4-cpu     | `host`     | CPU tier |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |
| R4-cpu     | `f64`      | CPU tier |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |
| R4-cpu     | `resident` | CPU tier |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |
| R3-cpu     | `tree`     | CPU tier |                    2,048 of 2,048 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                     2 of 2 |
| R3-cpu     | `scatter`  | CPU tier |                    2,048 of 2,048 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                     2 of 2 |
| R4-webgl2  | `host`     | WebGL2   |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |
| R4-webgl2  | `f64`      | WebGL2   |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |
| R4-webgl2  | `resident` | WebGL2   |                  22,528 of 22,528 |          0.000e+00 |                    110,000 of 110,000 |                0.000e+00 |                                   22 of 22 |

### The coefficients of the last block

Against the lowpass designed in doubles, unrounded, for each partial's cutoff at the sweep of the
run's last block. The cutoff error is the angle the coefficients give,
`2 asin(sqrt(b1 / (1 + a2)))`, over the angle of the design, less 1.

| Run       | Variant                      | Tier     |  Sweep | `b0`, largest relative error | `b0` within 2^-20 | Cutoff, largest error | At the cutoff of the worst `b0` |
| --------- | ---------------------------- | -------- | -----: | ---------------------------: | ----------------: | --------------------: | ------------------------------: |
| R1-cpu    | `gather`                     | CPU tier | 0.6072 |                     5.77e-03 |   4,414 of 10,000 |               0.289 % |                        24.39 Hz |
| R1-cpu    | the reference's `f32` design |          | 0.6072 |                     5.77e-03 |   4,414 of 10,000 |               0.289 % |                        24.39 Hz |
| R1-webgpu | `gather`                     | WebGPU   | 0.6072 |                     1.69e+00 |      52 of 10,000 |                63.9 % |                        24.30 Hz |
| R1-webgl2 | `gather`                     | WebGL2   | 0.6072 |                     5.77e-03 |   4,414 of 10,000 |               0.289 % |                        24.39 Hz |
| R2-webgpu | `host`                       | WebGPU   | 0.6072 |                     2.71e-07 |  10,000 of 10,000 |            1.95e-05 % |                       362.73 Hz |
| R2-webgpu | `f64`                        | WebGPU   | 0.6072 |                     2.71e-07 |  10,000 of 10,000 |            1.95e-05 % |                       362.73 Hz |
| R2-webgpu | the reference's `f64` design |          | 0.6072 |                     2.71e-07 |  10,000 of 10,000 |            1.95e-05 % |                       362.73 Hz |

`resident` holds the coefficients of `gather` (R1-webgpu, R4). The shorter runs end at other
sweeps, and their rows in the JSON agree: the `f32` design on WebGPU has the cutoff off by up to
35.9 %, at 47.59 Hz (R3-webgpu and R3b-webgpu, sweep 1.1849), and on the CPU tier and WebGL2
every variant holds the reference's coefficients (R3-cpu, R4-cpu, R4-webgl2).

### The sums alone

One block of fixed lanes, 10,000 of 1,024 frames, held to the plain-JavaScript sum of the same
order (R1).

| Tier     | Sum       | Frames with the reference's bits | Plan's tier | Dispatches | Submissions | Groups |
| -------- | --------- | -------------------------------: | ----------- | ---------: | ----------: | -----: |
| CPU tier | `gather`  |                   1,024 of 1,024 | cpu         |          0 |           0 |      1 |
| CPU tier | `tree`    |                   1,024 of 1,024 | cpu         |          0 |           0 |  1,024 |
| CPU tier | `scatter` |                   1,024 of 1,024 | cpu         |          0 |           0 |      1 |
| WebGPU   | `gather`  |                   1,024 of 1,024 | webgpu      |          1 |           1 |      1 |
| WebGPU   | `tree`    |                   1,024 of 1,024 | webgpu      |      3,072 |           1 |  1,024 |
| WebGPU   | `scatter` |                   1,024 of 1,024 | cpu         |          0 |           0 |      1 |
| WebGL2   | `gather`  |                   1,024 of 1,024 | webgl2      |          1 |           0 |      1 |
| WebGL2   | `tree`    |                   1,024 of 1,024 | cpu         |          0 |           0 |  1,024 |
| WebGL2   | `scatter` |                   1,024 of 1,024 | cpu         |          0 |           0 |      1 |

## The fuse report, as the run gave it

### The engine's plan, `gather`

The last block's report on each tier, as the JSON holds it (R1):

WebGPU (R1-webgpu):

```json
{"tier":"webgpu","dispatches":3,"submissions":1,"groups":[{"calls":["additive"],"fused":false,"workgroupShapes":[[64,1,1]],"gpuTime":339288189},{"calls":["mixdown","gain","peak"],"fused":true,"why":"additive and mixdown run as two dispatches because the trip counts differ (10000 and 1024)","workgroupShapes":[[256,1,1]],"gpuTime":137745855}]}
```

WebGL2 (R1-webgl2):

```json
{"tier":"webgl2","dispatches":2,"submissions":0,"groups":[{"calls":["additive"],"fused":false},{"calls":["mixdown"],"fused":false,"why":"WebGL2 runs the calls apart"},{"calls":["gain"],"fused":false,"why":"WebGL2 runs the calls apart"},{"calls":["peak"],"fused":false}]}
```

The CPU tier (R1-cpu):

```json
{"tier":"cpu","dispatches":0,"submissions":0,"groups":[{"calls":["additive"],"fused":false},{"calls":["mixdown"],"fused":false},{"calls":["gain"],"fused":false},{"calls":["peak"],"fused":false}]}
```

Every timed block planned the same groups on its tier: the smallest and the largest dispatch
counts over the 1,000 timed blocks are equal (section "The numbers").

What the planner did on WebGPU, read with surface §71 (the report names only the fact that failed;
the facts that held are the planner's rules for a group that fused):

| Between               | One dispatch? | Why, as the report says it or as §71 gives the rule                                                                                                                  |
| --------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `additive`, `mixdown` | no            | F2: "additive and mixdown run as two dispatches because the trip counts differ (10000 and 1024)"                                                                     |
| `mixdown`, `gain`     | yes           | F1 to F5 and F7 held: one top-level loop each over 1,024 iterations; `mixed` written and read at the counter; `gain` writes `master`, which `mixdown` does not touch |
| `gain`, `peak`        | yes           | F6: a reduction joins as the last call of the group; the group runs at 256 (F7)                                                                                      |

- `mixdown` gathers from `lanes`, which `additive` wrote in the group before, so F3 does not hold
  it apart (F3 binds only the arrays a call of the group writes). It heads the fused group, as
  `docs/architecture.md`, section 2, says since pull request #7.
- The fused group is one loop dispatch at `[256, 1, 1]`: 1,024 iterations, 4 workgroups. The fold
  of `peak`'s 4 partials is the third dispatch of the plan, which the group's one triple does not
  show (§71: "The fold levels of a reduction are not entries").
- `additive` is one dispatch at `[64, 1, 1]`: 10,000 iterations, 157 workgroups, each invocation
  running its lane's 1,024 frames.
- `mixed` is a local of the fused group: every call that names it is in the group, one writes it,
  and every access is at the counter (§71, "Scratch arrays"). `lanes` is not: two groups name it,
  so the plan made it a device buffer of 40,960,000 bytes and destroyed it after the plan, every
  block. The report says neither.

### The other variants

| Variant                   | Tier   | Groups of the last block's report                                                                                                |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `tree`                    | WebGPU | `additive`; 1,024 groups of one `sumFrame` each; `gain + peak` fused. 3,075 dispatches, 1 submission. No group carries `gpuTime` |
| `scatter`                 | WebGPU | `additive`; `sumScatter`, with no workgroup shapes; `gain + peak` fused. 3 dispatches, 3 submissions                             |
| `resident`, `host`, `f64` | WebGPU | as `gather`, with `additiveHost` or `additive64` in place of `additive`: 3 dispatches, 1 submission                              |
| `resident`, `host`, `f64` | WebGL2 | as `gather`: the shape V kernel and `peak` with no draw, `mixdown` and `gain` a draw each: 2 draws, 0 submissions                |
| every one                 | CPU    | one group per call, none fused, no `why`: 0 dispatches, 0 submissions                                                            |

- In the `tree` plan, `sumFrame` stores its sum after its loop, so F1 keeps each call in a group
  of its own: "additive and sumFrame run as two dispatches because sumFrame stores into an array
  after its loops", then the same words for each `sumFrame` after the first, and for `gain` after
  the last. Each such group is a loop dispatch over the 10,000 lanes in 40 workgroups of 256, a
  fold of its 40 partials and the entry that stores: three dispatches.
- In the `scatter` plan, `sumScatter` runs on the CPU tier: "sumScatter runs on the CPU, a loop of
  it runs on the CPU (TS8070)"; and `gain` after it: "gain runs apart from sumScatter, which runs
  on the CPU". The CPU tier reads the lanes back from the device, 40,960,000 bytes, to run it.

## Which tier each group ran on, and how the record knows

A fuse report names the best tier any call of its plan ran on, and a group of it carries no tier
(issue typeshade/typeshade#946; proposal 0118, accepted in the compiler's pull request #959, gives
each group a tier; ask P of `docs/compiler-asks.md`). The record reads each group's tier from three
facts, each of this run:

1. **The kernel alone.** Each kernel ran alone in a scope of its own, on a device of the same tiers
   (`tierProbe`). A plan of one call reports that call's tier. The tiers it reported:

   | Kernel         | On the WebGPU device | On the WebGL2 device | On the CPU device |
   | -------------- | -------------------- | -------------------- | ----------------- |
   | `additive`     | WebGPU               | the CPU tier         | the CPU tier      |
   | `additive64`   | WebGPU               | the CPU tier         | the CPU tier      |
   | `additiveHost` | WebGPU               | the CPU tier         | the CPU tier      |
   | `mixdown`      | WebGPU               | WebGL2               | the CPU tier      |
   | `sumFrame`     | WebGPU               | the CPU tier         | the CPU tier      |
   | `sumScatter`   | the CPU tier         | the CPU tier         | the CPU tier      |
   | `gain`         | WebGPU               | WebGL2               | the CPU tier      |
   | `peak`         | WebGPU               | the CPU tier         | the CPU tier      |

2. **The workgroup shapes.** `workgroupShapes` is present exactly when a group runs on WebGPU
   (surface §71). On the WebGPU device every group but `sumScatter`'s has them.
3. **The count.** On WebGL2 the plan counts draws: 2 for `gather`, `mixdown` and `gain`, which
   are the kernels the probe found on WebGL2.

The rule behind them (surface §65, "The tiers"): WebGL2 takes a loop that writes one array at
exactly `i` and does not reduce. `additive` writes at `v * block + n`, and `sumFrame` and `peak`
reduce, so on the WebGL2 device they run on the CPU tier.

So each group of the engine's plan ran on these tiers: on the WebGPU device, `additive` and the
fused `mixdown + gain + peak` on WebGPU; on the WebGL2 device, `additive` and `peak` on the CPU
tier and `mixdown` and `gain` on WebGL2; on the CPU device, all four on the CPU tier. In the other
plans on WebGPU, every group ran on WebGPU but the group of `sumScatter`, which ran on the CPU tier.

## What `explain` says

`explain(reports)` of `src/explain.ts` is the report in words (`docs/vision.md`, section 2, moment
5). Given the last block's report of each tier's `gather` run, it prints, unchanged:

WebGPU (R1-webgpu):

```
1 block on WebGPU, each block one fuse plan
the last block: 3 dispatches, 1 submission
  1. additive: 1 dispatch, 339.288 ms GPU
  2. mixdown + gain + peak: fused into one dispatch, 137.746 ms GPU
     additive and mixdown run as two dispatches because the trip counts differ (10000 and 1024)
all blocks: 3 dispatches, 1 submission, 477.034 ms GPU
```

WebGL2 (R1-webgl2):

```
1 block on WebGL2, each block one fuse plan
the last block: 2 draws, 0 submissions
  1. additive: on WebGL2 or the CPU tier
  2. mixdown: on WebGL2 or the CPU tier
     WebGL2 runs the calls apart
  3. gain: on WebGL2 or the CPU tier
     WebGL2 runs the calls apart
  4. peak: on WebGL2 or the CPU tier
all blocks: 2 draws, 0 submissions
```

The CPU tier (R1-cpu):

```
1 block on the CPU tier, each block one fuse plan
the last block: 0 dispatches, 0 submissions
  1. additive: on the CPU tier
  2. mixdown: on the CPU tier
  3. gain: on the CPU tier
  4. peak: on the CPU tier
all blocks: 0 dispatches, 0 submissions
The CPU tier runs the calls one after another and fuses none; it is the reference a fused group is held to.
```

What it says and what it cannot say, from these words and the reports (facts of this run):

- Each group's calls, whether it fused, the compiler's `why` in the author's names and its GPU
  time are in the report, and `explain` gives them.
- It cannot say on which tier a group ran on WebGL2: "on WebGL2 or the CPU tier" (ask P, proposal
  0118). On the WebGPU device, whose only other tier is the CPU, it says "not on WebGPU: on WebGL2
  or the CPU tier" for `sumScatter`, which the `why` says runs on the CPU.
- Its count per group is the number of `workgroupShapes` triples. A reduction's folds and the entry
  that stores after a loop add no triple (surface §71). The `gather` plan counts 3 dispatches, and
  its two groups say 1 and "one": the fold of `peak` is the third. In the `tree` plan each
  `sumFrame` group says "1 dispatch" and the plan counts 3,075 dispatches for 1,026 groups.
- It lists the 1,024 `sumFrame` groups of the `tree` plan one by one, each with its `why`: 2,054
  lines for one block (R3-webgpu).
- Nothing in the report says that `lanes` is a device buffer of 40,960,000 bytes made and destroyed
  in every plan, and that `mixed` is a local of the fused group. `docs/architecture.md`, section 3,
  sketches an `explain` that says "scratch a, b as locals".
- No line needed a parameter's range, unit or default (ask B). The words are the kernels' names and
  the compiler's sentences.

## Observations

These are facts of this run.

1. **The lane-own block write lowers at 10,000 lanes.** `tshc check` reports no TS8070 for
   `additive`, `additive64` or `additiveHost`, each of which writes `out[v * block + n]` over
   `n < block` after a method call on the lane. On WebGPU each ran as one dispatch at
   `[64, 1, 1]` in every timed block. On the WebGL2 device each ran on the CPU tier.
2. **The plan of a block.** On WebGPU the engine's plan was 3 dispatches in 1 submission, in
   2 groups, in each of the 1,000 timed blocks (R1-webgpu): `additive` alone; `mixdown`, `gain`
   and `peak` fused into one loop dispatch; and the fold of the meter's partials. On WebGL2 it was
   2 draws and 0 submissions in 4 groups, and on the CPU tier 0 and 0 in 4 groups.
3. **Where the reduction lands.** The meter `peak` ends the fused group (F6). The tree-order sum,
   one `sumFrame` per frame, made 1,024 groups of their own: 3,075 dispatches in 1 submission per
   block of 1,024 frames, and 1,539 per block of 512 (R3-webgpu, R3b-webgpu). The scatter ran on
   the CPU tier, in the only group with no workgroup shapes, in 3 submissions per block.
4. **The time per block**, the median and the 99th percentile of 1,000 timed blocks of the
   engine's plan: WebGPU 367.280 and 598.365 ms, of which the device measured a mean of 343.738 ms
   of GPU time (253.968 ms for `additive`, 89.770 ms for the fused group); WebGL2 1,780.025 and
   2,420.165 ms; the CPU tier 1,493.971 and 1,822.967 ms. A block lasts 21.33 ms at 48 kHz.
5. **The other sums cost more.** On WebGPU the median block of `tree` took 12,130.720 ms and of
   `scatter` 5,407.840 ms, over 5 timed blocks each (R3-webgpu). At 512 frames, where the plan of
   `tree` stays under the 2,048 passes that the device times, its block took 4,468.537 ms on
   average, of which 4,397.112 ms was GPU time: 8.402 ms for each `sumFrame` group. The engine's
   plan took 139.887 ms and 120.930 ms (R3b-webgpu). At 1,024 frames no group of `tree` carried
   `gpuTime`.
6. **The CPU tier and WebGL2 hold the reference's bits.** On each, all 1,034,240 samples of the
   1,010 blocks, all 110,000 values of the bank after the last block, and the meter's peak of every
   block have the plain-JavaScript reference's bits (R1-cpu, R1-webgl2).
7. **WebGPU does not.** Of the engine's 1,034,240 samples on WebGPU, 2 have the reference's bits.
   The largest difference is 1.960e-1, against a largest magnitude of 0.682 in the reference.
   Of the bank's 110,000 values, 40,012 have the reference's bits. The run's raw files
   (`experiments/04-additive/out/`, which the record does not hold) show which: all 10,000 phases,
   phase steps, envelope rises and envelope falls; the filters' coefficients and states differ.
   The `gather` and `resident` runs on WebGPU gave each other's bits, all 1,034,240 samples.
8. **The sums alone.** On fixed lanes, `mixdown`, the 1,024 `sumFrame` calls and `sumScatter` gave
   the bits of the plain-JavaScript sum of the same order, all 1,024 frames, on each of the three
   tiers (R1).
9. **The coefficients.** After the last block of R1 (sweep 0.6072), the `f32` design of the
   engine's `Lowpass` on WebGPU had `b0` off by up to 169 % of the design in doubles and the cutoff
   off by up to 63.9 %, at a cutoff of 24.30 Hz; 52 of the 10,000 `b0` were within 2^-20. On the CPU
   tier and on WebGL2, where the CPU tier designs, `b0` was off by up to 0.577 % and the cutoff by
   up to 0.289 %, at 24.39 Hz; 4,414 `b0` were within 2^-20. With the design in doubles on the host
   (`host`) and with the design in the emulated `f64` on the device (`f64`), WebGPU held the
   reference's `f64` design: `b0` within 2.71e-7, the `f32` rounding, and the cutoff within
   1.95e-7, all 10,000 `b0` within 2^-20 (R2-webgpu). With those coefficients, the largest
   difference of WebGPU's samples from the reference fell to 4.858e-5, against 1.960e-1 with the
   `f32` design; 202 (`host`) and 226 (`f64`) of the 1,034,240 samples had the reference's bits.
   In the raw files, the bank of `host` holds the reference's bits in every phase, phase step,
   envelope and coefficient, and in the bank of `f64` one partial's `b0`, `b1`, `b2` and `a1`
   differ. In both, the filters' states have the reference's bits in 3 partials (`z1`) and in 1
   (`z2`) of 10,000.
   The `f64` design cost the kernel 17.4 ms of GPU time a block more than the host's coefficients
   (163.055 ms against 145.610 ms for the shape V group, means of 1,000 blocks run one after the
   other at a load average under 5.2).
10. **The lanes in a `Resident`.** On WebGPU the median block of `resident` took 406.245 ms, and
    its mean GPU time was 397.807 ms, against 367.280 ms and 343.738 ms for `gather` (R1-webgpu).
    The two ran one after the other in one page, `gather` first. The GPU time, which no buffer the
    host makes enters, was 54 ms higher in `resident` too. The load average over 1 minute was 3.60
    before the WebGPU part and 7.02 after it.
11. **The tier of each kernel.** Alone in a scope, every kernel ran on WebGPU on the WebGPU device
    but `sumScatter`, which ran on the CPU tier; on the WebGL2 device only `mixdown` and `gain` ran
    on WebGL2 (section "Which tier each group ran on").
12. **The host views.** `tsc` refuses a bank of `Partial64` or of `HostPartial` at its kernel's
    call (TS2769): "Property 'b0' is protected in type 'Lowpass64' but public in type '{ b0: number;
    ...'". The view spells the kernel's `array<Partial64>` with the struct's fields, all public,
    and the class `Partial64` with its filter, a class of the same file whose coefficients are
    `protected`. The harness casts at the two calls.
13. **The CPU tier's code.** A block of the CPU tier took 1.49 s. The reference's 1,010 blocks took
    616 s in the same process, 0.61 s a block (the reference is not timed per block). The sums
    alone on the CPU tier, one block of each with the tier probe, took 4 minutes 31 seconds.
14. **The report's `why`.** The words of each group that stands apart, as the run gave them:
    "additive and mixdown run as two dispatches because the trip counts differ (10000 and 1024)";
    "additive and sumFrame run as two dispatches because sumFrame stores into an array after its
    loops", then "sumFrame and sumFrame …" and "sumFrame and gain …" in the same words; "sumScatter
    runs on the CPU, a loop of it runs on the CPU (TS8070)"; "gain runs apart from sumScatter,
    which runs on the CPU"; and on WebGL2 "WebGL2 runs the calls apart".
15. **The CPU tier's calls.** On the CPU tier one block of `tree`, 1,024 calls of `sumFrame` that
    each read 10,000 of the 10,240,000 lanes, took 316,073.214 ms, and one block of `scatter`, one
    call over the same lanes, 9,286.553 ms (R3-cpu, one timed block each). The CPU tier converts
    each array a call takes into a plain array, element by element, and writes each array it
    writes back the same way (`toCpu` and `fromCpu`, `src/core/host-entry.ts:564` of the pin, which
    `onCpu`, `src/core/host-kernel.ts:1888`, calls for each array parameter).

## Inferences

These are inferences, not results. Each names the observations it rests on.

- **Layer 2.** One block is one `fuse` scope at 10,000 lanes as it is at 64: on WebGPU the plan is
  the shape V kernel apart, and the gather, the chain and the meter fused, in one submission, the
  same in every block (observations 1 to 3). `docs/architecture.md`, sections 2 and 3, hold as
  written for this bank, the gather that heads the chain included. The bank keeps its state on the
  device across blocks with no read of the host: after 1,010 blocks, the phases and the envelopes
  on WebGPU, and the whole bank on the CPU tier and WebGL2, have the reference's bits
  (observations 6 and 7).
- **Ask A.** The lane-own block write needs no workaround at this pin, with a method call on the
  lane before the frame loop (observation 1).
- **Ask D.** The per-block coefficient math of the engine's lowpass needs more than `f32` on the
  device. SwiftShader's `cos` moved a low cutoff by 63.9 %, and even the CPU tier's correctly
  rounded `f32` loses 0.289 % to the cancellation in `1 - cos(w)` (observation 9). It does not need
  the functions ask D asks for: the design uses `sin` and `cos`, which the emulated `f64` has, and
  the emulated `f64` design on the device gave the host's coefficients, for about 17 ms of GPU time
  a block on SwiftShader (observation 9). Whether the engine's `Lowpass` designs in `f64`, or the
  host designs, is the owner's decision.
- **Ask I.** On this container the cost of many dispatches is mostly on the device's side: the
  1,539 dispatches of `tree` at 512 frames held 4,397.112 ms of GPU time of a mean block of
  4,468.537 ms, so the host and the gaps between passes took about 71 ms, about 0.05 ms per
  dispatch (observation 5). A transport keeps the engine's plan of 3 dispatches.
- **The sum.** For the same lanes the gather, in the order of the lanes, gives the same bits on
  every tier (observation 8). So the tree order of Rule 7.2 is not what makes the tiers agree, and
  the lanes are what differ (observation 7). The gather runs one invocation per frame, 1,024 per
  block in 4 workgroups of 256: few for a GPU with tens of compute units, and enough for
  SwiftShader's 4 cores. A sum that the GPU runs over every lane at once is the compiler's general
  part (candidate ask T).
- **The scratch lanes.** The run does not resolve what the per-block buffer of the scratch lanes
  costs: the GPU time, which that buffer does not enter, moved as much as the host time between
  `gather` and `resident` (observation 10). The load, not the buffer, explains the difference.
- **`explain`.** The fuse report is enough to say what each group is and why it stands apart. It is
  not enough to say where a group ran (proposal 0118), how many dispatches it made, or which arrays
  the plan made for it (candidate ask U). `explain` of a plan does not need the metadata of ask B
  (observation 14, section "What explain says").
- **The CPU tier.** A call on the CPU tier costs time in proportion to the length of each array it
  takes, not to the elements its loop reads: 0.31 s for each `sumFrame` call over the 10,240,000
  lanes (observation 15). That the conversion of the arrays is the cost is an inference from the
  source, not timed apart. It makes the plan of many calls over one long array, `tree`, the
  slowest on the CPU tier, and it is a part of the engine's block there (candidate ask V).
- **Real time.** None of the three tiers renders a block of 10,000 partials in the 21.33 ms the
  block lasts, on this container (observation 4). The device runs decide what a GPU does.

## Open questions

- What a GPU does with the same plan: the time per block, its `sin` and `cos` (the WGSL bound is
  2^-11 absolute, §38), and whether the gather's 1,024 invocations leave it idle. The device runs
  answer it, one record per device, `docs/records/04-additive-<device>.md`.
- Whether the per-block buffer of the scratch lanes costs more on a GPU's driver than on
  SwiftShader.
- Whether the remaining difference of the `host` and `f64` variants on WebGPU comes from `sin` or
  from the filter's arithmetic. The phases, the envelopes and the coefficients have the
  reference's bits; this run does not separate the two (ask C, the oscillator rows).
- Whether the conversion of a call's arrays is what a call costs on the CPU tier (observation 15):
  a profile of one `sumFrame` call would say.

## Deviations from the method

Each difference between the method of `docs/experiments.md`, section 4, and this run, with its
disposition.

1. **The kernel.** Step 1 names the `synth` kernel of `docs/vision.md`, section 8, over an
   `array<Voice>` (a `Phasor` into a `Serial<Ladder, OnePole>`). This run's kernel is `additive`
   over an `array<Partial>`: the engine's `Sine` (a phasor and a sine) through a `Lowpass` at the
   level of an `Envelope`, its cutoff moved every block. The question of section 4 names this
   partial, and the engine has no `Ladder`. The write is the one step 1 names, the lane's own
   block at `out[v * block + n]`. Disposition: closed; the record states the partial.
2. **The sum.** Step 3 sums the partials with "the reduction tree of Rule 7.2". The engine's plan,
   and the variant every tier ran over 1,000 blocks, sums with the shape G `mixdown`, in the order
   of the lanes (`docs/architecture.md`, section 2). The tree order ran as the `tree` variant, one
   reduction per frame, and as the `scatter` variant on the CPU tier. Disposition: open. Whether
   the engine's sum stays a gather or waits for a GPU form of the tree (candidate ask T of
   `docs/compiler-asks.md`) is the owner's decision.
3. **The blocks of the other variants.** Step 5 times 1,000 blocks. `resident` ran 1,000 blocks on
   WebGPU (R1-webgpu), and `host` and `f64` 1,000 blocks on WebGPU (R2-webgpu). The others ran
   fewer: `tree` and `scatter` 5 timed blocks on WebGPU (R3-webgpu) and 1 on the CPU tier
   (R3-cpu), and `host`, `f64` and `resident` 20 on the CPU tier and on WebGL2 (R4-cpu,
   R4-webgl2). `tree` and `scatter` were not timed on WebGL2, where both sums run on the CPU tier
   (the tier of each kernel) and the sums alone have the reference's bits (R1-webgl2). One block of
   `tree` takes 12.1 s on WebGPU here and 316 s on the CPU tier, so 1,000 blocks of it would take
   3.4 hours on WebGPU and 3.7 days on the CPU tier. Disposition: closed. Each variant planned the
   same groups in every timed block (its smallest and largest dispatch counts are equal).
4. **More than the method.** The run adds what the method does not name: the variants `host`,
   `f64` and `resident`, the check of the three sums on fixed lanes, the tier of each kernel alone,
   and the coefficients held to the design in doubles. Each answers a question that section 4
   says the experiment decides (ask D, the tier of each group of step 4, the shape of layer 2).
   Disposition: open. The owner may amend the method of section 4 to name them.
5. **The tiers of a device.** The run opens WebGPU and WebGL2 with the CPU tier after them, so a
   call the GPU tier cannot run falls to the CPU tier, as on a device the engine opens.
   Experiment 1 opened WebGPU alone. `sumScatter` has no GPU form, and with WebGPU alone the
   `scatter` variant cannot run ("sumScatter(): no tier it may use can run it (webgpu: it runs on
   the CPU, a loop of it runs on the CPU (TS8070))."). Disposition: closed; the method section
   states it.
6. **Two commits.** R1-cpu ran at `14240ea`. The other runs ran at `73c6888`, which adds the
   `resident` variant and the runner's reuse of the reference (`9b4af0e`) and merges main with
   experiments 2 and 3 (pull requests #8 and #9). The code of the `gather` variant is the same in
   both, and so are the shared scripts as the runs call them: `inPage` gained an optional list of
   flags, empty here, and `bundle` a worklet target. Disposition: closed.

## What this run does not measure

- The owner's devices, on WebGPU and on WebGL2.
- A machine with no other load: the container is shared (section "The run").
- A real GPU's queue, its fences and its `timestamp-query`: SwiftShader runs the GPU's work on the
  host's CPU.
- The `tree` and `scatter` variants over 1,000 blocks (deviation 3).
- The transport: a ring of blocks and an AudioWorklet (`docs/architecture.md`, section 8).
- The editor's hover of the units (ask B's other half).
