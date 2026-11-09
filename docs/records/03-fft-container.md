# Record 03: the FFT entry held to the oracle on three tiers, on the container

> **Reference numbers, not a device result.** The device of this run is the container of a
> Claude Code session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU.
> These numbers say what the harness measures, how SwiftShader answers, and what the compiler at
> the pin runs and refuses. They do not stand for a GPU's `sin`, `cos` or subnormal handling. The
> device runs of experiment 3 are pending (`docs/experiments.md`, section 3).

> **Status of variant C on WebGL2: runs at the pin `415b276a` (observed 2026-11-09).** This record's
> run, at the first pin, did not get a result from it (compiler #966, #970). Those issues are fixed
> by #1003 and #1014, and the pin holds both. The command `bun run exp:03 --tier webgl2 --sizes 1024`
> returned all six calls, forward and inverse of the three variants, in 0.4 to 1.2 seconds each, with
> no invalid draw. Variant C gave the same error against the `f64` reference as variant B for the
> noise, impulse and decay signals (1.31 and 4.14 ULPs largest, forward and inverse) and for the
> `quiet` signal (239.08 and 244.15 ULPs). 2,046 of its 2,048 twiddles were the twiddle rounded to
> the nearest `f32`. The numbers of this record are unchanged, and the sentences below that say
> variant C did not return stay as the record of the first run.

## The run

| Item         | Value                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 3, the FFT entry held to the oracle on three tiers (`docs/experiments.md`, section 3)                                                                                                                                               |
| Command      | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:03 --tier all --repeats 3 --timeout 60 --out docs/records/03-fft-container.json`                  |
| Date         | 2026-11-02, from 15:48:25 UTC, 2 minutes 34 seconds                                                                                                                                                                                 |
| Commit       | `18ed76a935de248bb34707a7b9f45d94e86253a4` of `typeshade/typeaudio`, branch `claude/exp-03-fft` (pull request #9), with a clean tree                                                                                                |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                     |
| Tools        | Bun 1.4.4, Node v22.23.4, Vite 7.3.7, playwright-core 1.64.1                                                                                                                                                                        |
| Raw data     | `docs/records/03-fft-container.json`: every arm, size, variant, direction and signal against the reference, every pair of arms, the subnormal counts, the probes, the determinism rows, the refusals and each device's `DeviceInfo` |
| Outputs      | The run writes every output's bits to `experiments/03-fft/out/raw.json`, which Git ignores                                                                                                                                          |

Two earlier runs of the same harness, at the commits `08e3f27` (variants A and B) and `83f72ad` (all
three), both with a clean tree, gave the same counts and errors as this run for every row they
share. Only the times differed.

## The devices

| Item     | CPU tier (the host face)                                                                       | Oracle                     | WebGPU                                                                                                                                                                              | WebGL2                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same                   | the same                                                                                                                                                                            | the same                                                                                     |
| Runtime  | Node v22.23.4                                                                                  | Bun 1.4.4 (JavaScriptCore) | Chrome Headless Shell 153.0.8010.12                                                                                                                                                 | the same                                                                                     |
| Graphics | none                                                                                           | none                       | SwiftShader: vendor `google`, architecture `swiftshader`, a fallback adapter; features `core-features-and-limits`, `timestamp-query`; `maxComputeWorkgroupStorageSize` 16,384 bytes | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The container is shared with other agent sessions, and the run did not reserve it. The load average
over 1, 5 and 15 minutes was 4.82, 4.69 and 4.41 at the start of the run and 11.37, 6.62 and 5.12 at
its end, on 4 cores. The load bears on the times. The bits do not depend on it.

## The method

**The entry.** `experiments/03-fft/fft.shade.ts` holds a radix-2 FFT, decimation in time, as six
`@compute` entries. Each workgroup of 256 invocations runs one transform. It reads its input in
bit-reversed order, then runs one stage of butterflies between two barriers. Each invocation owns
its butterflies in a stage, so a stage works in place.

| Entry                                               | Points | Working memory                                                           | Barrier              |
| --------------------------------------------------- | -----: | ------------------------------------------------------------------------ | -------------------- |
| `fftSmallDevice`, `fftSmallTable`, `fftSmallDouble` |  1,024 | `workgroup<array<vec2, 1024>>`, 8 KiB                                    | `workgroupBarrier()` |
| `fftLargeDevice`, `fftLargeTable`, `fftLargeDouble` |  4,096 | the output, a `storage` array; 32 KiB of workgroup memory is over 16 KiB | `storageBarrier()`   |

WebGPU guarantees 16 KiB of workgroup memory (`maxComputeWorkgroupStorageSize`), and the SwiftShader
adapter gives no more. The sizes are module constants, so no entry reads `.length` inside an index
(ask J).

**The twiddles**, three variants:

- A, `device`: `cos` and `sin` of an `f32` angle on the device, `f32(t) * (±2π / N)`.
- B, `table`: `(cos(2πt / N), sin(2πt / N))` for `t` below N / 2, computed on the host in doubles,
  rounded to `f32` and uploaded. The inverse negates the sine.
- C, `double`: `cos` and `sin` of an emulated double on the device (compiler surface §39), narrowed
  to `f32`. The angle is `(t · (±1 / N))` in `f32`, which is exact, times 2π in `f64`.

**The inputs**, `experiments/03-fft/signals.ts`, one workgroup each, rounded to `f32`:

| Signal    | What it is                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `noise`   | Complex white noise: both parts `2u - 1`, `u` from `generator(0x5eed0003)` of `typeshade/random`                 |
| `impulse` | 1 at n = 1 and 0 elsewhere. Its forward transform is the twiddles: point k is `exp(-2πik / N)`                   |
| `decay`   | A sine of 0.0626 cycles per sample (3,005 Hz at 48 kHz) that falls by 2^-40 over the transform, from a peak of 1 |
| `quiet`   | `decay` times 2^-110. It falls below 2^-126 at 0.4 N, so the last 60 % of its points are subnormal or 0 in `f32` |

The forward call transforms the inputs (sign -1, scale 1). The inverse call transforms the
reference's forward transform of the inputs, rounded to `f32` (sign +1, scale 1 / N). So every arm
and the reference start from the same `f32`s.

**The reference** is the same radix-2 transform in JavaScript doubles, of the same `f32` input, each
twiddle from `Math.cos` and `Math.sin`.

**The measures.**

- The error, in `f32` ULPs at the transform's peak: `|y - r| / ulp(max |r|)`, the largest and the
  mean over the transform's 2N values. An FFT's rounding error scales with the transform's largest
  magnitude. The ULP of each value would shrink without bound near 0, where the error of an FFT does
  not, so it is not the unit.
- The relative RMS error, `||y - r|| / ||r||`.
- The values that are the reference rounded to the nearest `f32`.
- Between two arms: the values whose bits differ, -0 against 0 included, and the largest difference
  in the same unit as the error.
- Subnormals: the nonzero values below 2^-126, the zeros, and the values the oracle holds as
  subnormals and an arm holds as 0 ("flushed").

**The arms.**

| Arm      | What runs                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu`    | The host face's CPU tier in Node: the harness bundled with Vite and the compiler's plugin, `configure({ prefer: ['cpu'] })`. At the pin it refuses each entry (section "Refusals, and calls that did not return").                                                           |
| `oracle` | The compiler's oracle in Bun: `compileModuleJs(compile(source).module, { precision: 'f32' }).dispatch(entry, 4)`. It runs the passes the WebGL2 tier runs (surface §25), at `f32`. It needs `compile()`, which loads on Bun and not on Node from the source tarball (ask Q). |
| `webgpu` | The harness bundled for a page, in headless Chromium, `configure({ prefer: ['webgpu'] })`: a list of one tier, so a call runs there or throws.                                                                                                                               |
| `webgl2` | The same page in a fresh browser, `configure({ prefer: ['webgl2'] })`.                                                                                                                                                                                                       |

Each GPU call runs three times, and the second and third runs are held to the first bit for bit. A
call that does not return within 60 seconds is recorded as unfinished, and the calls after it on the
tier are not run: they would queue behind it.

**The probes**, `experiments/03-fft/probes.shade.ts`, run on each arm of the host face before the
calls:

- `scaleProbe`, `ys[i] = xs[i] * factor`, with the factor from a uniform. Six subnormal inputs
  (2^-149, 2^-140, 2^-130, 2^-127, -2^-135, 3 × 2^-149) times 2^20: four of the products are normal,
  so a 0 there means the tier flushed what it read. Six normal inputs (2^-110, 2^-112, 2^-115,
  -2^-108, 1.5 × 2^-110, 2^-105) times 2^-20: five of the products are subnormal, so a 0 there means
  the tier flushed what it wrote.
- `wrapProbe`, `ys[i] = xs[i % xs.length]`, 12 outputs from 5 inputs: the form of compiler issue
  #900, which the FFT entries avoid.

## The numbers

### Error against the reference

Largest / mean error in `f32` ULPs at the transform's peak. Full scale: the largest over `noise`,
`impulse` and `decay`, and the mean of their means. "n/a": no output (section "Refusals, and calls
that did not return").

| Size | Variant | Direction | Oracle        | WebGPU             | WebGL2             |
| ---: | ------- | --------- | ------------- | ------------------ | ------------------ |
| 1024 | A       | forward   | 2.79 / 0.279  | 3060.34 / 330.529  | 3060.34 / 330.529  |
| 1024 | A       | inverse   | 9.67 / 0.606  | 10179.59 / 620.070 | 10179.59 / 620.070 |
| 1024 | B       | forward   | 1.31 / 0.133  | 1.31 / 0.133       | 1.31 / 0.133       |
| 1024 | B       | inverse   | 4.14 / 0.324  | 4.14 / 0.324       | 4.14 / 0.324       |
| 1024 | C       | forward   | 1.31 / 0.133  | 1.31 / 0.133       | n/a                |
| 1024 | C       | inverse   | 4.14 / 0.324  | 4.14 / 0.324       | n/a                |
| 4096 | A       | forward   | 3.35 / 0.288  | 3398.46 / 348.660  | 3398.46 / 348.660  |
| 4096 | A       | inverse   | 10.87 / 0.765 | 11043.10 / 826.416 | 11043.10 / 826.416 |
| 4096 | B       | forward   | 1.61 / 0.130  | 1.61 / 0.130       | 1.61 / 0.130       |
| 4096 | B       | inverse   | 5.14 / 0.373  | 5.14 / 0.373       | 5.14 / 0.373       |
| 4096 | C       | forward   | 1.61 / 0.130  | 1.61 / 0.130       | n/a                |
| 4096 | C       | inverse   | 5.14 / 0.373  | 5.14 / 0.373       | n/a                |

The relative RMS error, the largest over the three full-scale signals:

| Size | Variant | Direction | Oracle  | WebGPU  | WebGL2  |
| ---: | ------- | --------- | ------- | ------- | ------- |
| 1024 | A       | forward   | 2.33e-7 | 2.44e-4 | 2.44e-4 |
| 1024 | A       | inverse   | 2.29e-7 | 3.24e-4 | 3.24e-4 |
| 1024 | B       | forward   | 1.14e-7 | 1.14e-7 | 1.14e-7 |
| 1024 | B       | inverse   | 1.19e-7 | 1.19e-7 | 1.19e-7 |
| 1024 | C       | forward   | 1.14e-7 | 1.14e-7 | n/a     |
| 1024 | C       | inverse   | 1.19e-7 | 1.19e-7 | n/a     |
| 4096 | A       | forward   | 2.78e-7 | 3.01e-4 | 3.01e-4 |
| 4096 | A       | inverse   | 2.84e-7 | 3.59e-4 | 3.59e-4 |
| 4096 | B       | forward   | 1.29e-7 | 1.29e-7 | 1.29e-7 |
| 4096 | B       | inverse   | 1.34e-7 | 1.34e-7 | 1.34e-7 |
| 4096 | C       | forward   | 1.29e-7 | 1.29e-7 | n/a     |
| 4096 | C       | inverse   | 1.34e-7 | 1.34e-7 | n/a     |

### The twiddles

The impulse's forward transform is the twiddles, so its error is theirs: the largest absolute error,
and the values that are the twiddle rounded to the nearest `f32`.

| Size | Variant | Oracle                          | WebGPU                          | WebGL2                          |
| ---: | ------- | ------------------------------- | ------------------------------- | ------------------------------- |
| 1024 | A       | 2.03e-7 (2^-22.2); 1098 of 2048 | 1.89e-4 (2^-12.4); 6 of 2048    | 1.89e-4 (2^-12.4); 6 of 2048    |
| 1024 | B       | 2.98e-8 (2^-25.0); 2048 of 2048 | 2.98e-8 (2^-25.0); 2048 of 2048 | 2.98e-8 (2^-25.0); 2048 of 2048 |
| 1024 | C       | 2.98e-8 (2^-25.0); 2048 of 2048 | 2.98e-8 (2^-25.0); 2046 of 2048 | n/a                             |
| 4096 | A       | 2.03e-7 (2^-22.2); 4292 of 8192 | 1.89e-4 (2^-12.4); 8 of 8192    | 1.89e-4 (2^-12.4); 8 of 8192    |
| 4096 | B       | 2.98e-8 (2^-25.0); 8192 of 8192 | 2.98e-8 (2^-25.0); 8192 of 8192 | 2.98e-8 (2^-25.0); 8192 of 8192 |
| 4096 | C       | 2.98e-8 (2^-25.0); 8192 of 8192 | 2.98e-8 (2^-25.0); 8190 of 8192 | n/a                             |

### Bit for bit between the arms

The values whose bits differ, and in brackets the largest difference in `f32` ULPs at the
transform's peak. Full scale: `noise`, `impulse` and `decay` together.

| Size | Variant | Direction | Oracle and WebGPU         | Oracle and WebGL2         | WebGPU and WebGL2 |
| ---: | ------- | --------- | ------------------------- | ------------------------- | ----------------- |
| 1024 | A       | forward   | 6122 of 6144 (3060.00)    | 6122 of 6144 (3060.00)    | 0 of 6144         |
| 1024 | A       | inverse   | 5106 of 6144 (10177.00)   | 5106 of 6144 (10177.00)   | 0 of 6144         |
| 1024 | B       | forward   | 0 of 6144                 | 0 of 6144                 | 0 of 6144         |
| 1024 | B       | inverse   | 0 of 6144                 | 0 of 6144                 | 0 of 6144         |
| 1024 | C       | forward   | 2 of 6144 (5.1e-10)       | n/a                       | n/a               |
| 1024 | C       | inverse   | 266 of 6144 (2.0e-12)     | n/a                       | n/a               |
| 4096 | A       | forward   | 24554 of 24576 (3398.50)  | 24554 of 24576 (3398.50)  | 0 of 24576        |
| 4096 | A       | inverse   | 20466 of 24576 (11042.00) | 20466 of 24576 (11042.00) | 0 of 24576        |
| 4096 | B       | forward   | 0 of 24576                | 0 of 24576                | 0 of 24576        |
| 4096 | B       | inverse   | 0 of 24576                | 0 of 24576                | 0 of 24576        |
| 4096 | C       | forward   | 2 of 24576 (5.1e-10)      | n/a                       | n/a               |
| 4096 | C       | inverse   | 1034 of 24576 (3.3e-12)   | n/a                       | n/a               |

The `quiet` signal:

| Size | Variant | Direction | Oracle and WebGPU      | Oracle and WebGL2      | WebGPU and WebGL2 |
| ---: | ------- | --------- | ---------------------- | ---------------------- | ----------------- |
| 1024 | A       | forward   | 2046 of 2048 (2080.50) | 2046 of 2048 (2080.50) | 0 of 2048         |
| 1024 | A       | inverse   | 2046 of 2048 (4232.00) | 2046 of 2048 (4232.00) | 0 of 2048         |
| 1024 | B       | forward   | 2046 of 2048 (239.00)  | 2046 of 2048 (239.00)  | 0 of 2048         |
| 1024 | B       | inverse   | 1979 of 2048 (244.11)  | 1979 of 2048 (244.11)  | 0 of 2048         |
| 1024 | C       | forward   | 2046 of 2048 (239.00)  | n/a                    | n/a               |
| 1024 | C       | inverse   | 1979 of 2048 (244.11)  | n/a                    | n/a               |
| 4096 | A       | forward   | 8190 of 8192 (2245.00) | 8190 of 8192 (2245.00) | 0 of 8192         |
| 4096 | A       | inverse   | 8184 of 8192 (4919.00) | 8184 of 8192 (4919.00) | 0 of 8192         |
| 4096 | B       | forward   | 8180 of 8192 (249.50)  | 8180 of 8192 (249.50)  | 0 of 8192         |
| 4096 | B       | inverse   | 8044 of 8192 (254.36)  | 8044 of 8192 (254.36)  | 0 of 8192         |
| 4096 | C       | forward   | 8180 of 8192 (249.50)  | n/a                    | n/a               |
| 4096 | C       | inverse   | 8044 of 8192 (254.36)  | n/a                    | n/a               |

Every GPU call gave the same bits on its three runs.

### Subnormals and the flush

The `quiet` signal: the subnormal values, the zeros in brackets, and the values flushed to 0 where
the oracle holds a subnormal. "Reference" is the reference rounded to `f32`.

| Size | Variant | Direction | Reference   | Oracle    | WebGPU                 | WebGL2                 |
| ---: | ------- | --------- | ----------- | --------- | ---------------------- | ---------------------- |
| 1024 | A       | forward   | 2 (2)       | 2 (2)     | 0 (6), flushed 2       | 0 (6), flushed 2       |
| 1024 | A       | inverse   | 637 (1024)  | 1658 (3)  | 0 (1462), flushed 1459 | 0 (1462), flushed 1459 |
| 1024 | B       | forward   | 2 (2)       | 2 (2)     | 0 (4), flushed 0       | 0 (4), flushed 0       |
| 1024 | B       | inverse   | 637 (1024)  | 1642 (19) | 0 (1661), flushed 1642 | 0 (1661), flushed 1642 |
| 1024 | C       | forward   | 2 (2)       | 2 (2)     | 0 (4), flushed 0       | n/a                    |
| 1024 | C       | inverse   | 637 (1024)  | 1642 (19) | 0 (1661), flushed 1642 | n/a                    |
| 4096 | A       | forward   | 56 (2)      | 57 (2)    | 0 (59), flushed 6      | 0 (59), flushed 6      |
| 4096 | A       | inverse   | 2570 (4096) | 6651 (15) | 0 (5611), flushed 5595 | 0 (5611), flushed 5595 |
| 4096 | B       | forward   | 56 (2)      | 56 (2)    | 0 (78), flushed 36     | 0 (78), flushed 36     |
| 4096 | B       | inverse   | 2570 (4096) | 6640 (27) | 0 (6666), flushed 6639 | 0 (6666), flushed 6639 |
| 4096 | C       | forward   | 56 (2)      | 56 (2)    | 0 (78), flushed 36     | n/a                    |
| 4096 | C       | inverse   | 2570 (4096) | 6640 (27) | 0 (6666), flushed 6639 | n/a                    |

At full scale no output of any arm holds a subnormal. The error against the reference of the `quiet`
signal, largest / mean in ULPs at its peak, and the relative RMS error:

| Size | Variant | Direction | Oracle                | WebGPU and WebGL2        |
| ---: | ------- | --------- | --------------------- | ------------------------ |
| 1024 | B       | forward   | 0.70 / 0.083; 1.04e-7 | 239.08 / 16.343; 2.47e-5 |
| 1024 | B       | inverse   | 1.05 / 0.087; 1.19e-7 | 244.15 / 4.601; 2.14e-5  |
| 4096 | B       | forward   | 0.76 / 0.043; 1.17e-7 | 249.43 / 5.839; 2.45e-5  |
| 4096 | B       | inverse   | 1.67 / 0.097; 1.30e-7 | 254.21 / 4.757; 2.14e-5  |

Variant C on WebGPU gives the same numbers as B for the `quiet` signal. Variant A adds its twiddles'
error: 2079 to 4918 ULPs at the peak.

The probes:

| Probe                          | CPU tier       | WebGPU                                       | WebGL2                                                      |
| ------------------------------ | -------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `scaleProbe`, subnormal × 2^20 | 6 of 6 exact   | 6 of 6 are 0, the 4 normal products included | 6 of 6 are 0, the 4 normal products included                |
| `scaleProbe`, normal × 2^-20   | 6 of 6 exact   | the 5 subnormal products are 0; 2^-125 exact | the 5 subnormal products are 0; 2^-125 exact                |
| `wrapProbe`                    | 12 of 12 exact | 12 of 12 exact                               | refused (section "Refusals, and calls that did not return") |

### Time per call

Host time from the call to the end of its read-back, the median of three runs (one run on the
oracle), for the four transforms of a call. These times are for information: the experiment
measures bits, and the load was 4.4 to 11.4.

| Size | Variant | Oracle (Bun) |      WebGPU |          WebGL2 |
| ---: | ------- | -----------: | ----------: | --------------: |
| 1024 | A       |  1874 / 1590 |  11.8 / 8.6 |   578.3 / 492.9 |
| 1024 | B       |  1723 / 1767 |  10.5 / 6.4 |   535.1 / 265.5 |
| 1024 | C       |  1863 / 1821 | 11.4 / 18.5 |             n/a |
| 4096 | A       |  7509 / 7925 |   7.9 / 4.9 | 1689.6 / 1898.7 |
| 4096 | B       |  6841 / 6812 |   6.4 / 6.4 | 1249.2 / 1452.0 |
| 4096 | C       |  7720 / 8343 | 29.2 / 20.8 |             n/a |

Each cell is forward / inverse, in milliseconds. The first call of each entry on WebGPU builds its
pipeline: 602 to 819 ms for the 1,024-point entries.

## The determinism report

`compile().determinism` of `fft.shade.ts` at the pin:

| `op` | `elem` | `kind`   | `accuracy`                                                                                                                                                               | `count` | `where`    |
| ---- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------: | ---------- |
| cos  | f32    | absolute | 2^-11 absolute error for x in [-π, π]                                                                                                                                    |       1 | `onDevice` |
| sin  | f32    | absolute | 2^-11 absolute error for x in [-π, π]                                                                                                                                    |       1 | `onDevice` |
| `*`  | f64    | emulated | emulated double: f32 pairs whose error terms hold while the driver neither reassociates nor fuses them, which WGSL §15.7.5 allows and the `_fp64` guard texture prevents |       1 | `inDouble` |
| cos  | f64    | emulated | the same                                                                                                                                                                 |       1 | `inDouble` |
| sin  | f64    | emulated | the same                                                                                                                                                                 |       1 | `inDouble` |

The butterflies' `+`, `-` and `*` on `f32` have no row: each is correctly rounded. `probes.shade.ts`
has no row.

## Refusals, and calls that did not return

At run time:

- The host's CPU tier refuses all twelve calls, each with one of two sentences:
  `TypeError: fftSmallTable() needs WebGPU: it reaches workgroupBarrier() at fft.shade.ts:157, and a barrier has no CPU tier.`
  and, for the 4,096-point entries,
  `TypeError: fftLargeTable() needs WebGPU: it reaches storageBarrier() at fft.shade.ts:174, and a barrier has no CPU tier.`
  Change 0092 gives the CPU tier these entries. Its `status` line reads `accepted` at the pin, and
  on the compiler's `main` at `2843a610`, read on 2026-11-02. The sentence comes from
  `src/core/host-compute.ts`, line 364, at the pin.
- On WebGL2, `wrapProbe` is refused:
  `Error: typeshade/webgl2: wrapProbe's pass program did not compile: ERROR: 0:97: '_phx_len_xs' : undeclared identifier`,
  followed by three errors on the same line. This is compiler issue #900. The compiler's `main`
  fixes it with #939 (`b3bf0af8`), after the pin.
- On WebGL2, `fftSmallDouble` forward did not return within 60 seconds, and the three variant C
  calls after it were not run. An isolated run at the same commit, with this record's documents not
  yet committed, printed an invalid draw from the GPU process:
  `GL_INVALID_OPERATION: glDrawArrays: Two textures of different types use the same sampler location.`
  The command was
  `bun run exp:03 --tier webgl2 --sizes 1024 --variants double --repeats 1 --timeout 20`, at
  15:51:52 UTC. In an earlier run of the same call (15:27 UTC), the renderer process used 98 percent
  of one core, 1 minute 23 seconds of CPU time, until the run was stopped. The pass program declares
  the `f64` guard texture, `uniform highp sampler2D _fp64;`. The WebGL2 executor binds the memory
  textures, `_phx_inv`, `_phx_rec` and the textures of `PackGlCompute['textures']`
  (`src/core/gl-compute.ts`, lines 668 to 686, at the pin), and the guard is not among them.

While the entry was written:

- `const TAU_DOUBLE: f64 = 6.283185307179586;` at the top of the module is refused (TS8003):
  `Module const "TAU_DOUBLE" must be f32, i32, u32, or bool for now.`
  (`src/compiler/ts/module-const.ts`, line 782, at the pin). The arrow function that read a local
  initialized from it then drew a second error, TS8022, although the local is declared above the
  call:
  `The function written here reads "step", which is not declared yet where it runs: a let or a const is not there before its declaration, and TypeScript throws. Declare "step" above this call.`
  Variant C writes 2π as an `f64` literal instead.
- An `f64` local that lives across a barrier has no WebGL2 pass program:
  `fftSmallDouble(): no tier it may use can run it (webgl2: a f64 cannot be kept in state).`
  (`src/core/passes/gl-compute.ts`, line 185, at the pin). Variant C keeps its double inside the
  twiddle helper, which no barrier crosses.
- `const half: u32 = 1 << (s - 1);` is refused (TS8003):
  `Type mismatch: cannot let/const half u32 and i32 — WGSL has no implicit integer conversion. Cast one side: u32(…) or i32(…), e.g. a + u32(b).`
  The literal 1 is an `i32`. The sentence names the fix, `u32(1) << (s - 1)`, which the entry uses.

## What departs from the method

Each item is a difference between the method of `docs/experiments.md`, section 3, and this run.

1. Step 1 asks for workgroup memory. The 4,096-point entries work in a storage array, because 32 KiB
   of workgroup memory is over WebGPU's 16 KiB. Disposition: open; the method's text is the owner's
   to amend.
2. Variant C is added. The method has two variants. Disposition: open, as item 1.
3. The question says that the CPU tier runs the entry since change 0092. At the pin it refuses it,
   so the CPU answer is the oracle's `dispatch`. `test/fft.test.ts` holds the refusal, and fails
   when the pin moves past 0092's implementation. Disposition: open until that pin moves; the
   question's text now says so.
4. Step 4 asks for the largest ULP distance. The unit is the ULP at the transform's peak, for the
   reason that section "The method" gives. Disposition: made part of the method's status text in
   `docs/experiments.md`, section 3.

## Observations

These are facts of this run.

1. With the host's table (variant B), the oracle, WebGPU and WebGL2 give the same bits for every
   full-scale input, at 1,024 and 4,096 points, forward and inverse: 0 of 6,144 and 0 of 24,576
   values differ. The largest error is 1.31 to 5.14 ULPs at the peak, the mean 0.130 to 0.373, and
   the relative RMS error 1.14e-7 to 1.34e-7.
2. SwiftShader's `sin` and `cos` of an `f32` angle (variant A) give twiddles off by up to 1.89e-4
   (2^-12.4). The bound in the determinism report is 2^-11. A twiddle near 1 is then off by about
   3,200 of its ULPs. 6 of 2,048 and 8 of 8,192 twiddle values are the correctly rounded `f32`.
3. Variant A's transform on SwiftShader is off by up to 3,060 to 11,043 ULPs at the peak, with a
   relative RMS error of 2.44e-4 to 3.59e-4: about 2,100 to 2,700 times variant B's. WebGPU and
   WebGL2 give the same bits for it.
4. Variant A on the oracle is off by up to 2.79 to 10.87 ULPs at the peak, about twice variant B.
   Its twiddles are off by up to 2.03e-7 (2^-22.2), while JavaScript's `Math.sin` and `Math.cos` are
   nearly correctly rounded: the error comes from the angle, rounded to `f32` before `sin` and
   `cos`.
5. Variant C on the oracle gives the bits of variant B. On WebGPU its twiddles are the table's
   except two, `cos(π/2)` and `cos(3π/2)`: 6.1e-17 on the oracle and 0 on WebGPU. Its forward
   transforms differ from the oracle in those 2 values. Its inverse transforms differ in 266 (1,024)
   or 1,034 (4,096) values, each within 2e-19 of 0. No difference is larger than 5.1e-10 ULPs at the
   peak.
6. Variant C on WebGPU takes 11.4 to 29.2 ms per call, against 6.4 to 10.5 ms for variant B.
7. The host's CPU tier refuses every entry at the pin. The oracle runs them: 1.6 to 1.9 seconds for
   four 1,024-point transforms, 6.8 to 8.3 seconds for four 4,096-point transforms.
8. SwiftShader flushes subnormals on WebGPU and on WebGL2, both where it reads them and where it
   writes them (the probe). The oracle and the CPU tier keep them.
9. In the inverse transform of the `quiet` signal the oracle holds 1,642 to 6,651 subnormal values,
   and WebGPU and WebGL2 hold none: they flush 1,459 to 6,639 of the oracle's subnormals to 0.
10. The forward transform of the `quiet` signal reads its subnormal tail as 0 on WebGPU and WebGL2.
    With the table it is off by 239 to 249 ULPs at the peak (relative RMS error about 2.5e-5),
    against 0.70 to 0.76 (1.0e-7 to 1.2e-7) on the oracle.
11. At full scale no output of any arm holds a subnormal.
12. On WebGL2, `wrapProbe` is refused (issue #900). It runs on WebGPU and on the CPU tier, and gives
    the exact result. The FFT entries read no length and run on WebGL2.
13. The variant C entry does not return on WebGL2, and the GPU process reports an invalid draw.
14. The WebGL2 arm drew two of Chromium's console messages again and again: 252 times
    `performance warning: READ-usage buffer was written, then fenced, but written again before being read back.`
    and 3 times `GPU stall due to ReadPixels`.

## Inferences

These are inferences, not results, and they rest on a CPU that emulates a GPU. The owner's devices
give the real numbers.

- **Where the FFT lives (ask G).** Nothing in the entry is audio-shaped, and its table variant gives
  the oracle's bits on both GPU tiers. By the rule that the compiler owns the general part, the FFT
  belongs in a common module, `typeshade/fft`, in the end. By the loop of `docs/vision.md`, section
  10, it lives in layer 1 here first, as the workaround, and is measured on the owner's devices. The
  numbers support that order: start in layer 1 with the host's table, and raise the issue after the
  device runs. What the common module would carry is now known: the twiddles from a table or from an
  emulated double, a storage form for sizes past workgroup memory, and the CPU tier of change 0092.
- **The twiddles' precision (ask C).** A transform's bound comes from its twiddles' source, not from
  the arithmetic: with correctly rounded twiddles the three arms agree bit for bit. A device's `sin`
  and `cos` may use all of their 2^-11, and here they used 2^-12.4, so the engine cannot state an
  FFT's bound from them. The table is the workaround the numbers support. The emulated double
  reproduces the table's twiddles on WebGPU at a higher cost per call, and has no WebGL2 run at the
  pin.
- **Subnormals (ask E).** A tier that flushes changes a quiet block's transform by a relative RMS
  error of about 2.5e-5, and gives 0 where the oracle gives a subnormal. An `f32` transform's error
  floor is about 2^-24 of its peak, so a block gives subnormals only where all of it is below about
  2^-102. A reverb tail reaches that only after about 600 dB of decay. The FFT is therefore not
  where the engine meets subnormals first: a recursive filter's state is. The determinism report
  names no flush, so the tiers' disagreement is not stated where a reader looks for it.
- **A length inside an index (ask J).** Lengths as module constants keep the entry on WebGL2 at the
  pin. The workaround can retire when the pin moves past #939.

## What this run finds in the design documents

These are facts of this run against `docs/vision.md` and `docs/architecture.md`, which this record
does not change. Their amendment is the owner's decision.

- `docs/vision.md`, section 9, "Tiers and determinism", says that the CPU tier runs entries with
  barriers since change 0092. At the pin, change 0092 is accepted and not implemented, and the host's
  CPU tier refuses such an entry (section "Refusals, and calls that did not return").
- The same section says that the determinism report lists what may differ "within 32 ULP or 2^-11".
  For `sin` and `cos` the report states 2^-11 absolute, and SwiftShader used 2^-12.4 of it: about
  3,200 ULPs of a twiddle near 1. The sentence holds by its "or"; 32 ULP does not bound `sin` and
  `cos`.
- `docs/architecture.md`, section 9, expects a render on WebGPU to be the CPU tier's bit for bit
  except the rows the determinism report lists. SwiftShader's flush of subnormals is a difference
  that no row lists. The same section defers any promise about subnormals to experiments 3 and 5.

## What this run does not measure

- The owner's devices: a real GPU's `sin` and `cos`, its subnormal handling, and whether its driver
  fuses a butterfly's multiply and add. One record per device, `03-fft-<device>.md`.
- Variant C on WebGL2: its call does not return at the pin.
- The CPU tier of the host face: it refuses every entry at the pin.
- A machine with no other load: the container is shared (section "The devices").
- The time of an FFT as the engine would use it: one call here uploads, transforms four blocks and
  reads back.
