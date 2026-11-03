# Record 05: a 10-second partitioned convolution, on the container

> **Reference numbers, not a device result.** The device of this run is the container of an
> agent session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures, how SwiftShader answers, and what the compiler at
> the pin runs and refuses. They do not stand for a GPU's time per block, its memory bandwidth or
> its subnormal handling. The device runs of experiment 5 are pending (`docs/experiments.md`,
> section 5).

## The run

| Item         | Value |
| ------------ | ----- |
| Experiment   | 5, a 10-second partitioned convolution (`docs/experiments.md`, section 5) |
| Command      | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:05 --out docs/records/05-convolution-container.json` |
| Options      | The defaults of `experiments/05-convolution/run.ts`: every arm; noise blocks `webgpu=1000,webgl2=10,oracle=3`; tails `webgpu=full+jump,webgl2=jump,oracle=jump`; the impulses `full` and `quiet`; 60 seconds a block and 900 seconds for the transform of the partitions on a page arm; the partitions' spectra compared |
| Date         | 2026-11-02, from 19:39:14 UTC, 32 minutes 9 seconds: the CPU tier 13 s, WebGPU 2 minutes 26 seconds, WebGL2 12 minutes 2 seconds, the oracle 17 minutes 15 seconds |
| Commit       | `7e74c2bef69ca9bdb7140ec5aaa44a93673db015` of `typeshade/typeaudio`, branch `claude/exp-05-convolution` (pull request #14), with a clean tree |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null) |
| Tools        | Bun 1.4.4, Node v22.23.4, Vite 7.3.7, playwright-core 1.64.1 |
| Raw data     | `docs/records/05-convolution-container.json`: the options and sizes, the impulse response's levels, each arm's time per block (every block's host and GPU time), the fuse reports, the device's statistics, the transform of the partitions, the noise run and the tails against their references and between the arms, the kernel check, the refusals, the determinism rows, each device's `DeviceInfo` and the load average around each arm |
| Outputs      | The run writes the bits of the noise runs' and the tails' outputs to `experiments/05-convolution/out/raw.json`, which Git ignores |

## The devices

| Item     | CPU tier (the host face)                                                                       | Oracle                     | WebGPU                                                                                                                                                                                                                                                         | WebGL2                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same                   | the same                                                                                                                                                                                                                                                       | the same                                                                                     |
| Runtime  | Node v22.23.4                                                                                  | Bun 1.4.4 (JavaScriptCore) | Chrome Headless Shell 153.0.8010.12, cross-origin isolated                                                                                                                                                                                                     | the same                                                                                     |
| Graphics | none                                                                                           | none                       | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits` and `timestamp-query`; `maxComputeWorkgroupStorageSize` 16,384 bytes. The bare device: `core-features-and-limits` only                          | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The container is shared with other agent sessions, and the run did not reserve it. While it ran,
other sessions ran the compiler's test suites: at 19:42, 19:51 and 20:05 UTC `ps` showed their
Vitest and Prettier processes among the busiest. The load average over 1, 5 and 15 minutes, on 4
cores:

| When                     | Before         | After          |
| ------------------------ | -------------- | -------------- |
| The CPU tier (Node)      | 10.05, 9.33, 9.41  | 9.80, 9.29, 9.39   |
| WebGPU                   | 9.74, 9.29, 9.39   | 16.42, 11.77, 10.27 |
| WebGL2                   | 16.42, 11.77, 10.27 | 15.76, 15.04, 13.05 |
| The oracle               | 15.76, 15.04, 13.05 | 12.07, 13.87, 14.22 |

The load bears on the times. The bits do not depend on it.

## The method

**The convolution.** A uniform partitioned convolution by overlap-add. The impulse response, 480,000
frames, is cut into 469 partitions of 1,024 frames. The last partition holds 768 frames and zeros.
Each partition, zero-padded to 2,048 points, is transformed once (method step 1). Each block of
1,024 input frames is then six calls, in this order (method step 2):

