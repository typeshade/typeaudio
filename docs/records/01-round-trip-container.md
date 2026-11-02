# Record 01: the round trip per block size, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures and how the engine plans a block. They do not
> stand for a GPU, and they decide nothing about the owner's devices. The device runs of
> experiment 1 are pending (`docs/experiments.md`, section 1).

## The run

| Item | Value |
| --- | --- |
| Experiment | 1, the round trip per block size (`docs/experiments.md`, section 1) |
| Command | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:01 --tier all --blocks 1000 --warmup 10 --out docs/records/01-round-trip-container.json` |
| Date | 2026-11-02, from 13:37 UTC, 5 minutes |
| Commit | `7ccdfab2024673ab6bcb3c792a94aa80954b7c43` of `typeshade/typeaudio`, branch `claude/first-code` (pull request #5), with a clean tree |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null) |
| Tools | Bun 1.4.4, Vite 7.3.7, playwright-core 1.64.1 |
| Raw data | `docs/records/01-round-trip-container.json`: every row, the options, each device's `DeviceInfo` and the engine's last fuse report on each tier |

## The devices

| Item | CPU tier | WebGPU | WebGL2 |
| --- | --- | --- | --- |
| Host | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same | the same |
| Runtime | Node v22.23.4 | Chrome Headless Shell 153.0.8010.12 | the same |
| Graphics | none | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `timestamp-query` | ANGLE on Vulkan 1.3.0, SwiftShader Device (Subzero) |
| Clock step of `performance.now()` | 0.00005 ms | 0.005 ms (the page is cross-origin isolated) | 0.005 ms |

The container is shared with other agent sessions, and the run did not reserve it. At 13:50 UTC,
eight minutes after the run, `uptime` gave a load average of 8.36, 8.72 and 7.77 over 1, 5 and 15
minutes, on 4 cores. Other processes very likely ran during the run, so the medians and, more, the
99th percentiles hold their load. The runner records the load average around each arm from the
commit after this run on (`load` in the JSON).

## The method

- The kernel is `experiments/01-round-trip/partials.shade.ts`: 64 sine partials summed into each
  frame of a block, one lane per frame (`docs/experiments.md`, section 1, step 1).
- For each block size N, the harness runs 10 blocks first. It times the first of them apart, as
  "first block". Then it times 1,000 blocks one by one with `performance.now()`, from the call to
  the host's read of the result. The median and the 99th percentile are by nearest rank.
- The harness times one block in four ways (`experiments/01-round-trip/harness.ts`):
  - `call`: the kernel called with a host `Float32Array`, which the call reads back into
    (step 2). It runs on the default owner, `configure({ prefer })`.
  - `resident`: the output a `Resident` of `dev.array(N, 'f32')`, the call queued, and the output
    read once per block (step 4).
  - `budget`: as `resident`, on a device of `createDevice({ timeBudgetMs: 20 })`, with the call run
    as one chunk, `dev.fuse(body, { chunk: { key, units: N } })` (step 5). The device fences and
    times each chunk. "Fenced chunk" is what it learned: `chunkRates[key].msPerUnit × N`.
  - `engine`: the engine's own block, `render(plan, { frames: N, block: N })` of a bank of 64
    voices (`Voice`: a `Saw` into a `Lowpass`). One block is one `fuse` plan, and the master is a
    `Resident` read once. "GPU time" is the mean, over the timed blocks, of the `gpuTime` of the
    plan's groups.
- On WebGL2 a call that WebGL2 cannot run falls to the CPU tier (`prefer: ['webgl2', 'cpu']`). In
  the engine's block, `synth` (its writes are at `v * block + n`) and `peak` (a reduction) run on
  the CPU tier there.

## The numbers

### The CPU tier, in Node

| Variant | Ran on | Frames | Block at 48 kHz (ms) | Median (ms) | p99 (ms) | First block (ms) | Min (ms) | Max (ms) | Fenced chunk (ms) | GPU time (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| call | cpu | 128 | 2.67 | 0.286 | 0.871 | 8.024 | 0.248 | 4.784 |  |  |
| call | cpu | 256 | 5.33 | 0.571 | 0.882 | 0.564 | 0.490 | 1.461 |  |  |
| call | cpu | 512 | 10.67 | 1.337 | 1.679 | 1.118 | 0.974 | 1.933 |  |  |
| call | cpu | 1024 | 21.33 | 2.535 | 3.462 | 2.790 | 1.941 | 6.267 |  |  |
| call | cpu | 2048 | 42.67 | 4.396 | 5.381 | 4.638 | 3.910 | 8.424 |  |  |
| call | cpu | 4096 | 85.33 | 8.946 | 12.132 | 8.882 | 7.796 | 23.114 |  |  |
| resident | cpu | 128 | 2.67 | 0.299 | 0.466 | 0.848 | 0.257 | 4.387 |  |  |
| resident | cpu | 256 | 5.33 | 0.570 | 0.828 | 0.618 | 0.486 | 2.359 |  |  |
| resident | cpu | 512 | 10.67 | 1.127 | 4.153 | 1.118 | 0.981 | 30.259 |  |  |
| resident | cpu | 1024 | 21.33 | 2.284 | 4.955 | 2.265 | 1.944 | 12.766 |  |  |
| resident | cpu | 2048 | 42.67 | 4.544 | 7.192 | 4.317 | 3.899 | 10.816 |  |  |
| resident | cpu | 4096 | 85.33 | 8.947 | 12.186 | 8.964 | 7.821 | 19.962 |  |  |
| budget | cpu | 128 | 2.67 | 0.321 | 0.814 | 26.227 | 0.266 | 8.518 | 0.313 |  |
| budget | cpu | 256 | 5.33 | 0.597 | 1.969 | 0.647 | 0.503 | 7.401 | 0.595 |  |
| budget | cpu | 512 | 10.67 | 1.140 | 1.695 | 1.204 | 0.989 | 5.939 | 1.165 |  |
| budget | cpu | 1024 | 21.33 | 2.215 | 3.341 | 2.383 | 1.952 | 6.402 | 2.075 |  |
| budget | cpu | 2048 | 42.67 | 4.613 | 8.217 | 4.403 | 3.920 | 16.754 | 4.866 |  |
| budget | cpu | 4096 | 85.33 | 9.109 | 12.162 | 9.711 | 7.782 | 40.787 | 9.142 |  |
| engine | cpu | 128 | 2.67 | 0.944 | 5.165 | 12.156 | 0.668 | 10.870 |  |  |
| engine | cpu | 256 | 5.33 | 1.667 | 6.355 | 1.639 | 1.226 | 16.287 |  |  |
| engine | cpu | 512 | 10.67 | 3.146 | 9.198 | 4.492 | 2.124 | 34.976 |  |  |
| engine | cpu | 1024 | 21.33 | 6.476 | 14.060 | 5.616 | 4.793 | 32.251 |  |  |
| engine | cpu | 2048 | 42.67 | 11.911 | 28.746 | 13.129 | 9.365 | 47.863 |  |  |
| engine | cpu | 4096 | 85.33 | 26.259 | 52.202 | 24.481 | 20.840 | 63.777 |  |  |

### WebGPU, on SwiftShader

| Variant | Ran on | Frames | Block at 48 kHz (ms) | Median (ms) | p99 (ms) | First block (ms) | Min (ms) | Max (ms) | Fenced chunk (ms) | GPU time (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| call | webgpu | 128 | 2.67 | 0.510 | 2.955 | 21.905 | 0.255 | 4.075 |  |  |
| call | webgpu | 256 | 5.33 | 0.415 | 2.865 | 1.025 | 0.255 | 4.390 |  |  |
| call | webgpu | 512 | 10.67 | 0.675 | 4.040 | 3.640 | 0.315 | 11.445 |  |  |
| call | webgpu | 1024 | 21.33 | 2.055 | 5.245 | 2.090 | 0.420 | 8.100 |  |  |
| call | webgpu | 2048 | 42.67 | 2.785 | 6.155 | 3.455 | 0.565 | 9.260 |  |  |
| call | webgpu | 4096 | 85.33 | 2.935 | 6.110 | 4.485 | 0.790 | 15.085 |  |  |
| resident | webgpu | 128 | 2.67 | 0.580 | 3.830 | 15.025 | 0.330 | 6.190 |  |  |
| resident | webgpu | 256 | 5.33 | 0.465 | 3.875 | 3.235 | 0.285 | 5.965 |  |  |
| resident | webgpu | 512 | 10.67 | 0.595 | 3.535 | 0.740 | 0.300 | 5.955 |  |  |
| resident | webgpu | 1024 | 21.33 | 0.640 | 4.145 | 3.385 | 0.340 | 7.525 |  |  |
| resident | webgpu | 2048 | 42.67 | 2.735 | 3.830 | 3.575 | 0.465 | 6.395 |  |  |
| resident | webgpu | 4096 | 85.33 | 2.950 | 7.865 | 1.430 | 0.700 | 37.205 |  |  |
| budget | webgpu | 128 | 2.67 | 1.385 | 6.305 | 43.775 | 0.585 | 15.045 | 0.904 |  |
| budget | webgpu | 256 | 5.33 | 1.255 | 5.680 | 1.770 | 0.550 | 7.635 | 1.032 |  |
| budget | webgpu | 512 | 10.67 | 1.480 | 6.425 | 3.115 | 0.695 | 18.340 | 0.909 |  |
| budget | webgpu | 1024 | 21.33 | 1.660 | 6.535 | 2.010 | 0.705 | 10.360 | 0.996 |  |
| budget | webgpu | 2048 | 42.67 | 3.650 | 7.865 | 4.340 | 0.895 | 21.610 | 1.363 |  |
| budget | webgpu | 4096 | 85.33 | 3.890 | 9.850 | 6.780 | 1.200 | 23.570 | 2.540 |  |
| engine | webgpu | 128 | 2.67 | 4.535 | 13.575 | 215.620 | 1.765 | 26.735 |  | 1.494 |
| engine | webgpu | 256 | 5.33 | 4.160 | 11.920 | 5.515 | 1.780 | 21.695 |  | 1.612 |
| engine | webgpu | 512 | 10.67 | 5.760 | 14.230 | 105.925 | 3.160 | 32.160 |  | 3.068 |
| engine | webgpu | 1024 | 21.33 | 7.795 | 17.755 | 11.110 | 4.355 | 23.325 |  | 4.976 |
| engine | webgpu | 2048 | 42.67 | 11.470 | 26.255 | 13.425 | 6.915 | 38.755 |  | 8.954 |
| engine | webgpu | 4096 | 85.33 | 20.010 | 39.285 | 27.245 | 12.795 | 55.585 |  | 17.577 |

### WebGL2, on SwiftShader

| Variant | Ran on | Frames | Block at 48 kHz (ms) | Median (ms) | p99 (ms) | First block (ms) | Min (ms) | Max (ms) | Fenced chunk (ms) | GPU time (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| call | webgl2 | 128 | 2.67 | 0.635 | 4.595 | 35.545 | 0.320 | 9.015 |  |  |
| call | webgl2 | 256 | 5.33 | 0.535 | 3.265 | 1.805 | 0.350 | 5.450 |  |  |
| call | webgl2 | 512 | 10.67 | 0.695 | 4.800 | 1.565 | 0.495 | 9.090 |  |  |
| call | webgl2 | 1024 | 21.33 | 0.995 | 6.180 | 1.465 | 0.635 | 10.690 |  |  |
| call | webgl2 | 2048 | 42.67 | 1.545 | 7.175 | 4.735 | 1.020 | 10.640 |  |  |
| call | webgl2 | 4096 | 85.33 | 1.520 | 7.045 | 2.580 | 1.050 | 11.465 |  |  |
| resident | webgl2 | 128 | 2.67 | 0.475 | 4.160 | 1.860 | 0.280 | 7.010 |  |  |
| resident | webgl2 | 256 | 5.33 | 0.580 | 4.120 | 2.830 | 0.400 | 9.320 |  |  |
| resident | webgl2 | 512 | 10.67 | 0.725 | 3.550 | 0.975 | 0.445 | 8.870 |  |  |
| resident | webgl2 | 1024 | 21.33 | 0.815 | 3.770 | 1.250 | 0.620 | 8.790 |  |  |
| resident | webgl2 | 2048 | 42.67 | 1.370 | 5.340 | 1.535 | 1.000 | 9.695 |  |  |
| resident | webgl2 | 4096 | 85.33 | 1.540 | 6.635 | 1.560 | 1.075 | 13.910 |  |  |
| budget | webgl2 | 128 | 2.67 | 0.550 | 5.025 | 63.485 | 0.355 | 11.430 | 0.442 |  |
| budget | webgl2 | 256 | 5.33 | 0.590 | 3.710 | 0.725 | 0.385 | 8.350 | 1.085 |  |
| budget | webgl2 | 512 | 10.67 | 0.775 | 3.990 | 3.115 | 0.515 | 11.285 | 0.820 |  |
| budget | webgl2 | 1024 | 21.33 | 0.990 | 5.350 | 1.600 | 0.730 | 12.500 | 2.883 |  |
| budget | webgl2 | 2048 | 42.67 | 1.450 | 5.885 | 7.415 | 1.085 | 10.355 | 1.880 |  |
| budget | webgl2 | 4096 | 85.33 | 1.475 | 5.560 | 2.385 | 1.095 | 10.835 | 1.410 |  |
| engine | webgl2 | 128 | 2.67 | 2.685 | 9.055 | 70.425 | 1.885 | 16.130 |  |  |
| engine | webgl2 | 256 | 5.33 | 3.875 | 11.585 | 7.265 | 2.515 | 16.650 |  |  |
| engine | webgl2 | 512 | 10.67 | 5.375 | 17.825 | 7.735 | 3.495 | 46.190 |  |  |
| engine | webgl2 | 1024 | 21.33 | 8.300 | 20.765 | 8.905 | 5.685 | 34.800 |  |  |
| engine | webgl2 | 2048 | 42.67 | 16.560 | 34.535 | 15.860 | 10.355 | 48.835 |  |  |
| engine | webgl2 | 4096 | 85.33 | 25.330 | 45.510 | 24.165 | 19.600 | 56.075 |  |  |

## How the engine planned a block

| Tier | Dispatches | Submissions | Groups, from the last block at 4,096 frames |
| --- | ---: | ---: | --- |
| WebGPU | 3 | 1 | `synth`, one dispatch at `[64, 1, 1]`; `mixdown + drive + gain + peak`, fused, one loop dispatch at `[256, 1, 1]` and one fold of the reduction's partials. The fused group's `why`: "synth and mixdown run as two dispatches because the trip counts differ (64 and 4096)". |
| WebGL2 | 3 draws | 0 | `synth` and `peak` on the CPU tier; `mixdown`, `drive` and `gain` one draw each, each with the `why` "WebGL2 runs the calls apart". |
| CPU tier | 0 | 0 | One group for each of the five calls, none fused. |

## Observations

These are facts of this run.

1. On the CPU tier the three ways to call the kernel cost about the same. At 1,024 frames the
   medians are 2.535 ms (`call`), 2.284 ms (`resident`) and 2.215 ms (`budget`). The median grows
   with N at about 2.2 microseconds per frame.
2. On WebGPU at 1,024 frames, the `Resident` output (0.640 ms median) costs a third of the call
   with a host array (2.055 ms). From 128 to 512 frames the two are within 0.1 ms of each other.
   From 2,048 frames up, both are 2.7 to 3.0 ms.
3. The chunk fenced on each block (`budget`) adds 0.79 to 1.02 ms to the median of `resident` on
   WebGPU, at every size. On WebGL2 and on the CPU tier it adds at most 0.18 ms.
4. On both SwiftShader tiers the 99th percentile of the kernel's block is 2.9 ms or more at every
   size. At 128 frames it is 3.0 to 6.3 ms, where the median is 0.5 to 1.4 ms.
5. The engine's block of 64 voices, against the duration of the block:
   - On the CPU tier the median is below the duration at every size, 0.944 ms of 2.67 ms at
     128 frames and 26.259 ms of 85.33 ms at 4,096. The 99th percentile is above the duration at
     128 and 256 frames, and below it from 512 frames.
   - On WebGPU the median is above the duration at 128 frames (4.535 ms of 2.67 ms) and below it
     from 256. The 99th percentile is above the duration up to 512 frames (14.230 ms of 10.67 ms)
     and below it from 1,024 (17.755 ms of 21.33 ms).
   - On WebGL2 the median is just above the duration at 128 frames (2.685 ms of 2.67 ms) and below
     it from 256. The 99th percentile is above the duration up to 512 frames and below it from 1,024
     (20.765 ms of 21.33 ms).
6. The device measured the GPU time of the engine's block on WebGPU: 1.494 ms at 128 frames to
   17.577 ms at 4,096, which is 33 % to 88 % of the host's median.
7. The first block of a size builds its pipelines: 215.6 ms for the engine on WebGPU, 70.4 ms on
   WebGL2 and 12.2 ms on the CPU tier.

## Inferences

These are inferences, not results.

- The run measures a four-core CPU that emulates a GPU. It does not decide the block size or the
  lookahead of decision D5 (`docs/architecture.md`, section 11): the owner's devices do.
- If a device behaves as this reference does, the 99th percentile decides the block size, not the
  median. Here a block of the engine meets its duration at the 99th percentile from 1,024 frames
  on both GPU tiers, which agrees with D5's 1,024 frames.
- A real-time transport keeps its output in a `Resident` and reads it once per block. It does not
  fence each block as a chunk: a fence costs about 1 ms per block on WebGPU here, so the time
  budget belongs to long offline renders (asks H and I of `docs/compiler-asks.md`).
- The CPU tier keeps up with 64 voices of the engine at every size by its median. That makes it a
  candidate for the latency-critical path, which experiment 2 measures inside an AudioWorklet.

## What this run does not measure

- The owner's devices, on WebGPU and on WebGL2: one record per device, `01-round-trip-<device>.md`.
- A machine with no other load: the container is shared (section "The devices").
- A real GPU's queue and its fences: SwiftShader runs the GPU's work on the host's CPU.
- The way to the audio thread: a ring of blocks and an AudioWorklet (`docs/architecture.md`,
  section 8, "Real time").
