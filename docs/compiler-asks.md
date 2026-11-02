# Compiler asks

This document is the ledger of what TypeAudio rests on in the compiler and what it asks of it.
The compiler is `typeshade/typeshade`. Its proposals live in its `changes/` directory, and
`changes/README.md` there is the process. `compiler-changes.md` at the root of this repository is
the other record: it lists the proposals this repository has handled, when the compiler pin
moves.

The loop is `docs/vision.md`, section 10. A row moves through these states:

| State                                        | Meaning                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| candidate                                    | The pressure is named. Nothing is measured.                                                          |
| measured                                     | A workaround exists here. A record names the device, the date, the commit and the numbers.           |
| issue #N                                     | The general part is raised on `typeshade/typeshade`.                                                 |
| proposal NNNN (draft, accepted, implemented) | The lifecycle state of the compiler proposal, as its `status` line says.                             |
| retired                                      | The pin moved past the implementation, `compiler-changes.md` records the id, the workaround is gone. |

The letters and the ids are stable. A new ask takes the next free letter. A row never changes
its letter.

## 1. The proposals this engine rests on

Five proposals were drafted and accepted on 2026-11-02, in the session that wrote the design.
Four shape the host face a unit shows the developer (`docs/vision.md`, section 8, "The host
face"), and one the fuse report that `explain` reads.

| Id   | Proposal                            | What it gives TypeAudio                                                                                                                                                                                                                | Status on 2026-11-02                                                                                                                                                                                                                                                                                                                                         |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0108 | `changes/0108-host-view-jsdoc.md`   | The host view carries the author's JSDoc verbatim, so a unit's documentation reaches the editor through the host face.                                                                                                                 | Implemented: items 1 to 3 by #887 (`77ced44`, 2026-11-02), the inherited-field deviation closed by its record; Amendment 1 accepted (#915, `bb82036b`) and item 4, the members of an exported class carry their comments (decision D4), implemented by #937 (`f4f4b7d2`, 2026-11-02). Amendment 2 (#978, approved 2026-11-02, merge pending) drops the static field from item 4's list, since the view declares none.                                                                                |
| 0109 | `changes/0109-host-classes.md`      | An exported class is a value of the host face: `new` and the methods run on the CPU tier, an instance is the struct's host value, a struct result is an instance. The engine's `new OnePole(0.1)` on the host rests on it.             | Implemented (#890, squash commit `9dbc298`, 2026-11-02). Two deviations open in the proposal's record: the view's flat declaration where TypeScript refuses an override; a mixin's members untested. Amendment 1 approved (#960, `376f8927`, 2026-11-02, decision D5): item 6, a `Resident` made from instances keeps their classes and `read()` returns instances (ask N); its implementation is not started.                                                                                                                                                         |
| 0110 | `changes/0110-class-consistency.md` | Rule 8.29: a class is its struct and its functions in every place a struct or a function can be. The class arm of the differential gate holds a method to one result in a compute entry, a kernel loop, the host class and the oracle. | Implemented (#883, `bef6574`, 2026-11-02), with the host leg of the class arm on the host class of 0109; the deferral deviation is closed by its record.                                                                                                                                                                                                     |
| 0116 | `changes/0116-host-type-family.md`  | `typeshade/runtime` exports a family of host types spelled as the shader spells them (`f32`, `vec3`, `array<f32>`), so the host view reads as the `.shade.ts` file does. Renumbered from 0111 (#884, `c33f743`).                       | Implemented (#918, `9822490f`, 2026-11-02) with Amendment 1 (#925, `334b9fc4`), which declared the twenty exports of the common modules and §74 and decided D7 to D10: a struct is spelled by its name and an exported class as the class, a struct binding by its name beside its packed forms, \1| 0118 | `changes/0118-fuse-group-tier.md` | Each group of a `FuseReport` carries the tier it ran on, and a group below its plan's tier says why in its `why`, so `explain` reads where each node ran instead of inferring it (ask P). | Accepted (#959, `6c1799ec`, 2026-11-02) with D1 to D3 as drafted: `tier` on every group; the reason in `why`; the call layer's own text. Its implementation is not started. |\n
At the first compiler pin, `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (pull request #5), the
proposals' `status` lines read: 0108 `accepted`, 0109 `implemented`, 0110 `implemented`, 0116
`accepted`. The implementation of 0116 (#918, `9822490f`) came after the pin. So did 0108's item 4 (#937,
`f4f4b7d2`), the fixes #953, #962 and #964, and the acceptance of 0118 (#959) and of 0109's
Amendment 1 (#960).

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
  on 2026-11-02 at the pin `14566606` (pull request #5): `src/kernels/synth.shade.ts:38` lowers
  with a runtime `block` and no TS8070, and runs on WebGPU on SwiftShader and on the CPU tier, at
  32 and 64 lanes. This answers experiment 4's first question; experiment 4 holds the form at
  10,000 lanes.

### B. A metadata channel from a class to the host

- Pressure: a unit declares a parameter's range, unit and default once. The host, the editor and
  `explain` read it as data.
- Compiler: the host face (§64). Change 0108 carries the JSDoc as text. A structured form, JSDoc
  tags read as data or a decorator that declares and never computes, is the ask.
- Workaround: TypeAudio reads the tags (`@range`, `@unit`, `@default`) out of the view text that
  0108 bakes.
- Measured by: experiment 4's `explain`, and the editor hover of the sketches in `docs/vision.md`,
  section 2.
- Status: candidate, after 0108 is implemented.

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
  experiment 4 stay to be measured\1 Compiler issue #969 (a\n  bounded-error `sin`/`cos` for the device) records the ask.\n\n### D. `f64` transcendentals on the device

- Pressure: the emulated double (§39) has `sin`, `cos`, `sqrt`, `floor`, `fract`, `mix` and the
  comparisons, and no `exp`, `tan`, `log`, `pow` or `atan2`. Coefficient design, a biquad from a
  cutoff in hertz, uses `tan` and `exp`.
- Compiler: §39 and change 0073.
- Workaround: the coefficient math runs on the host in JavaScript doubles and is uploaded as the
  two words of an `f64`.
- Measured by: experiment 4, where a voice's filter cutoff changes per block.
- Status: candidate.

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
  gives subnormals. The determinism report names no flush. Experiment 5 measures a reverb's tail\1 Compiler issue #968 (a\n  determinism row for the flush) records the ask.\n\n### F. A worklet build of the CPU tier

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
  own quantum. The device runs, and a browser other than Chromium, are pending.

### G. An FFT as a common module

- Pressure: the partitioned convolution, the spectral effects and the analysis need one FFT held
  to the oracle on three tiers.
- Compiler: a common module `typeshade/fft` (Rule 11.20; changes 0072 and 0076 are the
  precedent).
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
  workaround, and the issue for `typeshade/fft` follows the device runs. It would carry the twiddles
  from a table or an emulated double, a storage form past workgroup memory, and the CPU tier of
  change 0092\1 Compiler issues #966 (WebGL2 does\n  not bind the `_fp64` guard of an `f64` entry, so variant C never returns), #970 (an `f64` across\n  a barrier on WebGL2) and #967 (an `f64` module constant, and the TS8022 that follows its\n  refusal) record variant C's findings.\n\n### H. GPU time

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
- Measured by: experiments 1 and 4.
- Status: issue #543 open (raised by typeshade/radiance).

### J. A length read inside a loop body or an index on WebGL2

- Pressure: a wavetable unit reads `table[at % table.length]`.
- Compiler: issue #689 (a kernel loop whose body reads another array's `.length` has no WebGL2
  tier) and issue #900 (the WebGL2 pass program drops the length declaration inside an index).
- Workaround: the length is a `u32` parameter, and the position stays inside the table.
- Measured by: the WebGL2 arm of experiment 3.
- Status: measured at the pin (`docs/records/03-fft-container.md`, 2026-11-02). The probe
  `ys[i] = xs[i % xs.length]` runs on WebGPU and on the CPU tier, and on WebGL2 its pass program
  does not compile: `'_phx_len_xs' : undeclared identifier`. The FFT entries read no length, since
  their sizes are module constants, and run on WebGL2. #900 is fixed on the compiler's `main` by
  #939 (`b3bf0af8`), after the pin; the workaround stays until the pin moves past it. #689 is open.

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
- Compiler: change 0056 (accepted) and issue #535 (its design issue, raised by
  typeshade/radiance).
- Workaround: forward-mode function-level `grad` over few parameters.
- Measured by: experiment 7.
- Status: proposal accepted in the compiler. Its implementation state is read from
  `changes/0056-reverse-mode-grad.md` when experiment 7 starts.

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
- Status: fixed on the compiler's `main` by #962 (squash commit `20759ec9`, 2026-11-02): `new
  this()` in a static of an abstract class builds each class that extends it, and a call through
  the abstract class is refused with TS8035 on the call. The workaround stays until the pin moves
  past it.

### N. A `Resident` of class instances reads back as objects of their fields

- Pressure: a bank is a `Resident` of `Voice` instances. `dev.array(instances)` types it
  `Resident<Voice[]>`, so `read()` is typed `Promise<Voice[]>`, but it resolves to plain objects of
  the fields. A call of `tick()` on what `read()` gave is a `TypeError` that `tsc` did not see.
- Compiler: Rule 8.29 names a `Resident` among the places where a class means one thing; change
  0109 makes a struct result of a helper an instance of its class. A read could do the same, or
  its type could say the fields.
- Workaround: `Bank.read()`, typed as `State<T>[]`, the fields without the methods (`src/bank.ts`).
- Measured by: `test/render.test.ts`, on the CPU tier.
- Status: issue #945; proposal 0109, Amendment 1 (#960, `376f8927`, 2026-11-02, decision D5): a
  `Resident` keeps the classes of the value it was given, and `read()` returns instances. Its
  implementation is not started. The workaround stays until the pin moves past it.

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
  CPU tier, and the report does not say so.
- Status: issue #946; proposal 0118 accepted (#959, `6c1799ec`, 2026-11-02, D1 to D3): each group
  carries `tier`, and a group below its plan's tier says why in `why`. Its implementation is not
  started. The workaround stays until the pin moves past it.

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

- Pressure: a unit's methods carry its documentation (`hz`, `set`, `tick`). At the pin the host
  view copies the comment of a class and of its fields, and not the comment of a constructor, a
  method or an accessor, so the editor's hover on `osc.hz(...)` shows no words.
- Compiler: proposal 0108, Amendment 1, item 4: the members of an exported class carry their
  comments (its decision D4). Not a new ask.
- Workaround: none. The comments stay in the `.shade.ts` files until the pin moves past item 4.
- Measured by: the views `tshc sync` writes at the pin `14566606`.
- Status: proposal 0108 implemented: item 4 by #937 (`f4f4b7d2`, 2026-11-02). Amendment 2 (#978)
  drops the static field from item 4's list, approved, merge pending. The comments reach the view
  when the pin moves past #937.

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
- Status: issue #961. Measured on the container only (`docs/records/02-worklet-container.md`).

## 3. Issues raised on the compiler

The issues found while the proposals were implemented, on 2026-11-02, the issues the first code
raised (pull request #5, asks M, N, P and Q), the issues experiments 2 and 3 raised (asks S, C and
E, and the FFT's findings under G), and the earlier issues the asks cite.

| Issue | Title, shortened                                                                 | Bears on                                         | Status                                 |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| #900  | The WebGL2 pass program drops `_phx_len_table` for a length read inside an index | J                                                | Fixed on `main` by #939, after the pin |
| #901  | The commit-msg hook reads a merge against its first parent                       | The implementing pull requests, not the engine   | Closed: fixed by #932 and #956         |
| #908  | TS8070 names a static function by its emitted name                               | The refusal's wording for a unit's static helper | Fixed on `main` by #953 (`a659ae36`)   |
| #689  | A kernel loop that reads another array's `.length` has no WebGL2 tier            | J                                                | Open                                   |
| #459  | A WebAssembly tier between WebGL2 and the CPU                                    | K, F                                             | Open; change 0042 draft                |
| #535  | Reverse-mode `grad` before 1.0                                                   | L                                                | Open; change 0056 accepted             |
| #539  | A stable sort of `u32` keys with values on every tier                            | Experiment 6, if the grain order must be stable  | Open                                   |
| #542  | GPU time through `typeshade/runtime`                                             | H                                                | Open                                   |
| #543  | The cost of many dispatches                                                      | I                                                | Open                                   |
| #944  | `new this()` in a static builder of an `abstract` class is refused (TS8035)      | M                                                | Fixed on `main` by #962 (`20759ec9`)   |
| #945  | `read()` of a `Resident` of class instances returns plain objects                | N                                                | Open; 0109 Amendment 1 approved (#960) |
| #946  | The fuse report names the plan's best tier but not the tier of each group        | P                                                | Open; change 0118 accepted (#959)      |
| #947  | A source tarball pin has no `dist/`: `tshc` and the Vite plugin fail under Node  | Q                                                | Open                                   |
| #961  | The CPU tier allocates an array for the `inout` values of every method call      | S                                                | Open                                   |
| #966  | WebGL2 does not bind the `_fp64` guard of an `f64` entry; the call never returns | G (variant C), D                                 | Open                                   |
| #967  | An `f64` module constant is refused, with a misleading TS8022 after it           | G (variant C), D                                 | Open                                   |
| #968  | The determinism report has no row for subnormal flushing                         | E                                                | Open                                   |
| #969  | A device's `sin`/`cos` may use all of the 2^-11 bound; a bounded-error form      | C                                                | Open                                   |
| #970  | WebGL2 refuses an `f64` local kept across a barrier                              | G (variant C), D                                 | Open                                   |

## 4. How a row moves

1. Write the workaround in this repository, in the unit it belongs to or under `experiments/`.
2. Run the experiment on a device.
3. Write the record: the command, the date, the commit, the pin, the device and the numbers.
4. Set the row's status to `measured`, with the record's id.
5. Raise the general part as an issue on `typeshade/typeshade`. Set the status to `issue #N`.
6. Open a proposal in the compiler's `changes/`, `status: draft`, with `downstream: typeaudio`.
7. When the proposal is implemented, move the pin and record the id in `compiler-changes.md`.
8. Retire the workaround. Set the status to `retired`.
