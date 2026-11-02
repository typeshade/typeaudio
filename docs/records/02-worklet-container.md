# Record 02: the CPU tier inside an AudioWorklet, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: four cores of an Intel Xeon that other sessions share, and Chrome Headless
> Shell with no audio hardware. These numbers say what loads in the worklet scope, what the
> harness measures and how the ways of filling a render quantum compare. They do not stand for
> the owner's devices, and they decide nothing there. The device runs of experiment 2 are pending
> (`docs/experiments.md`, section 2).

## The run

| Item         | Value                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 2, the CPU tier inside an AudioWorklet (`docs/experiments.md`, section 2)                                                                                                                                                                   |
| Command      | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:02 --out docs/records/02-worklet-container.json`                                                          |
| Date         | 2026-11-02, from 14:48 UTC, 7 minutes                                                                                                                                                                                                       |
| Commit       | `a6da873a227bb988d3ba28e6ec159f54554e5026` of `typeshade/typeaudio`, branch `claude/exp-02-worklet` (pull request #8), with a clean tree                                                                                                    |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (package version 0.1.0)                                                                                            |
| Tools        | Bun 1.4.4, Vite 7.3.7, playwright-core 1.64.1                                                                                                                                                                                               |
| Options      | The defaults of `experiments/02-worklet/run.ts`: the voice counts 1, 8, 32, 64, 128, 256 and 512; renders of 4 seconds, the first second timed apart; 3 repetitions; 3 seconds in real time; no run predicted to take more than 120 seconds |
| Raw data     | `docs/records/02-worklet-container.json`: every run, the bundles, the scope's census, and the load average around each part                                                                                                                 |

## The device

| Item                 | Value                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host                 | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44                                                                                      |
| Browser              | Chrome Headless Shell 153.0.8010.12 (`chromium_headless_shell-1243`), launched by `scripts/browser.ts` with its software-GPU flags and `--autoplay-policy=no-user-gesture-required` |
| Audio                | No audio hardware. A real-time `AudioContext` ran all the same, on the browser's own output: `baseLatency` 10.02 ms, `outputLatency` 32 ms, and `playbackStats` reported            |
| Clock in the worklet | `Date.now()` only, which steps by 1 ms: the scope has no `performance`. The page times each render with its own `performance.now()`                                                 |

The container is shared with other agent sessions, and the run did not reserve it. The load
average over 1, 5 and 15 minutes, on 4 cores:

| When                     | Load average     |
| ------------------------ | ---------------- |
| Before the offline part  | 4.47, 4.60, 5.89 |
| After the offline part   | 1.57, 2.42, 4.48 |
| After the real-time part | 0.96, 2.00, 4.14 |

The waits for a CPU do not inflate the CPU time of the render thread. The tables give that CPU
time, read from `/proc`, beside the wall time.

## The method

- **The voice.** `Voice` of `src/kernels/synth.shade.ts`: a `Saw` into a `Lowpass` (a biquad),
  at a level. Voice `v` plays 110 × (1 + v / 8) Hz through a cutoff of 2,400 Hz at a quality of
  0.7, at 48 kHz. The output of a quantum is the sum of the voices in voice order, times 1 / V,
  each sum rounded to an `f32`.
- **The bundles.** `run.ts` builds the page and four worklet bundles with Vite in library mode
  and the compiler's plugin (`scripts/bundle.ts`, target `worklet`). It builds `processor.ts` and
  `engine.ts` twice each. `kernel` and `engine` have `inlineDynamicImports: true`;
  `kernel-split` and `engine-split` do not. The page loads a bundle with
  `audioWorklet.addModule` from its own origin. The page is cross-origin isolated.
- **The ways of filling a quantum** (`experiments/02-worklet/options.ts`):
  - `kernel`, variant (a): `synth(lanes, voices, 128)`, with a `Float32Array` of V × 128 frames
    and an array of `Voice` instances built with `new`. The processor mixes the lanes into the
    output array when the call's promise settles. Before each call, it writes a NaN into
    `lanes[0]`. It reads `lanes[0]` again when the call returns. A quantum in which the NaN is
    gone is "filled on return".
  - `host`, variant (b): a loop over the same `Voice` instances that calls `tick()` once per
    voice and per frame (change 0109).
  - `plain`: the same loop over `RefVoice` of `test/reference.ts`, the plain-JavaScript reference
    of the unit tests: the same `f32` math, with no TypeShade.
  - `engine`: the engine's own block, `render(plan, { frames: 128, block: 128 })`, one `fuse`
    plan per quantum. The bank is on a device of the CPU tier. The processor copies the output
    when `render()` resolves (`engine.ts`).
  - `empty`: a processor that writes nothing, the cost of the render loop and of the call of
    `process()`.
- **The checks.** The page holds each output to the `plain` output of the same voice count, bit
  for bit. It holds the engine's output to `refRender` of `test/reference.ts`, with a drive
  of 1. It counts the frames with the reference's bits. It also counts the frames with the bits
  of the reference one quantum earlier.
- **Load.** Each run renders 0.5 s of 8 voices in an `OfflineAudioContext`. The runs are:
  - the kernel call with the tiers left as they are, with the CPU tier required, and with WebGPU
    required;
  - the host loop;
  - the engine, with and without a `structuredClone` installed, from both engine bundles.
- **Offline.** Each run renders 4 s of audio of one variant and voice count in an
  `OfflineAudioContext` (mono, 48 kHz), one `AudioWorkletNode` into the destination. The context
  is suspended at 1 s and at the start of the last quantum. The timed part lies between the two
  suspensions: 2.997 s of audio, 1,124 quanta. The page reads the wall clock with
  `performance.now()` at each suspension. The real-time ratio is the wall time of the timed part
  over its audio time. While the context is suspended, the runner reads the CPU time of each
  thread of the browser from `/proc/<pid>/task/<tid>/schedstat` (`scripts/cpu-time.ts`). The CPU
  ratio is the CPU time of the render thread over the audio time. In `/proc` that thread is
  "Offline AudioWo". Each run is repeated three times, and the tables give the median. A run
  whose timed part took more than 20 s ran once. A run predicted to take more than 120 s did not
  run.
- **Real time.** For each voice count, `plain`, `kernel`, `host` and `engine` play in an
  `AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })` for 3 s. The runner records:
  - the audio clock (`currentTime`) gained per second of wall clock;
  - the underruns that `playbackStats` counts;
  - the CPU time of the render thread ("Realtime AudioW" in `/proc`) over the wall time.

## What loads in the worklet, and what it needed (ask F)

| Bundle         | Entry          | Dynamic imports inlined | Files                                                         |   Bytes | `import(` in the code | `structuredClone` in the code |
| -------------- | -------------- | ----------------------- | ------------------------------------------------------------- | ------: | --------------------: | ----------------------------: |
| `kernel`       | `processor.ts` | yes                     | `processor.js`                                                | 200,488 |                     0 |                             1 |
| `kernel-split` | `processor.ts` | no                      | `processor.js`                                                | 200,488 |                     0 |                             1 |
| `engine`       | `engine.ts`    | yes                     | `processor.js`                                                | 663,993 |                     0 |                             4 |
| `engine-split` | `engine.ts`    | no                      | `processor.js`, `engine-GpWI9Qsl.js`, `fuse-plan-Dmlm_fGn.js` | 664,378 |                     1 |                             4 |

Of the globals that the census of `experiments/02-worklet/scope.ts` reads, by `typeof`, when the
bundle was evaluated:

- It has `WebAssembly`, `SharedArrayBuffer`, `Atomics`, `Date`.
- It lacks `navigator`, `document`, `window`, `self`, `OffscreenCanvas`, `performance`,
  `TextDecoder`, `TextEncoder`, `queueMicrotask`, `setTimeout`, `structuredClone`, `fetch`,
  `MessageChannel`, `crypto`, `URL`, `navigator.gpu`.

| Bundle         | Variant  | Tiers     | `structuredClone` installed | `addModule` (ms) | Result                                                                        | Frames with the reference's bits | Quanta filled on return | Quanta begun with a call pending |
| -------------- | -------- | --------- | --------------------------- | ---------------: | ----------------------------------------------------------------------------- | -------------------------------: | ----------------------: | -------------------------------: |
| `kernel`       | `kernel` | `default` |                             |              6.7 | ran                                                                           |                 24,000 of 24,000 |                0 of 188 |                                0 |
| `kernel`       | `kernel` | `cpu`     |                             |              6.2 | ran                                                                           |                 24,000 of 24,000 |                0 of 188 |                                0 |
| `kernel`       | `kernel` | `webgpu`  |                             |              6.0 | `synth(): no tier it may use can run it (webgpu: there is no WebGPU device).` |                      0 of 24,000 |                         |                                  |
| `kernel`       | `host`   | `default` |                             |              6.7 | ran                                                                           |                 24,000 of 24,000 |                         |                                  |
| `kernel-split` | `kernel` | `default` |                             |             16.5 | ran                                                                           |                 24,000 of 24,000 |                0 of 188 |                                0 |
| `engine-split` | `engine` | `cpu`     | no                          |             23.9 | at `bank()`: `ReferenceError: structuredClone is not defined`                 |                      0 of 24,000 |                         |                                  |
| `engine-split` | `engine` | `cpu`     | yes                         |             10.6 | at `render()`: `TypeError: import() is disallowed on WorkletGlobalScope.`     |                      0 of 24,000 |                         |                                  |
| `engine`       | `engine` | `cpu`     | no                          |             42.6 | at `bank()`: `ReferenceError: structuredClone is not defined`                 |                      0 of 24,000 |                         |                                  |
| `engine`       | `engine` | `cpu`     | yes                         |             21.2 | ran                                                                           |                 24,000 of 24,000 |                0 of 188 |                                0 |

## The numbers

### Offline: the real-time ratio

The median of three runs: the wall time of the timed part over its audio time. Below 1, the
variant renders faster than real time.

| Voices | `plain` | `kernel` (a) | `engine` | `host` (b) |
| -----: | ------: | -----------: | -------: | ---------: |
|      1 |   0.003 |        0.011 |    0.050 |      0.064 |
|      8 |   0.010 |        0.033 |    0.067 |      0.525 |
|     32 |   0.033 |        0.108 |    0.174 |      2.135 |
|     64 |   0.070 |        0.217 |    0.306 |      4.235 |
|    128 |   0.129 |        0.509 |    0.552 |      8.638 |
|    256 |   0.287 |        0.904 |    1.028 |     17.090 |
|    512 |   0.546 |        1.884 |    2.142 |    not run |

The cost of one quantum, in milliseconds (the budget of a quantum is 2.667 ms):

| Voices | `plain` | `kernel` (a) | `engine` | `host` (b) |
| -----: | ------: | -----------: | -------: | ---------: |
|      1 |   0.009 |        0.028 |    0.135 |      0.171 |
|      8 |   0.027 |        0.089 |    0.180 |      1.400 |
|     32 |   0.087 |        0.287 |    0.463 |      5.692 |
|     64 |   0.187 |        0.580 |    0.817 |     11.295 |
|    128 |   0.343 |        1.357 |    1.471 |     23.036 |
|    256 |   0.766 |        2.411 |    2.740 |     45.573 |
|    512 |   1.457 |        5.024 |    5.712 |    not run |

The CPU ratio: the CPU time of the render thread over the audio time.

| Voices | `plain` | `kernel` (a) | `engine` | `host` (b) |
| -----: | ------: | -----------: | -------: | ---------: |
|      1 |   0.003 |        0.009 |    0.044 |      0.063 |
|      8 |   0.009 |        0.032 |    0.065 |      0.519 |
|     32 |   0.032 |        0.107 |    0.165 |      2.094 |
|     64 |   0.069 |        0.211 |    0.299 |      4.192 |
|    128 |   0.128 |        0.505 |    0.544 |      8.546 |
|    256 |   0.286 |        0.883 |    1.018 |     16.823 |
|    512 |   0.540 |        1.873 |    2.121 |    not run |

The spread of the real-time ratio over the repetitions:

| Voices |        `plain` |   `kernel` (a) |       `engine` |     `host` (b) |
| -----: | -------------: | -------------: | -------------: | -------------: |
|      1 | 0.003 to 0.003 | 0.010 to 0.012 | 0.043 to 0.056 | 0.061 to 0.100 |
|      8 | 0.009 to 0.010 | 0.031 to 0.037 | 0.067 to 0.078 | 0.525 to 0.562 |
|     32 | 0.033 to 0.035 | 0.106 to 0.111 | 0.168 to 0.192 | 2.096 to 2.158 |
|     64 | 0.068 to 0.076 | 0.209 to 0.220 | 0.304 to 0.318 | 4.125 to 4.620 |
|    128 | 0.124 to 0.143 | 0.480 to 0.515 | 0.541 to 0.608 |  8.638 (1 run) |
|    256 | 0.279 to 0.305 | 0.848 to 0.994 | 1.003 to 1.099 | 17.090 (1 run) |
|    512 | 0.520 to 0.559 | 1.790 to 1.987 | 2.138 to 2.506 |        not run |

The empty processor, at 1 voice: 0.0010 (ratio), 0.0027 ms a quantum, CPU ratio 0.0010.

### Where each variant reaches the quantum

Interpolated linearly between the two voice counts around the crossing, from the medians above.
A ratio of 0.5 leaves half of the quantum to the rest of a graph and to the jitter of a real
device.

| Variant      | Ratio 1 at                | Ratio 0.5 at              | CPU ratio 1 at            | CPU ratio 0.5 at          |
| ------------ | ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `plain`      | above 512 (0.546 there)   | 466 (between 256 and 512) | above 512 (0.540 there)   | 471 (between 256 and 512) |
| `kernel` (a) | 281 (between 256 and 512) | 126 (between 64 and 128)  | 286 (between 256 and 512) | 127 (between 64 and 128)  |
| `engine`     | 249 (between 128 and 256) | 115 (between 64 and 128)  | 251 (between 128 and 256) | 117 (between 64 and 128)  |
| `host` (b)   | 15 (between 8 and 32)     | 8 (between 1 and 8)       | 15 (between 8 and 32)     | 8 (between 1 and 8)       |

### Real time

| Voices | Variant      | Audio clock over wall clock | Quanta | CPU of the render thread | Underruns | Underrun (ms) |
| -----: | ------------ | --------------------------: | -----: | -----------------------: | --------: | ------------: |
|      1 | `plain`      |                       0.999 |   1138 |                    0.011 |         0 |             0 |
|      1 | `kernel` (a) |                       0.999 |   1135 |                    0.034 |         0 |             0 |
|      1 | `host` (b)   |                       1.004 |   1135 |                    0.112 |         0 |             0 |
|      1 | `engine`     |                       0.989 |   1127 |                    0.094 |         1 |            10 |
|      8 | `plain`      |                       1.005 |   1135 |                    0.023 |         0 |             0 |
|      8 | `kernel` (a) |                       1.005 |   1135 |                    0.085 |         0 |             0 |
|      8 | `host` (b)   |                       1.004 |   1135 |                    0.677 |         2 |            20 |
|      8 | `engine`     |                       1.005 |   1135 |                    0.135 |         3 |            30 |
|     32 | `plain`      |                       1.002 |   1135 |                    0.049 |         0 |             0 |
|     32 | `kernel` (a) |                       1.006 |   1142 |                    0.186 |         3 |            30 |
|     32 | `host` (b)   |                       0.490 |    556 |                    0.964 |       293 |          2936 |
|     32 | `engine`     |                       1.002 |   1131 |                    0.263 |         1 |            10 |
|     64 | `plain`      |                       1.004 |   1135 |                    0.085 |         0 |             0 |
|     64 | `kernel` (a) |                       1.005 |   1135 |                    0.303 |         2 |            20 |
|     64 | `host` (b)   |                       0.193 |    221 |                    0.959 |       292 |          2926 |
|     64 | `engine`     |                       1.009 |   1139 |                    0.418 |        11 |           110 |
|    128 | `plain`      |                       1.005 |   1135 |                    0.154 |         0 |             0 |
|    128 | `kernel` (a) |                       1.005 |   1135 |                    0.527 |         4 |            40 |
|    128 | `host` (b)   |                       0.082 |     94 |                    0.964 |       193 |          1934 |
|    128 | `engine`     |                       1.002 |   1131 |                    0.680 |         5 |            50 |
|    256 | `plain`      |                       1.003 |   1134 |                    0.295 |         0 |             0 |
|    256 | `kernel` (a) |                       1.008 |   1146 |                    0.932 |       138 |          1383 |
|    256 | `host` (b)   |                       0.060 |     71 |                    0.959 |       189 |          1894 |
|    256 | `engine`     |                       0.912 |   1029 |                    0.958 |       291 |          2916 |
|    512 | `plain`      |                       1.005 |   1135 |                    0.574 |         0 |             0 |
|    512 | `kernel` (a) |                       0.498 |    563 |                    0.965 |       294 |          2946 |
|    512 | `host` (b)   |                       0.029 |     34 |                    0.957 |       202 |          2024 |
|    512 | `engine`     |                       0.510 |    582 |                    0.953 |       291 |          2916 |

No real-time run reported an error.

### What else the run counted

The CPU time of the other threads during the timed part, in milliseconds a second of audio. It
is the sum over every thread of the browser and of the runner, but the render thread.

| Voices | `plain` | `kernel` (a) | `engine` | `host` (b) |
| -----: | ------: | -----------: | -------: | ---------: |
|      1 |       3 |           11 |       14 |          6 |
|      8 |       3 |            4 |       15 |         10 |
|     32 |       3 |            4 |       23 |         33 |
|     64 |       4 |            4 |       21 |         42 |
|    128 |       3 |            8 |       22 |        145 |
|    256 |       4 |           14 |       27 |        181 |
|    512 |       5 |           89 |      146 |    not run |

The first second of each render, the warm-up, as a real-time ratio:

| Voices | `plain` | `kernel` (a) | `engine` | `host` (b) |
| -----: | ------: | -----------: | -------: | ---------: |
|      1 |   0.012 |        0.022 |    0.112 |      0.086 |
|      8 |   0.021 |        0.060 |    0.150 |      0.605 |
|     32 |   0.040 |        0.134 |    0.250 |      2.009 |
|     64 |   0.080 |        0.267 |    0.394 |      4.195 |
|    128 |   0.136 |        0.478 |    0.665 |      8.235 |
|    256 |   0.286 |        0.864 |    1.105 |     16.781 |
|    512 |   0.561 |        1.926 |    2.295 |    not run |

## Observations

These are facts of this run.

1. The generated module loads in the worklet scope unchanged. The worklet bundle of
   `processor.ts` holds no `import()`, with or without the inlining. The two builds are the same
   200,488 bytes. The module imports `typeshade/runtime/internal`, and at the pin no module that
   it imports holds a dynamic import.
2. `addModule` resolved for all four bundles. No code in them reads `navigator.gpu` or the DOM
   when it is evaluated.
3. `synth` ran on the CPU tier with the tiers left as they are. The scope has no `navigator` and
   no canvas, so the call found no WebGPU device and no WebGL2 context. With WebGPU required, the
   call refused: `synth(): no tier it may use can run it (webgpu: there is no WebGPU device).`
4. The kernel call never filled its array before it returned. This held in all 31,500 quanta of
   the offline runs, and in every real-time run. The CPU tier runs the call in a microtask of the
   kernel queue (`this.last.then(f)`, `src/core/resident.ts:503` at the pin).
5. No quantum began with a call pending. Every output had the bits of its reference in its own
   quantum, and no frame came one quantum late. So in this browser, the microtask that writes the
   output array runs before the browser reads that array.
6. The engine's `render()` needed two changes to run in the worklet:
   - Without a `structuredClone`, `bank()` failed. `dev.array(instances)` copies an array of
     objects with `structuredClone` (`src/core/resident.ts:358`), and the scope has none.
   - Without the inlining, the first `render()` failed in `fuse()`. `fuse()` loads its planner
     with `import()` (`src/core/fuse-record.ts:38`), and the scope refuses it:
     `TypeError: import() is disallowed on WorkletGlobalScope.`

   With both changes, `render()` ran, and every frame had the bits of `refRender`.
7. No bundle holds the WebGL2 tier's dynamic import (`src/runtime/runtime.ts:613`). The split
   engine bundle has one dynamic import, the planner's. The engine bundle is 663,993 bytes, 3.3
   times the kernel bundle. The planner's chunk alone is 379,630 bytes.
8. Offline, the real-time ratio reaches 1 at these voice counts: about 280 for `kernel`, about
   250 for `engine` and about 15 for `host`. `plain` stays below 1 up to 512 voices, at 0.546
   there. The ratio reaches 0.5 at about 125, 115, 8 and 465 voices.
9. One voice costs 22 ns a sample with `plain`, 77 ns with `kernel` and 87 ns with `engine`, at
   512 voices. It costs 1,391 ns with `host`, at 256 voices. So the kernel call takes 3.4 times
   as long as the plain loop, and the host loop 63 times as long.
10. From 32 voices up, the median CPU ratio of the render thread is within 5 % of the median
    real-time ratio. So the waits for a CPU added little to these runs. At 1 and 8 voices the
    difference is up to 13 %.
11. During the timed part, the other threads of the browser and of the runner spent CPU time as
    well. In milliseconds a second of audio, they spent 89 during `kernel` and 146 during `engine`
    at 512 voices. They spent 181 during `host` at 256 voices, and 5 during `plain` at 512.
12. The generated code returns the `inout` values of each method call in a new array:
    `e.inout.values = [...]` in the bundle. `Voice.tick` makes three such calls a sample.
13. In real time, the audio clock kept pace with the wall clock (0.989 to 1.009) where the CPU of
    the render thread stayed below 0.7. The underruns over 3 s:
    - `plain`: none at any count. At 512 voices its thread's CPU was 0.574.
    - `kernel`: none at 1 and 8 voices, 2 to 4 from 32 to 128 voices, and 138 at 256 (CPU
      0.932). At 512 voices its clock fell to 0.498.
    - `engine`: 1 to 11 from 1 to 128 voices, and 291 at 256.
    - `host`: 2 at 8 voices (CPU 0.677). From 32 voices, its clock fell below 0.5.

    One underrun is 10 ms of audio, the browser's callback (`baseLatency` 10.02 ms).

## Inferences

These are inferences, not results.

1. The latency-critical path exists on the CPU tier, in Chromium. The generated module loads in
   the worklet unchanged. On one core of this container, the kernel call fills a quantum of about
   280 voices of the engine's `Voice`. In half the quantum it fills about 125 voices. The
   engine's own block fills about 115 voices in half the quantum.
2. The samples land in their own quantum only because of an order that the specification does
   not promise. The Web Audio API specification copies the output arrays when `process()`
   returns (§2.6, "Rendering an Audio Graph", the editor's draft of 2026-11-02). Its microtask
   checkpoint comes after that copy. Chromium 153 read the arrays after the checkpoint
   (observation 5). So a browser that follows the specification plays each quantum one quantum
   late.
3. Within the specification, a processor can play the call of quantum n in quantum n + 1. Every
   call had settled before the next quantum began, so this works. It adds 128 frames, 2.67 ms, of
   latency. A call on the CPU tier that fills its arrays before it returns removes the dependence
   on Chromium and the added latency. That call is the shape of ask F.
4. The engine's path needs a worklet form of `typeshade/runtime` too: the planner without a
   dynamic import, and `dev.array()` without `structuredClone` (ask F). The engine's block costs
   14 % more than the bare kernel call at 256 and at 512 voices. At 1 voice it costs about 0.1 ms
   more.
5. The host loop of variant (b) is no path past a handful of voices. It reaches the quantum at
   about 15 voices, because each `tick()` converts its instance at the boundary. Surface §64 says
   the same: the host method is the reference, and the kernel is the fast path.
6. In real time on this container, the practical budget is about half the quantum. The underruns
   of `kernel` rose from 4 to 138 between a thread CPU of 0.527 and 0.932.
7. `kernel` and `engine` had a few underruns at a low CPU, and `plain` had none in the same
   minutes. This points at their allocations (observations 11 and 12), and not at the container.
   That is ask S.
8. The number that ask K's tier would have to beat, on this core, is two numbers. The CPU tier's
   kernel call fills a quantum with about 280 voices. A plain JavaScript loop of the same math
   fills half a quantum with about 465 voices, and a whole one with about 940 (extrapolated).
9. The generated code's cost (ask S) is most of the gap between those two numbers. A CPU tier
   without an allocation per call may close the gap with no new tier.
10. The decision that these reference numbers support: keep the low-latency transport of
    `docs/architecture.md`, section 8, on the CPU tier inside the worklet. Ask the compiler for a
    worklet form of the CPU tier (ask F). The owner's devices give the voice counts.

## Deviations

1. **The voice.** Experiment 2's question in `docs/experiments.md` names voices of a `Phasor` and
   a `OnePole`. This run used the engine's `Voice` of `src/kernels/synth.shade.ts`, a `Saw` into
   a `Lowpass`: the voice of the engine's `synth` kernel and of experiment 1. A `Saw` is a
   `Phasor` with a wave. A `Lowpass` does five multiplications a sample, and a `OnePole` does
   one. So a voice of a `Phasor` and a `OnePole` costs less (inference). Disposition: open. The
   owner decides whether the question names the engine's `Voice`.
2. **The search for the last count.** Method step 5 raises the voice count until the quantum
   overruns, and records the last count that did not. This run measured seven fixed counts. It
   interpolated each crossing between two of them, and the table of crossings names both.
   Disposition: made part of the record. A device run can measure between the two counts with
   `--voices`.
3. **The reason in `docs/vision.md`, section 9.** The section says that the runtime imports its
   WebGL2 tier dynamically (`src/runtime/runtime.ts`). It concludes that a worklet build is a
   compiler ask. No bundle of this run holds that import. The generated module loads unchanged,
   and the import that stops the engine is the planner's (observations 1, 6 and 7). The
   conclusion still holds: a worklet build of the CPU tier is a compiler ask. Disposition: open.
   This pull request does not change `docs/vision.md`, and the owner decides. Ask F of
   `docs/compiler-asks.md` now states the measured reasons.

## What this run does not measure

- The owner's devices, and a browser other than Chromium. Firefox and Safari may copy the output
  arrays when `process()` returns, as the specification says (inference 2).
- The cost of each quantum on a fine clock. The scope has no `performance`. A quantum's cost here
  is the mean over 1,124 quanta, and its jitter shows only in the underruns of the real-time part.
- Real audio hardware. The container has none. The real-time context played into the browser's
  own output, in callbacks of about 10 ms.
- A graph with other nodes, a render of minutes, and the garbage collector over minutes.
- Parameter changes and note events inside a quantum.
- A voice of a `Phasor` and a `OnePole` (deviation 1).
