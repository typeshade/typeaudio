# Compiler asks

This document is the ledger of what TypeAudio rests on in the compiler and what it asks of it.
The compiler is `typeshade/typeshade`. Its proposals live in its `changes/` directory, and
`changes/README.md` there is the process. `compiler-changes.md` at the root of this repository is
the other record: it lists the proposals this repository has handled, when the compiler pin
moves.

An ask is a request for compiler work, raised as an issue on `typeshade/typeshade`. The compiler
side decides how to meet it: an optimization, a lowering, a numerical relaxation, a tuning
parameter or a report needs no language change. A proposal that changes the language is the last
resort, and it says why compiler work cannot meet the need (compiler `changes/README.md`, "A need
from a downstream repository"). Nothing domain-shaped is asked of the language (compiler
`docs/dx.md`, principle 7). The rows below that name a proposal were raised before this rule
(2026-11-09). They stay as recorded.

The loop is `docs/vision.md`, section 10. A row moves through these states:

| State                                        | Meaning                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| candidate                                    | The pressure is named. Nothing is measured.                                                          |
| measured                                     | A workaround exists here. A record names the device, the date, the commit and the numbers.           |
| issue #N                                     | The general part is raised on `typeshade/typeshade` as a request for compiler work.                  |
| fixed #N                                     | The compiler side met the need without a language change. The fix is on the compiler's `main`.       |
| proposal NNNN (draft, accepted, implemented) | The lifecycle state of the compiler proposal, as its `status` line says. The last resort.            |
| retired                                      | The pin moved past the implementation, `compiler-changes.md` records the id, the workaround is gone. |

The letters and the ids are stable. A new ask takes the next free letter. After Z, an ask takes
two letters, in order: AA, AB, AC. A row never changes its letter.

## 1. The proposals this engine rests on