| Call             | Kind                                     | What it does                                                                                               |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pad`            | kernel function, a loop over 1,024 lanes | writes the block as the real parts of the first 1,024 of 2,048 points; the second half stays zero           |
| `fftMediumTable` | `@compute` entry, one workgroup          | the forward transform of the 2,048 points                                                                  |
| `store`          | kernel function, a loop over 2,048 lanes | writes the spectrum into its slot of the frequency-domain delay line, a ring of 469 spectra                |
| `accumulate`     | kernel function, a loop over 2,048 lanes | bin `j`: the sum over the 469 partitions `p` of the delay line's spectrum `p` blocks old times partition `p`'s spectrum |
| `fftMediumTable` | `@compute` entry, one workgroup          | the inverse transform, scaled by 1 / 2,048                                                                 |
| `overlapAdd`     | kernel function, a loop over 1,024 lanes | the output: the first half of the inverse transform plus the second half that the block before left        |

The kernel functions are `experiments/05-convolution/convolution.shade.ts`. Two of them are written
around the compiler at the pin (section "Refusals, and calls that did not return"): `store` writes
at `j * 1 + slot * POINTS`, and `pad` loops over the 1,024 frames and not over the 2,048 points.

**The transform.** `fftMediumTable` is added to `experiments/03-fft/fft.shade.ts` in the workgroup
form of the 1,024-point entries. Its 2,048 `vec2`s in workgroup memory are 16 KiB: exactly WebGPU's
default `maxComputeWorkgroupStorageSize` and the SwiftShader adapter's limit. 256 invocations run
four butterflies each in each of 11 stages, between `workgroupBarrier()` calls. The twiddles come
from the host's table (variant B of record 03), whose bits the three tiers share there. The six
entries of experiment 3 are unchanged.

**The engine on a device.** Every array is a `Resident` of one device, made by
`createDevice({ prefer, poolBytes: 0 })`: a released array is freed at once, so the device's
statistics count what the engine holds. Each block is one `dev.fuse` plan of the six calls. The
host writes the input block before the plan, and reads the output block after it. The host time
of a block runs from the write to the end of the read. Where `fuse` refuses a block, the harness
runs the six calls apart and records the refusal; no arm needed it in this run.

**The impulse response** (`signals.ts`, `impulseResponse`), 480,000 frames, rounded to `f32`:

- the diffuse tail, `0.5 · 10^(-3n / 480,000) · (2u - 1)`, with `u` from `generator(0x5eed0005)` of
  `typeshade/random`: noise that decays by 60 dB over the 10 seconds;
- the direct sound and six early reflections, added at frames 0, 337, 613, 1,031, 1,523, 2,267 and
  3,001 (0 to 63 ms) with gains 1, 0.71, -0.55, 0.43, -0.34, 0.27 and -0.21.

Its largest magnitude is 1.258, at frame 0. Over the last second its RMS is 4.24e-4 and its largest
magnitude 9.94e-4.

**The inputs.**

| Input   | What it is                                                                                              | Used for                         |
| ------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `noise` | `2u - 1`, `u` from `generator(0x5eed0006)`, block after block from the first                             | the time per block (step 3)      |
| `full`  | 1 at frame 1 of block 0, 0 elsewhere. Its transform is the twiddles, not ones, so each product of the multiply-accumulate rounds | the tail (step 4)                |
| `quiet` | 2^-112 at frame 1 of block 0. The last second of its response lies across the smallest normal, 2^-126    | the tail's subnormals (step 4)   |

The response to an impulse at frame 1 is the impulse response, delayed by one frame and scaled by
the impulse. It ends at frame 480,000, in block 468. **The last second** is frames 432,001 to
480,000, in blocks 421 to 468. The 255 frames of block 468 after it are compared apart ("after the
response").

**The jump.** A full run of an impulse's tail runs the 469 blocks 0 to 468. A jump runs block 0,
then blocks 420 to 468, 50 blocks. The blocks it skips hold no input. Each would write the
transform of zeros into a slot of the delay line that holds +0 already. That transform is +0 in
every bit: each butterfly adds to or subtracts from +0 a product that is +0 or -0, which gives +0
when the tier rounds to nearest, whether or not it flushes subnormals. The skipped outputs are not
compared. So the delay line at block 420 is the full run's. Block 420 rebuilds the overlap-add's
tail that block 419 would have left, and its own output is not compared. WebGPU runs both, and the
comparison holds the jump to the full run bit for bit.

**The references.**

- The impulse's response: the impulse response times the impulse, in doubles. The impulse response
  is in `f32`s and the impulse is a power of 2, so each value is exact.
- The noise run: the convolution of the noise with the impulse response in doubles, by the `f64`
  transform of record 03 (`fft64`) at 2,097,152 points, which holds the whole linear convolution.
- The partitions' spectra: `fft64` of each padded partition.

**The measures.** The error in `f32` ULPs at the peak of the compared span: of each transform for
the spectra, of the whole output for the noise run, of the last second for a tail (record 03,
section "The method", says why). The relative RMS error. The most `f32`s between a value and the
reference rounded to `f32` ("max ULP"). The values that are the reference rounded to the nearest
`f32` ("exact"). Between two arms: the values whose bits differ, the most `f32`s between two values
of the same frame, the largest difference in ULPs at the peak, and the relative RMS of the
difference. Subnormals: the nonzero values below 2^-126, the zeros, and the values the oracle holds
as subnormals and an arm holds as 0 ("flushed").

**The arms.**

| Arm      | What runs                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu`    | The host face's CPU tier in Node: the harness bundled with Vite and the compiler's plugin. At the pin it refuses the FFT entry, so it runs the kernel check alone: each kernel function once on seeded inputs (`signals.ts`, `checkInputs`), the FFT entry, and one block as a fuse plan on a CPU device.                                                    |
| `oracle` | The compiler's oracle in Bun (`experiments/05-convolution/oracle.ts`, which follows experiment 3's `oracleOf` for two modules): the FFT entry by `compileModuleJs(compile(source).module, { precision: 'f32' }).dispatch`, in the passes the WebGL2 tier runs (surface §25); the kernel functions as written, through the same module's `fns`. It runs the kernel check's calls on the same inputs, for the bit-for-bit comparison. |
| `webgpu` | The harness bundled for a page, in headless Chromium, on a device of `createDevice({ prefer: ['webgpu'] })`, which has `timestamp-query`. Then the transform and the noise run again on a device of the default adapter requested with no feature ("bare"): a plan on a device with the feature reads its timestamps back before it resolves (compiler issue #986). |
| `webgl2` | The same page in a fresh browser, on a device of `createDevice({ prefer: ['webgl2', 'cpu'] })`: a call that WebGL2 cannot run falls to the CPU tier, as in experiment 1. The kernel check runs on WebGL2 alone, so that it records why.                                                                                                                       |

## The numbers

### Time per block

Host time from the write of the input block to the end of the read of the output block, in
milliseconds. GPU time: the sum of `gpuTime` over the plan's groups, on the device with
`timestamp-query`. The first block of a run builds the pipelines of the four kernel functions; it is
in the statistics and also apart. The 95th percentile is by nearest rank, so for 10 and 3 blocks it
is the largest.

| Arm    | Device                               | Blocks | Host median | Host p95 | Host min | Host max | First block | GPU median | GPU p95 | Dispatches, submissions |
| ------ | ------------------------------------ | -----: | ----------: | -------: | -------: | -------: | ----------: | ---------: | ------: | ----------------------- |
| WebGPU | with `timestamp-query`               |  1,000 |       36.32 |    84.87 |    19.99 |   257.84 |      171.55 |      31.02 |   75.37 | 6, 1                    |
| WebGPU | bare: no feature requested           |  1,000 |       36.41 |    81.80 |    21.27 |   311.12 |      140.18 |        n/a |     n/a | 6, 1                    |
| WebGL2 | the kernel functions on the CPU tier |     10 |    5,580.98 | 7,261.18 | 4,718.24 | 7,261.18 |    7,261.18 |        n/a |     n/a | 146 draws, 0            |
| Oracle | `dispatch` and `fns` in Bun          |      3 |    4,238.43 | 4,747.85 | 3,879.30 | 4,747.85 |    4,747.85 |        n/a |     n/a | n/a                     |

The budget of a block of 1,024 frames at 48 kHz is 21.33 ms. The blocks of the impulses' tails take
about as long: on WebGPU 36.69 and 38.34 ms at the median over the 469 blocks of a full run, on
WebGL2 5.49 and 5.01 seconds, on the oracle 3.76 and 3.96 seconds.

Where the GPU time goes, on the device with `timestamp-query`, over the 1,000 blocks:

| Group | Call             | GPU median (ms) | GPU p95 (ms) | Share of the summed medians |
| ----: | ---------------- | --------------: | -----------: | --------------------------: |
|     1 | `pad`            |           0.167 |        0.469 |                       0.6 % |
|     2 | `fftMediumTable` |           4.048 |       13.852 |                      14.5 % |
|     3 | `store`          |           0.122 |        0.258 |                       0.4 % |
|     4 | `accumulate`     |          18.762 |       42.637 |                      67.3 % |
|     5 | `fftMediumTable` |           4.670 |       20.002 |                      16.8 % |
|     6 | `overlapAdd`     |           0.109 |        0.222 |                       0.4 % |

The medians of the groups sum to 27.88 ms; the median of the blocks' sums is 31.02 ms.

The fuse report of the last noise block on WebGPU: `tier` `webgpu`, 6 dispatches, 1 submission, no
group fused.

| Group | Calls            | Workgroup shapes | `why`                                                                                                                    |
| ----: | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
|     1 | `pad`            | `[64, 1, 1]`     | none                                                                                                                     |
|     2 | `fftMediumTable` | `[256, 1, 1]`    | `pad and fftMediumTable run as two dispatches because fftMediumTable is an entry call, which forms a group of its own`    |
|     3 | `store`          | `[64, 1, 1]`     | `fftMediumTable and store run as two dispatches because fftMediumTable is an entry call, which forms a group of its own`  |
|     4 | `accumulate`     | `[64, 1, 1]`     | ``store and accumulate run as two dispatches because accumulate reads `line[slot * POINTS + j]` (line 79)``             |
|     5 | `fftMediumTable` | `[256, 1, 1]`    | `accumulate and fftMediumTable run as two dispatches because fftMediumTable is an entry call, which forms a group of its own` |
|     6 | `overlapAdd`     | `[64, 1, 1]`     | `fftMediumTable and overlapAdd run as two dispatches because fftMediumTable is an entry call, which forms a group of its own` |

The bare device's report is the same, with no `gpuTime`. On WebGL2 the report lists the same six
groups, `tier` `webgl2`, 146 dispatches, which are draws there, and 0 submissions. Groups 1 and 4
carry no `why` there, and no group says that it ran on the CPU tier.

### Memory

| What the engine holds on the device                                         |          Bytes |       MiB |
| --------------------------------------------------------------------------- | -------------: | --------: |
| The partitions' spectra, 469 × 2,048 complex `f32`s                         |      7,684,096 |      7.33 |
| The frequency-domain delay line, 469 × 2,048 complex `f32`s                 |      7,684,096 |      7.33 |
| Four spectra of scratch: `padded`, `spectrum`, `sum` and `frames`            |         65,536 |      0.06 |
| The twiddle table, 1,024 complex `f32`s                                     |          8,192 |      0.01 |
| Three blocks: the input, the output and the overlap-add's tail              |         12,288 |      0.01 |
| **The sum, computed from the sizes**                                        | **15,454,208** | **14.74** |
| `dev.statistics.liveBytes`, after the engine was made and at the end, on WebGPU and on WebGL2 | 15,454,208 | 14.74 |

The runtime counts 10 live arrays and 0 pooled bytes on each device, and 11 allocations: the
padded partitions, 7,684,096 bytes more, live only while the partitions are transformed, and the
pool of 0 bytes frees them after.

### The transform of the partitions

The 469 padded partitions in one call of 469 workgroups. Host time from the call to the end of the
device's `wait()`. Against `fft64`: the largest and the mean error in `f32` ULPs at each transform's
peak, the relative RMS error over the 469, and the values that are the `f64` transform rounded to
`f32`.

| Arm    | Host time (s) | Error (ULP at peak) | Relative RMS | Exact                |
| ------ | ------------: | ------------------- | ------------ | -------------------- |
| WebGPU |          3.21 | 3.09 / 0.320        | 1.21e-7      | 399,903 of 1,921,024 |
| WebGL2 |        119.00 | 3.09 / 0.320        | 1.21e-7      | 399,903 of 1,921,024 |
| Oracle |        622.31 | 3.09 / 0.320        | 1.21e-7      | 399,903 of 1,921,024 |

Between each pair of the three arms, 0 of the 1,921,024 values differ in any bit. The bare WebGPU
device transforms the partitions in 5.38 s; its spectra are not read.

### The noise run

Each arm's output against the `f64` convolution, over the blocks it ran: the largest and the mean
error in `f32` ULPs at the output's peak, the relative RMS error, the most `f32`s between a value and
the rounded reference ("max ULP"), and the values that are the reference rounded to `f32`. The max
ULP is that of a value near 0, where the ULP of each value shrinks without bound and the error of a
transform does not (record 03, section "The method").

| Arm           | Blocks | Error (ULP at peak) | Relative RMS | Max ULP   | Exact                 |
| ------------- | -----: | ------------------- | ------------ | --------: | --------------------- |
| WebGPU        |  1,000 | 5.49 / 0.802        | 5.07e-7      | 4,081,652 | 58,759 of 1,024,000   |
| WebGPU (bare) |  1,000 | 5.49 / 0.802        | 5.07e-7      | 4,081,652 | 58,759 of 1,024,000   |
| WebGL2        |     10 | 1.62 / 0.269        | 2.15e-7      | 13,817    | 1,185 of 10,240       |
| Oracle        |      3 | 1.78 / 0.299        | 2.09e-7      | 13,817    | 346 of 3,072          |

Between every pair of arms, over the blocks both ran (1,000, 10 or 3), 0 values differ in any bit.
No output holds a subnormal or a 0.

### The tail

The reference's last second, rounded to `f32`:

| Impulse | Subnormal values | Zeros | Peak    | Smallest magnitude |
| ------- | ---------------: | ----: | ------: | -----------------: |
| `full`  |                0 |     0 | 9.94e-4 |            7.70e-9 |
| `quiet` |            4,216 |     0 | 1.92e-37 |          1.48e-42 |

Each run's last second against the reference, and its subnormals. "Flushed": the values the oracle
holds as subnormals and the run holds as 0. "After the response": the 255 frames of block 468 after
frame 480,000, whose reference is 0: their subnormals, their zeros and their largest magnitude.

| Impulse | Run          | Error (ULP at peak)     | Relative RMS | Max ULP   | Exact  | Subnormal | Zero  | Flushed | After the response |
| ------- | ------------ | ----------------------- | ------------ | --------: | -----: | --------: | ----: | ------: | ------------------ |
| `full`  | oracle, jump | 3.25 / 0.489            | 1.76e-7      | 65,092    | 7,845  | 0         | 0     |         | 0, 1, 1.15e-10     |
| `full`  | WebGPU, full | 3.25 / 0.489            | 1.76e-7      | 65,092    | 7,845  | 0         | 0     | 0       | 0, 1, 1.15e-10     |
| `full`  | WebGPU, jump | 3.25 / 0.489            | 1.76e-7      | 65,092    | 7,845  | 0         | 0     | 0       | 0, 1, 1.15e-10     |
| `full`  | WebGL2, jump | 3.25 / 0.489            | 1.76e-7      | 65,092    | 7,845  | 0         | 0     | 0       | 0, 1, 1.15e-10     |
| `quiet` | oracle, jump | 3.25 / 0.489            | 1.76e-7      | 42        | 8,002  | 4,216     | 0     |         | 234, 21, 2.24e-44  |
| `quiet` | WebGPU, full | 526,148.25 / 24,486.945 | 2.46e-2      | 8,418,372 | 1      | 0         | 4,215 | 4,209   | 0, 255, 0          |
| `quiet` | WebGPU, jump | 526,148.25 / 24,486.945 | 2.46e-2      | 8,418,372 | 1      | 0         | 4,215 | 4,209   | 0, 255, 0          |
| `quiet` | WebGL2, jump | 525,017.56 / 23,572.712 | 2.46e-2      | 8,400,281 | 4      | 0         | 4,216 | 4,213   | 0, 255, 0          |

Each count of the last second is of 48,000 values. Between the runs, over the last second: the values
whose bits differ, the most `f32`s between two values of the same frame, the largest difference in
ULPs at the window's peak, the relative RMS of the difference, and the values that differ after the
response.

| Impulse | Runs                          | Differ           | Max ULP   | Largest (ULP at peak) | Relative RMS | After |
| ------- | ----------------------------- | ---------------- | --------: | --------------------: | ------------ | ----: |
| `full`  | every pair of the four runs   | 0 of 48,000      | 0         | 0                     | 0            | 0     |
| `quiet` | oracle and WebGPU, full       | 48,000 of 48,000 | 8,418,369 | 526,148.06            | 2.46e-2      | 237   |
| `quiet` | oracle and WebGPU, jump       | 48,000 of 48,000 | 8,418,369 | 526,148.06            | 2.46e-2      | 237   |
| `quiet` | oracle and WebGL2             | 47,997 of 48,000 | 8,400,282 | 525,017.62            | 2.46e-2      | 236   |
| `quiet` | WebGPU, full and jump         | 0 of 48,000      | 0         | 0                     | 0            | 0     |
| `quiet` | WebGPU and WebGL2             | 44,580 of 48,000 | 8,429,716 | 526,857.25            | 2.43e-3      | 72    |

### The kernel check

Each kernel function once on the seeded inputs of `checkInputs` (`signals.ts`), with the delay line
and the spectra at full size, 469 slots, against the oracle's `fns` on the same inputs: the values
whose bits differ, and the host time of the call with its read-back. `store` also counts the values
outside its slot that changed.

| Call                                    | CPU tier (Node)                            | WebGPU                                    | WebGL2 alone | Oracle's `fns` |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------- | ------------ | -------------: |
| `pad`                                   | 0 of 4,096 differ; 5.2 ms                  | 0 of 4,096 differ; 30.2 ms                | refused      |        0.04 ms |
| `store`                                 | 0 of 4,096 differ, 0 outside; 962.1 ms     | 0 of 4,096 differ, 0 outside; 66.3 ms     | refused      |        0.19 ms |
| `accumulate`                            | 0 of 4,096 differ; 3,663.8 ms              | 0 of 4,096 differ; 91.4 ms                | refused      |     2,101.5 ms |
| `overlapAdd`                            | 0 of 2,048 differ; 1.5 ms                  | 0 of 2,048 differ; 16.6 ms                | refused      |        0.12 ms |
| `fftMediumTable`                        | refused                                    | ran, 2,019.8 ms                           | ran, 432.4 ms |   (the spectra) |
| a block as a fuse plan, on a CPU device | refused                                    |                                           |              |                |

The `fftMediumTable` calls of the check are not held to the oracle: the transform of the partitions
holds the same entry to it on 469 workgroups.

## The determinism report

`compile().determinism` at the pin:

- `fft.shade.ts`: the five rows of record 03, for variants A and C: `cos` and `sin` of `f32` (2^-11
  absolute for x in [-π, π], `where` `onDevice`), and `*`, `cos` and `sin` of the emulated `f64`
  (`where` `inDouble`). The added `fftMediumTable` adds no row: it reads its twiddles from the
  table, and its butterflies' `+`, `-` and `*` on `f32` are each correctly rounded.
- `convolution.shade.ts`: no row. `accumulate` sums its partitions inside each lane, in order, so
  no loop reduces, and no `order` row applies.

No row names the flush of subnormals (ask E, compiler issue #968).

## Refusals, and calls that did not return

At run time:

- The host's CPU tier refuses the FFT entry, as a call and in a fuse plan on a CPU device, with one
  sentence:
  `TypeError: fftMediumTable() needs WebGPU: it reaches workgroupBarrier() at fft.shade.ts:226, and a barrier has no CPU tier.`
  So the CPU arm runs no block. Change 0092 gives the CPU tier this entry. Its `status` line reads
  `accepted` at the pin, and on the compiler's `main` at `3b7019da`, read on 2026-11-02. The CPU
  tier runs `pad`, `store`, `accumulate` and `overlapAdd`.
- On WebGL2 alone, the kernel check's four kernel functions are refused, each with its reason:
  - `Error: pad(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 writes "padded", whose element is not one f32, i32 or u32).`
  - `Error: store(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 writes "line" other than at i).`
  - `Error: accumulate(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 writes "sum", whose element is not one f32, i32 or u32).`
  - `Error: overlapAdd(): no tier it may use can run it (webgl2: it runs on the CPU, loop 1 writes more than one array, and WebGL2 draws one).`

  The WebGL2 arm's device has the CPU tier after WebGL2, so in its blocks these four calls run on
  the CPU tier and the FFT entry on WebGL2. The fuse report does not say which group ran where
  (`docs/compiler-asks.md`, P).
- No call of a page arm failed to return within its bound.

While the kernels were written, at the pin:

- `line[slot * POINTS + j] = spectrum[j]` in `store` is refused by the proof (TS8070):
  `This loop runs on the CPU because line 46 writes "line[slot * POINTS + j]", an element two iterations can share. Write at an index made from "j".`
  The same holds for `line[offset + j]` with `offset` a parameter. `line[j * 1 + slot * POINTS]`
  lowers, and is what `store` writes. This is compiler issue #983. Change 0095 accepts the base
  form and checks it at the call; its `status` line reads `accepted` at the pin and on the
  compiler's `main` at `3b7019da`.
- `pad` written as a loop over the 2,048 points that reads `input[j]` only under `if (j < FRAMES)`
  is refused by the call before it runs. On WebGPU, in a development run of this harness:
  `TypeError: pad(): parameter "input" holds 1024 elements, and loop 1 reads it at indices 0 to 2047.`
  The read never leaves the array, and `tshc check` reports no problem. The same form is refused on
  the CPU tier (candidate issue 1, now issue #997, in section "Inferences", has the reproduction).
  The call's check of the arrays a loop reads, added for compiler issue #655, does not see the
  guard. `pad` loops over the 1,024 frames instead.

## What departs from the method

Each item is a difference between the method of `docs/experiments.md`, section 5, and this run.

1. Step 1 transforms the partitions "with the FFT of experiment 3", which has no 2,048-point entry.
   A partition of 1,024 frames, zero-padded for a linear convolution, is 2,048 points. This run
   adds `fftMediumTable` to `experiments/03-fft/fft.shade.ts`: the workgroup form of the
   1,024-point entries, with the host's table. Disposition: open; the method's text is the owner's
   to amend.
2. Step 3 measures the time per block over 1,000 blocks. WebGPU runs 1,000 blocks, on two devices.
   WebGL2 runs 10 blocks, at 5.58 seconds a block at the median, and the oracle 3, at 4.24 seconds,
   so that the run stays near 40 minutes; it took 32 minutes. The question asks the time on WebGPU;
   the other arms' times are for information. Disposition: open.
3. Step 4 compares the last second of the tail. On WebGPU the tail runs every block, 469 a level, and
   also as a jump. The oracle and WebGL2 run only the jump, 50 blocks a level: block 0 and blocks
   420 to 468 (section "The method", "The jump"). On WebGPU the jump gives the full run's bits in
   every compared value. Disposition: open. The jump's exactness rests on the transform of zeros
   being +0 on every tier: WebGPU shows it, and the oracle and WebGL2 do not run the full chain.
4. Step 4 says "the three tiers". At the pin the host's CPU tier refuses the FFT entry, which reaches
   a barrier (change 0092 is accepted, not implemented). The CPU answer is the compiler's oracle, as
   in experiment 3, and the host's CPU tier runs the four kernel functions in the kernel check.
   Disposition: open until the pin moves past change 0092's implementation.
5. On WebGL2 the four kernel functions have no WebGL2 loop at the pin (section "Refusals, and calls
   that did not return") and run on the CPU tier; the FFT entry runs on WebGL2. Disposition: open.
6. Step 4 counts the subnormals in the oracle's output. At full scale the tail holds none, so the
   run adds the quiet impulse, at 2^-112, whose last second lies across 2^-126. Disposition: open;
   an addition to the method, for the owner to keep or drop.

## Observations

These are facts of this run.

1. On WebGPU on SwiftShader a block of 1,024 frames takes 36.32 ms of host time at the median and
   84.87 ms at the 95th percentile, over 1,000 blocks, on the device with `timestamp-query`. On the
   bare device it takes 36.41 and 81.80 ms. The budget of a block at 48 kHz is 21.33 ms. The load
   average over one minute rose from 9.74 to 16.42 on 4 cores while WebGPU ran.
2. A block's plan is 6 dispatches in 1 submission on both WebGPU devices. Its GPU time is 31.02 ms at
   the median and 75.37 ms at the 95th percentile. At the median, `accumulate` takes 18.76 ms, the
   two transforms 4.05 and 4.67 ms, and `pad`, `store` and `overlapAdd` 0.40 ms together.
3. `fuse` joins none of the six calls. The two transforms are entry calls, each a group of its own
   (fact F8). `accumulate` stands apart from `store` because it reads `line[slot * POINTS + j]`,
   which is not at its loop's counter (fact F3).
4. The engine holds 15,454,208 bytes, 14.74 MiB, as computed from the sizes, and
   `dev.statistics.liveBytes` gives the same number on WebGPU and on WebGL2, after the engine was
   made and at the end.
5. The transform of the 469 partitions takes 3.21 s on WebGPU, 119.00 s on WebGL2 and 622.31 s on the
   oracle. The three arms give the same bits for all 1,921,024 values. The largest error is 3.09
   ULPs at a transform's peak, the mean 0.320, and the relative RMS error 1.21e-7; 399,903 values are
   the `f64` transform rounded to `f32`.
6. Over 1,000 blocks of noise, WebGPU's output is off the `f64` convolution by up to 5.49 ULPs at the
   output's peak, with a mean of 0.802 and a relative RMS error of 5.07e-7. The bare device gives
   the same bits. WebGL2's 10 blocks and the oracle's 3 give the bits of WebGPU's first blocks; over
   those blocks the error is 1.62 and 1.78 ULPs at the peak.
7. At full scale the last second of the tail is the same in every bit on the oracle, on WebGPU, in
   the full run and the jump, and on WebGL2. It is off the reference by up to 3.25 ULPs at the
   window's peak, with a relative RMS error of 1.76e-7. No run holds a subnormal there, and neither
   does the reference, whose smallest magnitude is 7.70e-9.
8. For the quiet impulse, at 2^-112, the reference's last second holds 4,216 subnormal values. The
   oracle holds 4,216 too, and its error, 3.25 ULPs at the window's peak and a relative RMS error of
   1.76e-7, is that of the full-scale run. WebGPU and WebGL2 hold no subnormal: WebGPU holds 4,215
   zeros, 4,209 of them where the oracle holds a subnormal, and WebGL2 4,216 zeros, 4,213 of them
   there. Their error is about 525,000 ULPs at the window's peak, with a relative RMS error of
   2.46e-2, and 1 (WebGPU) or 4 (WebGL2) of the 48,000 values are the reference rounded to `f32`.
9. For the quiet impulse the oracle and WebGPU differ in all 48,000 values, the oracle and WebGL2 in
   47,997, and WebGPU and WebGL2 in 44,580, with a relative RMS of the difference of 2.43e-3. In
   the 255 frames after the response the oracle holds 234 subnormals and 21 zeros, and both GPU arms
   255 zeros.
10. On WebGPU the jump gives the full run's bits in all 48,000 values of the last second and in the
    255 after it, at both levels.
11. On the kernel check's inputs, the four kernel functions give the oracle's bits on the CPU tier
    and on WebGPU, and `store` changes nothing outside its slot. On WebGL2 alone each of the four is
    refused. The host's CPU tier refuses the FFT entry, and a block as a fuse plan.
12. On the CPU tier in Node, `store` takes 962.1 ms and `accumulate` 3,663.8 ms on host arrays the
    size of the delay line. The oracle's `fns`, its arrays already in its own form, takes 0.19 ms and
    2,101.5 ms for the same calls. `pad` and `overlapAdd` take 5.2 and 1.5 ms on the CPU tier.
13. On WebGL2 a block takes 5.58 s of host time at the median, over 10 blocks, and the report counts
    146 draws and 0 submissions a block. The WebGL2 arm drew two of Chromium's console messages
    again and again: 254 times
    `performance warning: READ-usage buffer was written, then fenced, but written again before being read back.`
    and 2 times `GPU stall due to ReadPixels`.
14. On the oracle a block takes 3.88 to 4.75 s. Its transform of the partitions takes 1.33 s a
    workgroup, and a block holds two transforms of one workgroup each.

## Inferences

These are inferences, not results, and they rest on a CPU that emulates a GPU, shared with other
sessions. The owner's devices give the real numbers.

- **Reverb by impulse response at a real-time budget.** On SwiftShader on this shared container a
  block misses the budget: 36.3 ms of host time at the median against 21.33 ms, and 31.0 ms of GPU
  time, two thirds of it in the multiply-accumulate. SwiftShader runs on the CPU. The work of a
  block is small for a GPU: the multiply-accumulate is 960,512 complex products, about 7.7 million
  floating-point operations, and reads the spectra and the delay line, 15.4 MB; at 46.9 blocks a
  second that is about 0.36 GFLOP/s and 0.72 GB/s. A GPU that reads 100 GB/s reads a block's 15.4
  MB in about 0.15 ms. So on a device the time per block is likely set by the plan's six dispatches,
  its submission and the host's read of the output, which experiment 1 measures as the round trip,
  and not by the convolution. The numbers support keeping reverb by impulse response in the catalog
  at a real-time budget on WebGPU, pending the device runs. They do not support it on WebGL2 at the
  pin: there a block takes 5.6 seconds, since the transform runs as 146 draws and the kernel
  functions on the CPU tier.
- **The FFT (ask G).** The 2,048-point entry, with the host's table, gives the oracle's bits on
  WebGPU and WebGL2 for 469 transforms of real partitions. The convolution built on it gives the
  same bits on the three arms for the noise blocks they share and for the full-scale tail. The
  workgroup form ends at 2,048 points on a device with WebGPU's default 16 KiB: blocks of 2,048
  frames need the storage form of record 03. A real-input form would hold 1,025 bins of each
  spectrum and halve the memory and the reads.
  What `typeshade/fft` would carry is now: twiddles from a table, a storage form past workgroup
  memory, a real-input form, and the CPU tier of change 0092. The inference of record 03 stands:
  the entry lives in layer 1 here first, and the issue follows the device runs.
- **Subnormals (ask E).** A convolution reverb at audible levels does not reach the subnormals, so
  the anti-denormal workaround is not needed in it: its tail ends with the impulse response, about
  60 dB down, and an `f32` transform's error floor is about 2^-24 of a block's peak. For an input
  at 2^-112 the flush matters: SwiftShader gives 0 where the oracle gives a subnormal, and the
  flushes inside its transforms move the tail's normal values too. The tiers' disagreement is still
  not stated where a reader looks for it: the determinism report names no flush (compiler issue
  #968).
- **Where the flush happens.** At full scale WebGPU and WebGL2 give the same bits; for the quiet
  impulse they differ in 44,580 of 48,000 values. On WebGL2 the four kernel functions run on the
  CPU tier, which keeps subnormals, and only the transforms run on SwiftShader, which flushes them;
  on WebGPU every call runs on SwiftShader. So the quiet tail follows where each call ran. A tail
  near 2^-126 then depends not only on the device but on which calls fell to the CPU tier, which
  the fuse report does not say (ask P).
- **Where a block's time goes (asks H and I).** The fuse report says it per group on a device with
  `timestamp-query`: 67 % in the multiply-accumulate and 31 % in the two transforms. The plan is
  6 dispatches in 1 submission; `fuse` joins none of the six calls, by facts F8 and F3, so the two
  transforms and the multiply-accumulate stand apart by design. On such a device a plan reads its
  timestamps back before it resolves (compiler issue #986). Here the two WebGPU devices' medians
  differ by 0.09 ms, inside the spread the load gives: a block that reads its output anyway shows no
  cost of that read at this load. Experiment 6 measured it on plans that read nothing else.

### Candidate asks and candidate compiler issues

These are inferences for the owner and the coordinating session, who letter the asks and file the
issues. Each suspected bug has a minimal reproduction, run at the pin on 2026-11-02.

**Candidate issue 1, now issue #997 of the compiler. The call's read check does not see a guard.** A
kernel loop that reads an array only under a branch that keeps the index inside it is refused before
it runs: on the CPU tier (this reproduction) and on WebGPU (the guarded `pad`, in a development
run). `tshc check` reports no problem.

```ts
"use typeshade";

export function padTo(out: array<f32>, xs: array<f32>) {
  for (let i: u32 = 0; i < 8; i++) {
    let v = 0.;
    if (i < 4) {
      v = xs[i];
    }
    out[i] = v;
  }
}
```

`await padTo(new Float32Array(8), Float32Array.from([1, 2, 3, 4]))` on the CPU tier (Vitest with
the compiler's plugin, Bun 1.4.4) rejects with
`TypeError: padTo(): parameter "xs" holds 4 elements, and loop 1 reads it at indices 0 to 7.`
The read check came with the fix of compiler issue #655 (`src/core/passes/kernel-lower.ts`, the
`read` checks from the proof's `reads`, at the pin). Expected: the call runs, or the check is
limited to the reads that no guard bounds. Not in the issues `docs/compiler-asks.md` cites.

**Candidate issue 2, now issue #998 of the compiler. A queued call runs on the output of a call that
failed.** A call that fails keeps its error on the `Resident`s it writes. A queued call that reads
one of them runs on what the array held before, and a read of its own output resolves.

```ts
const dev = await createDevice({ prefer: ['cpu'] });
const a = dev.array(Float32Array.from([9, 9, 9, 9, 9, 9, 9, 9]));
const b = dev.array(8, 'f32');
padTo(a, Float32Array.from([1, 2, 3, 4])); // refused (candidate issue 1): its promise rejects
twice(b, a); // `out[i] = 2. * xs[i]` over 8 lanes: it reads a
await b.read(); // resolves to eight 18s
await a.read(); // rejects with padTo's TypeError
```

Rule 11.8 says a read of a `Resident` a failed call writes throws its error; it says nothing of a
later call that reads it. An engine that queues a block's calls without awaiting each one gets a
silent wrong block. Observed in a development run of this harness on WebGPU, whose fallback to
plain calls returned blocks of zeros; reproduced as above on the CPU tier.

**Candidate ask A, now ask AA. WebGL2 loops for the convolution's kernels.** On WebGL2 a kernel loop
that writes an `array<vec2>`, writes at an index other than its counter, or writes two arrays has no
WebGL2 program (section "Refusals, and calls that did not return"). All four of the convolution's
kernels fall to the CPU tier there, and a block costs 5.6 seconds against a budget of 21.33 ms. The
general part: a WebGL2 draw that writes the two words of a `vec2` element, writes at `i + c`, or
writes several arrays as several render targets.

**Candidate ask B, now an item of ask G. A real-input transform in the FFT module (ask G).** A real
signal's spectrum is Hermitian: 1,025 of the 2,048 bins hold all of it. The spectra and the delay
line would hold 7.34 MiB instead of 14.66 MiB, and the multiply-accumulate would read about half as
much. This belongs to what `typeshade/fft` would carry, beside the twiddles from a table and a
storage form (record 03).

**Candidate ask C, now evidence of ask V. The CPU tier converts every element of an array argument
on every call.** On the CPU tier in Node, `store` writes 2,048 of the delay line's 960,512 points in
962.1 ms, and `pad` writes 1,024 points of a 2,048-point array in 5.2 ms. The oracle's `fns`, given
the values in its own form, takes 0.19 ms for the same `store`. The time follows the arrays' length,
not the work. This run measured host arrays only; a large `Resident` on the CPU tier (a delay line,
a bank) may cost the same on each call. Related to ask S (#961), which measures the allocation per
method call.

## What this run finds in the design documents

These are facts of this run against `docs/vision.md` and `docs/architecture.md`, which this record
does not change. Their amendment is the owner's decision.

- `docs/vision.md`, section 2, moment 5, sketches `explain` saying "reverb GPU, FFT entry, 2
  dispatches, latency 1024 frames". The convolution as written here is 6 dispatches a block, in 1
  submission: an entry call forms a group of its own (fact F8), and `accumulate` stands apart from
  `store`, since it reads the delay line at other slots than the one `store` writes (fact F3). The
  latency of 1,024 frames holds: a block's output holds the response to the same block.
- `docs/vision.md`, section 6, "Effects", says of a convolution reverb that "every partition's
  multiply-add is parallel". In this harness each lane is a bin, and each lane sums its 469
  partitions in order. A sum over the partitions in parallel would need a reduction per bin, which
  the kernel loop has no form for (compare compiler issue #991, a sum per frame over lanes).
- `docs/vision.md`, section 9, says that "filter and reverb tails reach subnormals". A convolution
  reverb's tail at full scale holds none: the reference's last second has an RMS of 4.24e-4, and its
  smallest magnitude is 7.70e-9, about 2^-27, where the smallest normal is 2^-126. Only an input at
  about 2^-112 puts it across 2^-126. A recursive filter's or reverb's state, which decays without
  end, is where the engine meets them.
- `docs/vision.md`, section 9, says that the CPU tier runs entries with barriers since change 0092.
  At the pin the host's CPU tier refuses the FFT entry, as record 03 found.
- `docs/architecture.md`, section 9, expects a render on WebGPU to be the CPU tier's bit for bit
  except the rows the determinism report lists. At full scale the tails agree bit for bit, and so
  do the 1,000 blocks of noise. The
  quiet tail differs where SwiftShader flushes subnormals, and no row lists the flush (ask E,
  compiler issue #968).

## What this run does not measure

- The owner's devices: a GPU's time per block, its memory bandwidth, its subnormal handling, and
  whether its driver fuses a multiply and an add. One record per device,
  `05-convolution-<device>.md`.
- A block in a real-time transport: each block here is awaited before the next is written, with no
  lookahead and no pipelining (`docs/architecture.md`, section 8; experiment 1).
- The host's CPU tier running the convolution: it refuses the FFT entry at the pin.
- More than one channel, an impulse response other than this synthetic one, or a block size other
  than 1,024 frames.
- A real-input transform, which would hold 1,025 bins of each spectrum instead of 2,048.
- A machine with no other load: the container is shared (section "The devices").