Five proposals were drafted and accepted on 2026-11-02, in the session that wrote the design.
Four shape the host face a unit shows the developer (`docs/vision.md`, section 8, "The host
face"), and one the fuse report that `explain` reads. The last two rows, 0119 and 0120, are
proposals of the compiler that name `typeaudio` in their `downstream` entries. No ask of this ledger
leads to either.

| Id   | Proposal                                     | What it gives TypeAudio                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status on 2026-11-02                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0108 | `changes/0108-host-view-jsdoc.md`            | The host view carries the author's JSDoc verbatim, so a unit's documentation reaches the editor through the host face.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Implemented: items 1 to 3 by #887 (`77ced44`, 2026-11-02), the inherited-field deviation closed by its record; Amendment 1 accepted (#915, `bb82036b`) and item 4, the members of an exported class carry their comments (decision D4), implemented by #937 (`f4f4b7d2`, 2026-11-02). Amendment 2 (#978, `a80551b4`, 2026-11-02) drops the static field from item 4's list, since the view declares none.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0109 | `changes/0109-host-classes.md`               | An exported class is a value of the host face: `new` and the methods run on the CPU tier, an instance is the struct's host value, a struct result is an instance. The engine's `new OnePole(0.1)` on the host rests on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Implemented (#890, squash commit `9dbc298`, 2026-11-02). Two deviations open in the proposal's record: the view's flat declaration where TypeScript refuses an override; a mixin's members untested. Amendment 1 (#960, `376f8927`, 2026-11-02, decision D5): item 6, a `Resident` made from instances keeps their classes and `read()` returns instances (ask N). Implemented by #993 (`87af4eb0`, 2026-11-02), which the pin `87af4eb0` holds; pull request #15 of this repository retires the workaround.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0110 | `changes/0110-class-consistency.md`          | Rule 8.29: a class is its struct and its functions in every place a struct or a function can be. The class arm of the differential gate holds a method to one result in a compute entry, a kernel loop, the host class and the oracle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Implemented (#883, `bef6574`, 2026-11-02), with the host leg of the class arm on the host class of 0109; the deferral deviation is closed by its record.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 0116 | `changes/0116-host-type-family.md`           | `typeshade/runtime` exports a family of host types spelled as the shader spells them (`f32`, `vec3`, `array<f32>`), so the host view reads as the `.shade.ts` file does. Renumbered from 0111 (#884, `c33f743`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Implemented (#918, `9822490f`, 2026-11-02) with Amendment 1 (#925, `334b9fc4`), which declared the twenty exports of the common modules and §74 and decided D7 to D10: a struct is spelled by its name and an exported class as the class, a struct binding by its name beside its packed forms, a matrix carries its name, and item 4 names its exceptions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0118 | `changes/0118-fuse-group-tier.md`            | Each group of a `FuseReport` carries the tier it ran on, and a group below its plan's tier says why in its `why`, so `explain` reads where each node ran instead of inferring it (ask P).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Implemented (#990, `480b6a64`, 2026-11-02), which the pin `87af4eb0` holds. Accepted (#959, `6c1799ec`) with D1 to D3 as drafted: `tier` on every group; the reason in `why`; the call layer's own text. One deviation open in the proposal's record (D-1): the reason a tier gives for a call it has no program for repeats "runs on the CPU" (`peak runs on the CPU, it runs on the CPU, loop 1 reduces, ...`). Pull request #15 of this repository retires the workaround.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0119 | `changes/0119-subgroup-reduction-variant.md` | A kernel function's reduction whose operator gives one value in every order folds inside a subgroup first on a WebGPU device that has `subgroups`, as a second WGSL variant that the runtime selects by feature and probe: an integer `+`, a bitwise operator, `min` or `max`, and `min` or `max` on a float; and a scatter `a[k] op= e` into an integer array. No source changes, and the bits are the tree's. `peak` (`src/kernels/meter.shade.ts`, shape R) reduces with `max` on `f32`, which the variant covers. An `f32` sum keeps the tree, as `sumFrame` of experiment 4 does. The proposal's entry for `typeaudio` says "No known integer reduction in a kernel function. The record notes the id at the pin." | Accepted (#977, merge `64caf3ea`, 2026-11-02), amended twice by #1024 (`d7f035ea`, 2026-11-03), and implemented on the compiler's `main` (`ad0a3865`, read 2026-11-03) after the pin, in three stages: #1020 (`8d693f34`, the second WGSL text), #1026 (`043f8cad`, the runtime selects it by feature and a known-answer probe) and #1027 (`ad0a3865`, Rules 8.22, 10.2 and 11.23, surface §38, §65 and §69). The proposal reads `implemented`, with deviations D-1 to D-7 in its record. D-2 (a fused plan keeps one text) and D-3 (`reflect().variants` is not delivered) are open. The pin `87af4eb0` holds none of it. It names `typeaudio` under `downstream`, so `scripts/downstream-impact.ts` lists it once a pin passes its implementation, and `compiler-changes.md` then records its id. At the next pin move this repository gets: the variant for a call of `peak` that is not fused (D-2), on a device that has `subgroups` and passes the probe, with the same bits and no source change; `DeviceInfo.subgroups`, the observation of the probe or `null`; `DeviceStatistics.variants`, the text (`'subgroup'` or `'tree'`) that the last call of each kernel function dispatched; and `createDevice({ subgroups: 'off' })`, which skips the probe. Nothing here is retired. Inference: while D-2 is open, the engine's block keeps the tree for `peak`, which is the last call of a fused group on WebGPU (`bun run test:gpu` prints "mixdown+drive+gain+peak (fused)"); and `explain` could name the variant that `Device.statistics` gives. |
| 0120 | `changes/0120-device-rhi.md`                 | `createDevice()` becomes the one public entry point. A `Device` keeps every member it has, and gains the operations of the program runtime (`load`, `frame`, `sampler`, `submit`, `native`, `canvas` and `draw`), over a render hardware interface that the compiler owns, with a CPU backend for the program runtime. `createRuntime()`, `runtime()`, `Runtime` and `RuntimeOptions` stay for one release with a warning, and the release after it removes them, with `configure({ runtime })`. The proposal says that a host of `createDevice()` and of entry and kernel calls sees no change, except one WebGL2 context (its open point O5).                                                                         | Accepted (#1030, `66bdb832`, 2026-11-03). Not implemented at the pin `87af4eb0` or on the compiler's `main` (read 2026-11-03). It names `typeaudio` under `downstream`: "The same search and migration as typenn", that is, a host or test that calls `createRuntime`, `runtime()` or `configure({ runtime })` moves to `createDevice()` before the release that removes them. So `scripts/downstream-impact.ts` lists it once a pin passes its implementation, and `compiler-changes.md` then records its id. One file here would change: `experiments/07-sound-match/browser.ts` calls `createRuntime`, `rt.load`, `rt.frame`, `rt.device`, `rt.tier` and `rt.destroy`, and would move to `createDevice()`, `device.load`, `device.frame`, `device.native`, `device.tier` and `device.dispose` (the proposal's migration table). No call of `runtime()` and no `configure({ runtime })` was found here (searched on 2026-11-03). The rest of this repository imports `createDevice`, `configure({ prefer })`, `resident`, `Device`, `DeviceInfo`, `DeviceStatistics`, `FuseReport`, `mergeReports` and `Resident` from `typeshade/runtime`. Of them the proposal lists `createDevice`, `configure`, `Device` and `DeviceOptions` among its reshaped exports. A proposal to watch at the next pin move.                                                                                                                                                                                                                                                     |

At the first compiler pin, `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (pull request #5), the
proposals' `status` lines read: 0108 `accepted`, 0109 `implemented`, 0110 `implemented`, 0116
`accepted`. The implementation of 0116 (#918, `9822490f`) came after the pin. So did 0108's item 4 (#937,
`f4f4b7d2`), the fixes #953, #962 and #964, and the acceptance of 0118 (#959) and of 0109's
Amendment 1 (#960).

At the second compiler pin, `87af4eb0d9d15f02b66b8341b72cab0944290472` (pull request #15), the
`status` lines of 0108, 0109, 0110, 0116 and 0118 read `implemented`. The move passed the
implementations of 0116 (#918), of 0108's item 4 (#937), of 0118 (#990, `480b6a64`) and of 0109's
Amendment 1 (#993, `87af4eb0`), and the fix #962. `compiler-changes.md` records 0109 and 0118.
The `status` line of 0119 reads `accepted` at that pin, and the pin holds no implementation of it.
The script lists 0119 once a pin passes its implementation.

## 2. The asks

Each row names the pressure, the compiler's place, the workaround this repository writes first,
and the experiment that measures it (`docs/experiments.md`). Every row is a candidate on
2026-11-02 unless its status says otherwise. `docs/vision.md`, section 9, cites D, E and F.

### A. A lane writes its own block of frames

- Pressure: a voice kernel writes `out[v * block + n]` for `n < block`, where `block` is a
  runtime `u32`. The kernel-loop proof (surface §65, rules R1 to R6) must see the write as the
  lane's own.
- Compiler: the proof's index forms (change 0095, offset forms).
- Workaround: `out` as an array of structs, one struct with a fixed array of frames per lane, so
  each lane writes one element at its own index.
- Measured by: experiment 4.
- Status: confirmed. Surface §65, rule R3, admits a write at `i*W + x` over a nested loop of `x`
  below a loop-invariant `W`, which is this form, and `docs/architecture.md` builds on it. Observed
  on 2026-11-02 at the pin `14566606` (pull request #5): `src/kernels/synth.shade.ts:38` lowers with
  a runtime `block` and no TS8070, and runs on WebGPU on SwiftShader and on the CPU tier, at 32 and
  64 lanes. Experiment 4 (`docs/records/04-additive-container.md`, the container, 2026-11-02, the
  same pin) held it at 10,000 lanes: `additive` (`experiments/04-additive/additive.shade.ts`) writes
  `out[v * block + n]` after a method call on the lane, `partials[v].retune(sweep)`, and
  `tshc check` reports no TS8070. On WebGPU it ran as one dispatch at `[64, 1, 1]` in each of the
  1,000 timed blocks; on the WebGL2 device it ran on the CPU tier, since WebGL2 takes a write at
  exactly `i` only (surface §65, "The tiers"). The bank kept its state on the device for 1,010
  blocks with no read: after them, the 10,000 phases and envelopes on WebGPU had the reference's
  bits. The workaround is not needed.

### B. A metadata channel from a class to the host

- Pressure: a unit declares a parameter's range, unit and default once. The host, the editor and
  `explain` read it as data.
- Compiler: the host face (§64). Change 0108 carries the JSDoc as text. A structured form, JSDoc
  tags read as data or a decorator that declares and never computes, is the ask.
- Workaround: TypeAudio reads the tags (`@range`, `@unit`, `@default`) out of the view text that
  0108 bakes.
- Measured by: experiment 4's `explain`, and the editor hover of the sketches in `docs/vision.md`,
  section 2.
- Status: candidate, after 0108 is implemented. Experiment 4's `explain` of a block's plan used no
  metadata of a unit: its words are the kernels' names and the compiler's `why`
  (`docs/records/04-additive-container.md`, "What explain says"). What it lacked is in the fuse
  report: each group's tier (P), its dispatches and the arrays it made (U). The editor hover and a
  parameter view, which experiment 4 did not exercise, still bear on B.

### C. The precision of the transcendentals

- Pressure: a GPU's `sin`, `cos`, `exp` and `pow` differ by driver (§38): `sin` and `cos` by up to
  2^-11 absolute for x in [-π, π], which is about 8,000 ULPs of a value near 1. An oscillator's
  phase, a filter's coefficient and an FFT's twiddles need a bound the engine can state.
- Compiler: the determinism report (§38); a common module with bounded-error forms (Rule 11.20,
  as `typeshade/algorithms` in change 0072).
- Workaround: a shader package of TypeAudio with polynomial `sin` and `cos` on a wrapped phase,
  held to the oracle.
- Measured by: experiment 3 (the FFT's twiddles) and the oscillator rows of experiment 4.
- Status: measured for the FFT's twiddles, on the container only
  (`docs/records/03-fft-container.md`, 2026-11-02, reference numbers; the owner's devices pending).
  On WebGPU and WebGL2 on SwiftShader, twiddles from `sin` and `cos` of an `f32` angle are off by up
  to 1.89e-4 (2^-12.4): inside the report's 2^-11, and about 3,200 ULPs of a value near 1. The
  transform is then off by up to 3,060 to 11,043 ULPs at its peak (relative RMS error 2.44e-4 to
  3.59e-4). With twiddles from a table computed in doubles on the host, the oracle, WebGPU and
  WebGL2 give the same bits, off by up to 1.31 to 5.14 ULPs at the peak (relative RMS error 1.14e-7
  to 1.34e-7). Twiddles from `sin` and `cos` of an emulated double (§39) reproduce the table's on
  WebGPU, except two near 0, and do not run on WebGL2 at the pin (the record's section "Refusals,
  and calls that did not return"). The workaround for the FFT is the table; the oscillator rows of
  experiment 4 stay to be measured. Compiler issue #969 (a
  bounded-error `sin`/`cos` for the device) records the ask.

### D. `f64` transcendentals on the device

- Pressure: the emulated double (§39) has `sin`, `cos`, `sqrt`, `floor`, `fract`, `mix` and the
  comparisons, and no `exp`, `tan`, `log`, `pow` or `atan2`. Coefficient design, a biquad from a
  cutoff in hertz, uses `tan` and `exp`.
- Compiler: §39 and change 0073.
- Workaround: the coefficient math runs on the host in JavaScript doubles and is uploaded as the
  two words of an `f64`.
- Measured by: experiment 4, where a voice's filter cutoff changes per block.
- Status: measured (`docs/records/04-additive-container.md`, the container, 2026-11-02, pin
  `14566606`). The engine's `Lowpass` designs its coefficients with `sin` and `cos`, and no `tan` or
  `exp`. Experiment 4 moved the cutoffs of 10,000 lowpasses every block and held the coefficients of
  the last block to the design in doubles:
  - designed on the device in `f32`, by `Lowpass` itself: on WebGPU (SwiftShader) `b0` was off by up
    to 169 % and the cutoff by up to 63.9 %, at a cutoff of 24.30 Hz (R1-webgpu, the last block's
    sweep); on the CPU tier, where `cos` is correctly rounded, by 0.577 % and 0.289 %, the
    cancellation in `1 - cos(w)` of an `f32` alone;
  - designed on the device in the emulated `f64` (`Lowpass64`, the same formulas), and designed on
    the host in doubles and written each block (the workaround): within the `f32` rounding of each
    coefficient on every tier, 2.71e-7 on `b0`, the cutoff within 1.95e-7.

  So this filter needs its design in `f64`, which §39 has, or on the host; it does not need the
  functions this row asks for. The `f64` design cost the kernel 17.4 ms of GPU time a block more
  than the host's coefficients on SwiftShader (163.055 ms against 145.610 ms, means of 1,000 blocks
  each), and with either the largest difference of WebGPU's samples from the reference fell from
  1.960e-1 to 4.858e-5. The row stays a candidate for the designs that need `tan`, `exp` or `pow`: a
  bilinear transform with a prewarped cutoff, a one-pole from a time constant, the envelope's
  `times`.

### E. Subnormals

- Pressure: a driver may flush subnormals to zero and the JavaScript oracle does not (§38). A
  filter's or a reverb's tail reaches subnormals, so the tiers disagree bit for bit there.
- Compiler: a determinism row that names the flush, or a compile option that flushes in the
  oracle too.
- Workaround: the classic anti-denormal in each unit: a tiny DC offset, or a floor on the state.
- Measured by: experiments 3 and 5, on their tails, across three tiers.
- Status: measured by experiment 3, on the container only (`docs/records/03-fft-container.md`,
  2026-11-02, reference numbers; the owner's devices pending). SwiftShader flushes subnormals on
  WebGPU and on WebGL2, where it reads them and where it writes them; the oracle and the CPU tier
  keep them. In the inverse transform of a block at 2^-110, the oracle holds 1,642 to 6,651
  subnormal values and both GPU tiers none: they flush 1,459 to 6,639 of them to 0. The forward
  transform of the same block reads its subnormal tail as 0 there, and is off by up to 249 ULPs at
  its peak (relative RMS error about 2.5e-5). At full scale no output holds a subnormal: an `f32`
  transform's error floor is about 2^-24 of its peak, so only a block that is all below about 2^-102
  gives subnormals. The determinism report names no flush. Experiment 5 measured a reverb's tail,
  on the container only (`docs/records/05-convolution-container.md`, 2026-11-02, reference numbers;
  the owner's devices pending): at full scale the last second of a 10-second convolution's tail
  holds no subnormal on any arm, and the oracle, WebGPU and WebGL2 give the same bits. For an
  impulse at 2^-112, whose tail lies across 2^-126, the oracle holds 4,216 subnormal values in the
  last second, as the reference does, and both GPU tiers none: they hold 0 where the oracle holds a
  subnormal in 4,209 (WebGPU) and 4,213 (WebGL2) values, and differ from the oracle in 48,000 and
  47,997 of the 48,000 values (relative RMS of the difference 2.46e-2). Inference: a convolution
  reverb at audible levels needs no anti-denormal; a recursive filter's state is where the engine
  meets subnormals. Compiler issue #968 (a determinism row for the flush) records the ask.

### F. A worklet build of the CPU tier

- Pressure: the `AudioWorkletGlobalScope` has no WebGPU, no dynamic `import()`, no
  `structuredClone` and no `performance`. `process()` hands its output arrays back when it
  returns, and a kernel call is asynchronous from the start (surface §65). Before experiment 2,
  this row said that the generated module does not load in the scope. Its reason was the dynamic
  import of the WebGL2 tier (`src/runtime/runtime.ts`). Record 02 shows otherwise:
  - The generated module loads and runs unchanged. It imports `typeshade/runtime/internal`, and no
    module that it imports holds a dynamic `import()`. `synth` falls to the CPU tier with the
    tiers left as they are. No bundle holds the WebGL2 tier's import.
  - The engine's `render()` does not run as it is. `fuse()` loads its planner with a dynamic
    `import()` (`src/core/fuse-record.ts`), and the scope refuses it. `dev.array()` copies an
    array of objects, a bank, with `structuredClone` (`src/core/resident.ts`), and the scope has
    none.
  - A kernel call never fills its arrays before it returns: the CPU tier runs it in a microtask.
    In Chromium 153 the samples still land in their own quantum, because the browser reads the
    output arrays after the microtask checkpoint that follows `process()`.
  - The Web Audio API specification (§2.6) copies the outputs when `process()` returns, before
    that checkpoint. So a browser that follows it plays the samples one quantum late.
- Compiler: a worklet form of the CPU tier, as a subpath of `typeshade/runtime` or an option of
  the Vite plugin. It needs three things:
  1. no dynamic `import()` on the paths a worklet reaches, the planner of `fuse()` included;
  2. no `structuredClone` in `resident()` and `dev.array()`;
  3. a call on the CPU tier that fills its arrays before it returns, for a kernel function and
     for a `fuse` plan.
- Workaround: three parts, in `experiments/02-worklet/`:
  - a bundler build that inlines the dynamic imports (`scripts/bundle.ts`, target `worklet`),
    loaded with `addModule`;
  - a copy of plain data installed as the scope's `structuredClone` (`cloneData`, `engine.ts`);
  - the lanes mixed into the output array when the call settles.
- Measured by: experiment 2.
- Status: measured (`docs/records/02-worklet-container.md`, the container, 2026-11-02, pin
  `14566606`). Every call ran on the CPU tier, and each output had the reference's bits in its
  own quantum. The device runs, and a browser other than Chromium, are pending. Item 2 is met at
  the pin `87af4eb0` (pull request #15): `resident()`, `dev.array()` and `r.write()` copy with no
  `structuredClone` (proposal 0109, Amendment 1, #993). Observed on 2026-11-02 with the `load`
  part of experiment 2 in headless Chromium 153 on SwiftShader, and kept in no record: the engine
  bundle with its dynamic imports inlined ran with no `structuredClone` installed, and 24,000 of
  24,000 frames had the reference's bits. At the pin `14566606` the same run failed at `bank()`.
  Item 1 is open: the engine bundle that keeps its dynamic imports as chunks fails at `render()`
  with `import() is disallowed on WorkletGlobalScope`, and `fuse()` still loads its planner with a
  dynamic `import()` (`src/core/fuse-record.ts`). The workaround keeps its first and third parts.
  Its second part, `cloneData`, stays in `experiments/02-worklet/` as the experiment ran it.

- Web feedback update (2026-11-06 UTC): [TypeAudio PR #22](https://github.com/typeshade/typeaudio/pull/22)
  moves the graph workaround from Web into `src/graph/compiler/`. Shared fixtures
  verify immediate output, seeded state and parameter events. [TypeShade proposal
  0122](https://github.com/typeshade/typeshade/pull/1037) requests an explicit synchronous
  CPU artifact for preallocated buffers. It is a draft. The existing compiler pin
  and the workaround remain; no adoption is recorded in `compiler-changes.md` yet.

### G. An FFT as a common module

- Pressure: the partitioned convolution, the spectral effects and the analysis need one FFT held
  to the oracle on three tiers.
- Compiler: a common module `typeshade/fft` (Rule 11.20; changes 0072 and 0076 are the
  precedent). Records 03 and 05 name four items for it:
  1. the twiddles from a table, or from an emulated double (record 03);
  2. a storage form past the 16 KiB of workgroup memory (record 03);
  3. the CPU tier of change 0092 (records 03 and 05);
  4. a real-input form (record 05, formerly its candidate ask B): 1,025 bins hold the spectrum of a
     real signal's 2,048, so the spectra and the delay line of the convolution would take 7.34 MiB
     instead of 14.66 MiB, and the multiply-accumulate would read about half as much.
- Workaround: the FFT entry lives in this repository's layer 1.
- Measured by: experiments 3 and 5.
- Status: measured by experiment 3, on the container only (`docs/records/03-fft-container.md`,
  2026-11-02, reference numbers; the owner's devices pending). The entry,
  `experiments/03-fft/fft.shade.ts`, runs on WebGPU and on WebGL2, and with the host's twiddle table
  it gives the oracle's bits for every full-scale input at 1,024 and 4,096 points, forward and
  inverse. The host's CPU tier refuses it at the pin: change 0092 is accepted and not implemented,
  so the CPU answer is the oracle's `dispatch`, 1.6 to 8.3 seconds a call. 4,096 complex points need
  32 KiB of workgroup memory, over WebGPU's 16 KiB, so the 4,096-point entry works in storage
  memory. Inference, for the owner's decision: the entry lives in layer 1 here first, as the
  workaround, and the issue for `typeshade/fft` follows the device runs. It would carry items 1 to 3
  under Compiler. Compiler issues #966 (WebGL2 does not bind the `_fp64` guard of an `f64` entry, so
  variant C never returns), #970 (an `f64` across a barrier on WebGL2) and #967 (an `f64` module
  constant, and the TS8022 that follows its refusal) record variant C's findings. #966 and #970 are
  closed on the compiler's `main` by #1003 and #1014, after the pin; their workarounds stay until
  the pin moves past them. Experiment 5, on the container only
  (`docs/records/05-convolution-container.md`, 2026-11-02, reference numbers), adds a 2,048-point
  entry in workgroup memory, 16 KiB, with the host's table, and runs it on a 10-second impulse
  response's 469 partitions and twice a block: the oracle, WebGPU and WebGL2 give the same bits for
  the 1,921,024 values of the partitions' spectra (3.09 ULPs at a transform's peak at most, relative
  RMS error 1.21e-7), and for the convolution's full-scale tail. On WebGPU on SwiftShader the two
  transforms take 4.0 and 4.7 ms of a block's 31.0 ms of GPU time at the median, the
  multiply-accumulate 18.8 ms. On WebGL2 the report counts 146 draws a block, the kernel functions on
  the CPU tier. The host's CPU tier refuses the entry, as in experiment 3. Inference: the common
  module would also carry item 4 under Compiler, the real-input form.

### H. GPU time

- Pressure: `explain` reports where a block's time goes, per node, as GPU time and not as host
  wall time that includes the queue's wait.
- Compiler: issue #542 (`timestamp-query` through `typeshade/runtime`, a timing that names its
  tier).
- Workaround: `performance.now()` around the `await` of a block's read, labelled as host time.
- Measured by: experiment 1.
- Status: partly satisfied. The fuse report carries `gpuTime` per group when the device has
  `timestamp-query` (§71, change 0066), so `explain` reports GPU time per group today. The rest
  of issue #542, a timing outside a scope and on WebGL2, stays open (raised by typeshade/radiance).

### I. The cost of many dispatches

- Pressure: a transport submits the same kernels every block, hundreds of times a second.
- Compiler: issue #543 (measure the host time per `dispatch()`, then a recorded sequence if it
  matters).
- Workaround: a block is one `fuse` scope, so the planner keeps the dispatch count low.
- Measured by: experiments 1, 4 and 6.
- Status: issue #543 open (raised by typeshade/radiance). Experiment 4
  (`docs/records/04-additive-container.md`, the container): one block of the engine's plan over
  10,000 partials is 3 dispatches in one submission on WebGPU. Summed in the tree order by one
  reduction per frame, the same block is 3,075 dispatches in one submission (1,026 groups), and its
  median block took 12,130.720 ms against 367.280 ms (SwiftShader, 5 and 1,000 timed blocks, at
  different loads). At 512 frames, where the device times the plan, its 1,539 dispatches held
  4,397.112 ms of GPU time of a mean block of 4,468.537 ms: on this container the cost of many
  dispatches is the device's, and the host and the gaps between passes took about 0.05 ms a
  dispatch. Experiment 6 measured one plan of 10 dispatches in 1 submission per block of grains:
  with no fence and no read, the host's `fuse` call took a median of 3.170 ms on WebGPU on
  SwiftShader (`docs/records/06-granular-container.md`, arm `stream`, the container, 2026-11-02).

### J. A length read inside a loop body or an index on WebGL2

- Pressure: a wavetable unit reads `table[at % table.length]`.
- Compiler: issue #689 (a kernel loop whose body reads another array's `.length` has no WebGL2
  tier) and issue #900 (the WebGL2 pass program drops the length declaration inside an index;
  fixed, in the pin `87af4eb0`).
- Workaround: the length is a `u32` parameter, and the position stays inside the table.
- Measured by: the WebGL2 arms of experiments 3 and 6.
- Status: measured at the pin `14566606` (`docs/records/03-fft-container.md`, 2026-11-02); #900 is
  answered at the pin `87af4eb0`, and #689 is open. The probe `ys[i] = xs[i % xs.length]` runs on
  WebGPU and on the CPU tier, and on WebGL2 its pass program did not compile:
  `'_phx_len_xs' : undeclared identifier`. The FFT entries read no length, since their sizes are
  module constants, and run on WebGL2. #900 is fixed by #939 (`b3bf0af8`, 2026-11-02), which the pin
  `87af4eb0` holds (pull request #15 moved the pin past it). Run again at that pin on 2026-11-03 at
  02:13 UTC, with `bun run exp:03 --tier webgl2 --sizes 1024 --variants table --repeats 1` at the
  commit `b3bf00d` (headless Chromium 153, WebGL2 through ANGLE over Vulkan on SwiftShader), the
  probe ran on WebGL2 and gave the exact result in 12 of 12 values, with no `'_phx_len_xs'` error.
  This is a smoke run and not a record: the harness runs its probes before its calls and has no
  option to drop them, so one call of the 1,024-point entry ran with the probes. #689 is open, and
  the workaround stays until it closes.
  Experiment 6 (`docs/records/06-granular-container.md`): `play` of `src/kernels/grains.shade.ts`
  reads `grains.length` in its loop body, and on WebGL2 alone it is refused with `play(): no tier
  it may use can run it (webgl2: it runs on the CPU, its GLSL did not emit: glsl-es300: arrayLength
  has no GLSL ES 3.00 spelling (no storage buffers, no runtime-sized arrays)).` The engine keeps the
  read, since its scheduler's pushes have no WebGL2 tier either.

### K. The WebAssembly tier

- Pressure: the latency-critical path (F) wants the loops of a kernel in linear memory with
  `f32x4`, bit for bit with the oracle.
- Compiler: issue #459 (the design issue) and change 0042 (opened as a draft with the issue).
- Workaround: none. TypeAudio measures the CPU tier first.
- Measured by: experiment 2, which gives the number the tier would have to beat.
- The number to beat (`docs/records/02-worklet-container.md`, one core of the container, a
  reference and not a device result). It counts voices of the engine's `Voice`, a `Saw` into a
  `Lowpass`, in one quantum of 128 frames at 48 kHz:
  - The CPU tier's kernel call reaches the quantum at about 280 voices, and half of it at about
    125. At 512 voices a quantum costs 5.02 ms.
  - A plain JavaScript loop of the same `f32` math costs 1.46 ms a quantum at 512 voices. It
    reaches half the quantum at about 465 voices.
  - A tier, or a faster CPU tier (ask S), is measured against both.
- Status: design issue open.

### L. Reverse-mode `grad`

- Pressure: a sound match over many parameters needs one backward pass, not one forward pass per
  parameter.
- Compiler: change 0056 (accepted) and issue #535 (its design issue, raised by typeshade/radiance).
  Issues #1017 (the CPU tier's code generator hands a reverse-mode loop to the interpreter; fixed on
  the compiler's `main` by #1019, `e30bbe57`, after the pin) and #1018 (the pipeline of the
  reverse-mode derivative is slow to build; open) bear on it. Record 07 names four items under this
  letter. They were its candidate asks and its needs, with no letter of their own:
  1. change 0056, step 4: a derivative on the host face and in the manifest, so that an application
     calls one without the compiler, and a GPU tier runs one without the harness's swap of
     placeholders;
  2. `grad` carries a derivative through a fixed-size local array, or change 0056's steps 3 and 4
     reach a kernel function or an entry, so that a loss can keep the render and use the FFT of
     experiment 3 over every bin, in place of 16 bins inside the frame loop;
  3. forward mode takes a direction as an argument, as the harness's `along` form writes it by
     hand, so that a GPU runs the derivative of every parameter in one dispatch;
  4. forward mode takes a matrix parameter, as reverse mode does.
- Workaround: forward-mode function-level `grad` over few parameters. The harness of experiment 7
  adds three forms: `along` (item 3), a swap of placeholders that runs a derivative on the GPU tiers
  (item 1), and the `probe`, which rewrites reverse mode's loop headers so that the CPU tier's code
  generator compiles them (issue #1017). The `probe` retires when the pin moves past `e30bbe57`.
- Measured by: experiment 7.
- Status: measured by experiment 7, on the container only
  (`docs/records/07-sound-match-container.md`, 2026-11-02, reference numbers). At the pin, change
  0056 reads `accepted` and its validation record "does not yet apply"; the compiler's changelog
  lists step 1 (#546), step 1b (#547) and slice 2a (#548) as implemented. So `grad` has a
  function-level reverse mode, loops included, and `gradCheck` holds both modes to a central
  difference (it passes on the loss of 3 parameters). A derivative reaches no host face and no
  manifest (step 4), so no application and no GPU tier calls one without the compiler; `grad` takes
  no array, struct or entry. On the CPU tier in Node, forward mode's step costs 14.4, 56.4, 197 and
  407 renders at 3, 10, 30 and 100 parameters, 2.10 to 2.91 losses for each parameter. Reverse
  mode's step moves little with the count, but its loops run in the interpreter on the CPU code
  path: 387 to 507 ms a step. Generated, as the record's probe stands for it, it costs 2.26 to 16.3
  ms and overtakes forward mode between 3 and 10 parameters in Node and between 10 and 30 in Bun
  (issue #1017, fixed on the compiler's `main` by #1019, `e30bbe57`, after the pin: the `probe`
  retires when the pin moves past it). On SwiftShader the reverse-mode pipeline took 9,850 ms to
  make at 30 parameters and was not made at 100 (issue #1018, open).

### M. A static builder on an abstract base

- Pressure: a family of units shares one builder on its abstract base,
  `static at<C extends Oscillator>(this: { new (): C }, f: f32, sr: f32): C`, so `Saw.at(110, sr)`
  builds a `Saw`. Plain TypeScript accepts it, and refuses only the call on the abstract class
  itself (TS2684).
- Compiler: `new this()` in a static member of an abstract class is TS8035 at the declaration
  ("Oscillator" is abstract, so there is no instance of it to build), with no call on the abstract
  class (surface §26, Rule 12.7). Where the base declares no abstract member, the refused `new`
  also leaves its local unbound, and each later use adds a TS8022 (Rule 12.4).
- Workaround: a non-generic `static at(f, sr)` on each concrete class (`src/units/oscillator.shade.ts`).
- Measured by: `tshc check` at the pin `14566606`. No device applies.
- Status: retired at the pin `87af4eb0` (pull request #15). The compiler fixed it on `main` by
  #962 (squash commit `20759ec9`, 2026-11-02): `new this()` in a static of an abstract class
  builds each class that extends it, and a call through the abstract class is refused with
  TS8035 on the call. `Oscillator` holds the one generic `static at`, and the `static at` of
  `Sine` and `Saw` are gone (`src/units/oscillator.shade.ts`). The fix has no proposal, so
  `compiler-changes.md` records no id. Observed at the pin: `Saw.at` and `Sine.at` build their
  own class, and a call of `Oscillator.at` is refused by the host view and at run time.

### N. A `Resident` of class instances reads back as objects of their fields

- Pressure: a bank is a `Resident` of `Voice` instances. `dev.array(instances)` types it
  `Resident<Voice[]>`, so `read()` is typed `Promise<Voice[]>`, but it resolves to plain objects of
  the fields. A call of `tick()` on what `read()` gave is a `TypeError` that `tsc` did not see.
- Compiler: Rule 8.29 names a `Resident` among the places where a class means one thing; change
  0109 makes a struct result of a helper an instance of its class. A read could do the same, or
  its type could say the fields.
- Workaround: `Bank.read()`, typed as `State<T>[]`, the fields without the methods (`src/bank.ts`).
- Measured by: `test/render.test.ts`, on the CPU tier.
- Status: retired at the pin `87af4eb0` (pull request #15). Issue #945 is answered by proposal
  0109, Amendment 1 (#960, `376f8927`, 2026-11-02, decision D5), implemented by #993
  (`87af4eb0`): a `Resident` keeps the classes of the value it was given, and `read()` returns
  instances. `Bank.read()` is `Promise<T[]>`, and the `State<T>` type is gone (`src/bank.ts`).
  `test/render.test.ts` holds a bank read back after a render to `instanceof Voice`, and ticks
  it. `compiler-changes.md` records 0109. A field whose class another file declares is still a
  plain object (ask O).

### O. A composed unit keeps its class on the host only in its own file

- Pressure: `Voice` composes a `Saw` and a `Lowpass` that other shader files declare. Its host
  view writes those fields as objects of their fields (`osc: { phase: number; inc: number }`), and
  the `protected` fields of `Lowpass` are public there. At run time the fields are plain objects,
  so `voice.osc.tick()` does not exist on the host. A unit class declared in the same file keeps
  its class: the field is an instance, with its methods and its `protected` fields.
- Compiler: surface §64, "a struct another file declares is written into it as its host type, so a
  view never imports another view".
- Workaround: none needed yet. The host reads a composed unit's state, and calls the voice's own
  methods.
- Measured by: `test/units.test.ts` and the views `tshc sync` writes at the pin `14566606`.
- Status: candidate.

### P. The tier of each group in a fuse report

- Pressure: `explain` says where each node ran. On WebGL2 a call that WebGL2 has no program for
  falls to the CPU tier, and its group says nothing: a group carries no tier, and
  `workgroupShapes` is absent on WebGL2 and on the CPU tier alike.
- Compiler: `FuseReport` (surface §71).
- Workaround: `explain` says "on WebGL2 or the CPU tier" for such a group (`src/explain.ts`).
- Measured by: `docs/records/01-round-trip-container.md`: on WebGL2, `synth` and `peak` fall to the
  CPU tier, and the report does not say so. `docs/records/06-granular-container.md`: on a device
  that opened on WebGL2, all six calls of a block of grains fell to the CPU tier; the report's tier
  is `cpu`, and no group says why.
- Status: retired at the pin `87af4eb0` (pull request #15). Issue #946 is answered by proposal
  0118 (#959, `6c1799ec`, 2026-11-02, D1 to D3), implemented by #990 (`480b6a64`): each group
  carries `tier`, and a group below its plan's tier says why in `why`. `explain` reads both
  (`src/explain.ts`): it names a group that did not run on WebGPU "on WebGL2" or "on the CPU
  tier", and prints its `why` under it. `compiler-changes.md` records 0118. Observed at the pin on
  WebGL2, in headless Chromium on SwiftShader: `synth` and `peak` ran on the CPU tier, and their
  `why` says so, with "runs on the CPU" twice (the open deviation D-1 of the proposal's record).

### Q. A pin that Node loads

- Pressure: the source tarball of a commit holds TypeScript sources and no `dist/`. Node does not
  strip types under `node_modules`, so `tshc` (`src/cli/bin.ts`) and the Vite plugin do not load in
  Node: `bun install` failed in `prepare` with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
  `typeshade/shade` (`dist/shade.d.ts`) is absent, so the README's `tsconfig.shade.json` does not
  work with this pin.
- Compiler: the pin forms of change 0071 (decision D6) and the package's `exports`.
- Workaround: the scripts run on Bun's runtime (`bunfig.toml`, `bun --bun tshc sync`), and the
  shader modules are checked with `tshc check`. TypeNN bundles its Vite configuration with
  esbuild instead.
- Measured by: `bun install` with Node v22.23.4 on PATH, 2026-11-02.
- Status: issue #947. The workaround stays until the pin moves past the fix.

### R. A method's comment in the host view

- Pressure: a unit's methods carry its documentation (`hz`, `set`, `tick`). At the pin `14566606`
  the host view copies the comment of a class and of its fields, and not the comment of a
  constructor, a method or an accessor, so the editor's hover on `osc.hz(...)` shows no words.
- Compiler: proposal 0108, Amendment 1, item 4: the members of an exported class carry their
  comments (its decision D4). Not a new ask.
- Workaround: none. The comments stayed in the `.shade.ts` files until the pin moved past item 4.
- Measured by: the views `tshc sync` writes at the pin `14566606`, and again at the pin
  `87af4eb0`.
- Status: retired at the pin `87af4eb0` (pull request #15 moved the pin past #937). Proposal 0108 is
  implemented: item 4 by #937 (`f4f4b7d2`, 2026-11-02). Amendment 2 (#978, `a80551b4`) drops the
  static field from item 4's list. Observed at the pin: the generated
  `src/units/oscillator.shade.typeshade.ts` carries the comment of each member of `Oscillator`,
  `Sine` and `Saw` (`hz`, `tick` and the static `at`). Inference: the editor's hover on
  `osc.hz(...)` shows these words; no hover was run. `compiler-changes.md` records no id, since
  proposal 0108 does not name `typeaudio` under `downstream`.

### S. The cost of the CPU tier's generated code

- Pressure: in a worklet, the CPU tier is the latency-critical path (F), so its speed sets the
  voice count. The kernel call takes 3.4 times as long as the plain-JavaScript reference of the
  tests, for the same `f32` math. At 512 voices a quantum costs 5.02 ms against 1.46 ms (record
  02). The generated code returns the `inout` values of each method call in a new array
  (`$.inout.values = [...]`). `Voice.tick` makes three such calls per voice and per sample. The
  other threads of the browser spent 89 ms of CPU time a second of audio at 512 voices. For the
  plain loop they spent 5 ms (inference: the garbage collector).
- Compiler: the CPU tier's code generator (Rule 11.7, surface §64): `inout` values without an
  allocation per call.
- Workaround: none. The engine adds no second implementation (`docs/architecture.md`, section 1).
- Measured by: experiment 2.
- Status: issue #961. Measured on the container only (`docs/records/02-worklet-container.md`). The
  cost of entering a call with an array, which record 05 measured on the CPU tier (its candidate ask
  C), is ask V's and not this ask's.

### T. A sum over the lanes of each frame on the GPU

- Pressure: a bank's lanes are summed into one block every block: 10,000 partials into 1,024 frames.
  The engine's `mixdown` gathers: one invocation per frame adds the lanes one after another, 1,024
  invocations of 10,000 additions in 4 workgroups of 256. The language's two forms of a sum in the
  tree order of Rule 7.2 do not run as one dispatch on the GPU:
  - a reduction per frame, `sumFrame`, one call per frame: 3,075 dispatches per block (record 04: a
    median block of 12,130.720 ms on SwiftShader, against 367.280 ms for the gather);
  - the form an author writes, `out[n] += lanes[v * block + n]` over the lanes
    (`experiments/04-additive/sums.shade.ts:29`), which the proof refuses for the GPU (TS8070):
    "This loop runs on the CPU because line 29 writes "out[n]", an element two iterations can share.
    Write at an index made from "v"." On WebGPU it runs on the CPU tier (a median block of
    5,407.840 ms).
- Compiler: surface §65, "An `f32` scatter": "WebGPU and WebGL2 do not lower it yet, so the compiler
  still reports `TS8070` for the loop" (change 0056, slice 2a); or a reduction into each element of
  an array over a two-dimensional range.
- Workaround: the engine's `mixdown` (shape G). For the same lanes, record 04 found its sum the same
  bits on every tier.
- Measured by: experiment 4 (`docs/records/04-additive-container.md`, the container).
- Status: issue #991, open.

### U. The dispatches and the arrays of each group of a fuse report

- Pressure: `explain` says what each group of a block's plan costs. A group of the report has no
  count of its dispatches: a reduction's folds and the entry that stores after a loop add no
  `workgroupShapes` triple (surface §71). In record 04's `tree` plan each of the 1,024 `sumFrame`
  groups lists one triple and makes three dispatches, and `explain` says "1 dispatch"
  (`src/explain.ts`, the function `where`). A group does not say which scratch arrays it held as
  locals and which the plan made as buffers: in the engine's plan the 40,960,000-byte `lanes` is a
  new device buffer in every block (`ScratchState.release`, `src/core/fuse-record.ts:275` of the
  pin), and the report is silent. `docs/architecture.md`, section 3, sketches an `explain` that
  names the locals.
- Compiler: `FuseReport` (§71). Proposal 0118 (accepted, #959) gives each group its tier (P); this
  is the rest of what `explain` reads.
- Workaround: none. `explain` gives the plan's dispatches in its totals.
- Measured by: experiment 4 (`docs/records/04-additive-container.md`, the container).
- Status: issues #985 (the dispatches of each group) and #992 (the scratch arrays), open. Ask U asks
  for the same count and the arrays; ask Y adds record 06's evidence.

### V. The CPU tier's cost of entering a call with a long array

- Pressure: on the CPU tier, a block of the engine is a few kernel calls over a scratch array of
  10,240,000 lanes. The CPU tier converts every array a call takes into a plain array, element by
  element, and writes every array the call writes back the same way (`toCpu` and `fromCpu`,
  `src/core/host-entry.ts:564` of the pin, called for each array parameter by `onCpu`,
  `src/core/host-kernel.ts:1888`). In record 04, one block of `tree`, 1,024 calls of `sumFrame` that
  each read 10,000 of the 10,240,000 lanes, took 316,073.214 ms on the CPU tier, about 0.31 s a
  call; one block of `scatter`, one call over the same lanes, took 9,286.553 ms.
- Compiler: the CPU tier's call (Rule 11.7, surface §65): the generated code reading the caller's
  typed array in place, with no copy per call.
- Workaround: none. The engine's plan keeps the calls of a block few.
- Measured by: experiments 4 and 5 (`docs/records/04-additive-container.md` and
  `docs/records/05-convolution-container.md`, the container). That the conversion is the cost is an
  inference from the source; the runs do not time it apart.
- Status: candidate. Ask S (issue #961) is the cost of the generated code inside a call; this is the
  cost of entering it. Experiment 5 (record 05, section "The kernel check"; it was candidate ask C
  of that record) measured the same cost on the CPU tier in Node, on host arrays: `store` writes
  2,048 of the delay line's 960,512 points in 962.1 ms, and `pad` writes 1,024 points of a
  2,048-point array in 5.2 ms, while the oracle's `fns`, given the values in its own form, takes
  0.19 ms for the same `store`. Inference of the record: the time follows the arrays' length, not
  the work; a large `Resident` on the CPU tier (a delay line, a bank) may cost the same on each
  call. The run measured host arrays only.

### W. A loop that pushes over a range the device holds

- Pressure: a schedule on the device keeps a list whose count stays there. Each block the grains
  that still sound move to the head of the next list, a stream compaction, which a loop that pushes
  is. The loop's own range is the list's count, `count[0]`, which only the device holds.
- Compiler: surface §65, "A trip count read from an array": "In this version a loop over such a
  range that pushes [...] run[s] the whole function on the CPU". A probe of `cull` whose loop runs
  to `const n: u32 = count[0]`, compiled with the pinned compiler's `hostFace`, gave the reason:
  `loop 1 pushes onto "next" over a trip count it reads from an array, and the call sizes the counts
  of a push from a trip count the host knows`.
- Workaround: `cull` (`src/kernels/grains.shade.ts`, line 21) loops over the list's capacity,
  `grains.length`, and tests `g < count[0]` in its body; it then runs on WebGPU.
- Measured by: experiment 6 (`docs/records/06-granular-container.md`): over a capacity of 2,048
  and a median of 814 grains, `cull` took a mean of 0.807 ms of a block's 10.727 ms of GPU time.
- Status: issue #984, open. Measured on the container only.

### X. A write at an offset the host passes, `out[at + n]`

- Pressure: a block written into a longer array from a frame the host passes: a tape, a ring, the
  write of a delay line.
- Compiler: surface §65, rule R3, admits a write "at one index whose coefficient of `i` is
  loop-invariant". The proof finds that coefficient only in a product (`scaledCoefficient`, line
  1086 of `src/core/passes/parallel-loop.ts` at the pin `14566606`). A probe whose loop writes
  `tape[at + n] = block[n]` gets TS8070: `This loop runs on the CPU because line 5 writes "tape[at +
  n]", an element two iterations can share. Write at an index made from "n".` `tape[n + at]` gets
  the same; `tape[n * 1 + at]` and `tape[at + n * stride]` lower.
  Compiler issue #983 records the ask. #994 (`3b7019da`) fixed it, and the pin `87af4eb0` holds the
  fix.
- Workaround: `keep` (`experiments/06-granular/measure.shade.ts`, line 16) writes `tape[n * 1 + at]`.
  Experiment 5's `store` (`experiments/05-convolution/convolution.shade.ts`) writes
  `line[j * 1 + slot * POINTS]` for the same reason.
- Measured by: `tshc check` and the faces at the pin `14566606`; experiment 6 runs the workaround on
  WebGPU, fused with `play`. Experiment 5 (`docs/records/05-convolution-container.md`, section
  "Refusals, and calls that did not return") met the same refusal for `line[slot * POINTS + j]` and
  `line[offset + j]` in `store`. `tshc check` again at the pin `87af4eb0`, on 2026-11-03.
- Status: answered at the pin `87af4eb0`, and not retired. Compiler issue #983 is closed by #994
  (`3b7019da`, 2026-11-02), which the pin holds. Observed at the pin on 2026-11-03 at 02:16 and
  02:32 UTC, with `tshc check` on scratch modules outside this repository: the loops that write
  `tape[at + n]`, `line[slot * POINTS + j]` and `line[offset + j]` draw no TS8070 ("No problems
  found in 1 file"). The check shows that the front end admits the form. A run of the loop on a GPU
  at the pin was not made. The workarounds stay in the code, in
  `experiments/06-granular/measure.shade.ts` and in
  `experiments/05-convolution/convolution.shade.ts`. They are code, and their retirement goes in a
  pull request of its own.

### Y. The dispatches of each group in a fuse report

- Pressure: `explain` says how many dispatches each node of a block costs.
- Compiler: `FuseReport` (surface §71) counts `dispatches` for the whole plan. A group's
  `workgroupShapes` holds one triple for a loop that pushes, which runs as count, scan and store,
  and none for the stores after a function's loops.
- Workaround: none. `explain` (`src/explain.ts`, the function `where`) counts a group's triples as
  its dispatches, so it prints "1 dispatch" for `cull` and "0 dispatches" for each `tally` of a
  plan whose report counts 10 (`docs/records/06-granular-container.md`, "How the plan ran").
- Measured by: experiment 6, the fuse report of each block on WebGPU.
- Status: issue #985, open. Ask U asks for the same count and the arrays; ask Y adds record 06's
  evidence. The wording of `explain` for such a group is open in this repository.

### Z. A plan's GPU time without a read of each plan

- Pressure: a real-time transport submits blocks ahead and reads nothing back per block. On a
  device with `timestamp-query`, each plan maps its timestamps back before `fuse` resolves, so the
  host waits for the GPU on every block.
- Compiler: surface §71, "The GPU time" (change 0066). The flush of a plan maps the timestamps
  before it resolves (`src/core/host-entry.ts` at the pin, line 1920). Ask H is the GPU time itself.
- Workaround: a device requested without `timestamp-query` and passed as `createDevice({ device })`
  (`experiments/06-granular/browser.ts`, line 40): no plan maps anything back, and no group has
  `gpuTime`.
- Measured by: experiment 6, arms `stream` and `stamped` on WebGPU
  (`docs/records/06-granular-container.md`): without the feature, 0 device reads over 1,000 blocks
  and a median `fuse` call of 3.170 ms; with it, 1,000 reads and 16.030 ms.
- Status: issue #986, open. Measured on the container only.

### AA. WebGL2 loops for a kernel that writes a `vec2` element, writes off its counter, or writes two arrays

- Pressure: the partitioned convolution has four kernel functions, `pad`, `store`, `accumulate` and
  `overlapAdd`. Each is a loop that writes an element of `array<vec2>`, writes at an index other
  than its counter, or writes two arrays. None has a WebGL2 program at the pin `14566606`. On a
  device that prefers `['webgl2', 'cpu']` they run on the CPU tier, and a block takes 5,580.98 ms at
  the median (10 blocks) against a budget of 21.33 ms.
- Compiler: the WebGL2 tier's loop forms (surface §65, "The tiers"): a draw that writes the two words
  of a `vec2` element, writes at `i + c`, or writes several arrays as several render targets.
- Workaround: none. The four calls run on the CPU tier, and the FFT entry runs on WebGL2.
- Measured by: experiment 5 (`docs/records/05-convolution-container.md`, sections "Refusals, and calls
  that did not return" and "The numbers").
- Status: measured by experiment 5, on the container only (2026-11-02, pin `14566606`, reference
  numbers; the owner's devices pending). The record keeps each refusal word for word. `pad()` and
  `accumulate()` write an element that is not one `f32`, `i32` or `u32`. `store()` writes "line"
  other than at `i`. `overlapAdd()` "writes more than one array, and WebGL2 draws one". Record 04
  (ask A: `additive` writes at `v * block + n`) and record 06 (`keep` writes "tape" other than at
  `i`) met the same limit. It was not run again at the pin `87af4eb0`. This ask was candidate ask A
  of record 05.

## 3. Issues raised on the compiler

The issues found while the proposals were implemented, on 2026-11-02, the issues the first code
raised (pull request #5, asks M, N, P and Q), the issues experiments 2 and 3 raised (asks S, C and
E, and the FFT's findings under G), the issues experiments 4 to 7 raised (#983 to #986, #991, #992,
#997, #998, #1017 and #1018), and the earlier issues the asks cite.

The states are those of 2026-11-03, at the pin `87af4eb0`.

| Issue | Title, shortened                                                                                                     | Bears on                                                                   | Status                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| #900  | The WebGL2 pass program drops `_phx_len_table` for a length read inside an index                                     | J                                                                          | Fixed by #939 (`b3bf0af8`), in the pin `87af4eb0`                                                                         |
| #901  | The commit-msg hook reads a merge against its first parent                                                           | The implementing pull requests, not the engine                             | Closed: fixed by #932 and #956                                                                                            |
| #908  | TS8070 names a static function by its emitted name                                                                   | The refusal's wording for a unit's static helper                           | Fixed on `main` by #953 (`a659ae36`)                                                                                      |
| #689  | A kernel loop that reads another array's `.length` has no WebGL2 tier                                                | J                                                                          | Open                                                                                                                      |
| #459  | A WebAssembly tier between WebGL2 and the CPU                                                                        | K, F                                                                       | Open; change 0042 draft                                                                                                   |
| #535  | Reverse-mode `grad` before 1.0                                                                                       | L                                                                          | Open; change 0056 accepted                                                                                                |
| #539  | A stable sort of `u32` keys with values on every tier                                                                | Experiment 6: one cloud's grains need no sort                              | Open                                                                                                                      |
| #542  | GPU time through `typeshade/runtime`                                                                                 | H                                                                          | Open                                                                                                                      |
| #543  | The cost of many dispatches                                                                                          | I                                                                          | Open                                                                                                                      |
| #944  | `new this()` in a static builder of an `abstract` class is refused (TS8035)                                          | M                                                                          | Closed: fixed by #962 (`20759ec9`), in the pin `87af4eb0`; ask M retired                                                  |
| #945  | `read()` of a `Resident` of class instances returns plain objects                                                    | N                                                                          | Open; answered by 0109 Amendment 1 (#960), implemented by #993 (`87af4eb0`), in the pin; ask N retired                    |
| #946  | The fuse report names the plan's best tier but not the tier of each group                                            | P                                                                          | Open; answered by change 0118 (#959), implemented by #990 (`480b6a64`), in the pin; ask P retired                         |
| #947  | A source tarball pin has no `dist/`: `tshc` and the Vite plugin fail under Node                                      | Q                                                                          | Open                                                                                                                      |
| #961  | The CPU tier allocates an array for the `inout` values of every method call                                          | S                                                                          | Open                                                                                                                      |
| #966  | WebGL2 does not bind the `_fp64` guard of an `f64` entry; the call never returns                                     | G (variant C), D                                                           | Closed: fixed on `main` by #1003 (`92c3d2ff`), after the pin; the workaround stays until the pin moves past it            |
| #967  | An `f64` module constant is refused, with a misleading TS8022 after it                                               | G (variant C), D                                                           | Open                                                                                                                      |
| #968  | The determinism report has no row for subnormal flushing                                                             | E                                                                          | Open                                                                                                                      |
| #969  | A device's `sin`/`cos` may use all of the 2^-11 bound; a bounded-error form                                          | C                                                                          | Open                                                                                                                      |
| #970  | WebGL2 refuses an `f64` local kept across a barrier                                                                  | G (variant C), D                                                           | Closed: fixed on `main` by #1014 (`130c4bf9`), after the pin; the workaround stays until the pin moves past it            |
| #983  | The kernel-loop proof refuses a write at `tape[at + n]` (TS8070) where `tape[n * 1 + at]` lowers                     | X (experiments 5 and 6)                                                    | Closed: fixed by #994 (`3b7019da`), in the pin `87af4eb0`; the workarounds stay in the code                               |
| #984  | A loop that pushes over a range the device holds runs the whole function on the CPU tier                             | W                                                                          | Open                                                                                                                      |
| #985  | `FuseReport.dispatches` counts 10 for a plan whose groups' `workgroupShapes` show 3                                  | U and Y (the count of dispatches)                                          | Open                                                                                                                      |
| #986  | A plan on a device with `timestamp-query` maps its timestamps back before it resolves                                | Z                                                                          | Open                                                                                                                      |
| #991  | A per-frame sum over lanes in the tree order has no GPU form                                                         | T                                                                          | Open                                                                                                                      |
| #992  | A scratch array of a `fuse` scope is destroyed after every plan, so a stream re-creates it each block                | U (the arrays of a group)                                                  | Open                                                                                                                      |
| #997  | The call's read check refuses a guarded read that stays inside the array (a `TypeError`; `tshc check` says nothing)  | Experiment 5 (record 05, candidate issue 1): the guarded `pad`             | Open; pull request #1029 open                                                                                             |
| #998  | A queued call runs on the output of a call that failed                                                               | Experiment 5 (record 05, candidate issue 2): a block that queues its calls | Open; a decision on the queue after a failed call (propagate the error: a proposal; or document it)                       |
| #1017 | `compileModuleJs` runs a reverse-mode derivative with a loop in the interpreter                                      | L                                                                          | Fixed on `main` by #1019 (`e30bbe57`), after the pin; the `probe` form of experiment 7 retires when the pin moves past it |
| #1018 | The pipeline of a reverse-mode derivative with a frame loop grows past usable with the parameter count (SwiftShader) | L                                                                          | Open                                                                                                                      |

## 4. How a row moves

1. Write the workaround in this repository, in the unit it belongs to or under `experiments/`.
2. Run the experiment on a device.
3. Write the record: the command, the date, the commit, the pin, the device and the numbers.
4. Set the row's status to `measured`, with the record's id.
5. Raise the general part on `typeshade/typeshade` as an issue that asks for compiler work.
6. State the need, the workaround and the record's id in the issue.
7. Set the row's status to `issue #N`.
8. When the compiler side fixes the issue, set the status to `fixed #N`.
9. Ask for a proposal only when the compiler side finds that compiler work cannot meet the need.
10. When the fix or the proposal is implemented, move the pin.
11. Record a proposal's id in `compiler-changes.md` when it names `typeaudio` under `downstream`.
12. Retire the workaround. Set the status to `retired`.
