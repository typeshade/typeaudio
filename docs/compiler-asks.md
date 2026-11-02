# Compiler asks

This document is the ledger of what TypeAudio rests on in the compiler and what it asks of it.
The compiler is `typeshade/typeshade`. Its proposals live in its `changes/` directory, and
`changes/README.md` there is the process. `compiler-changes.md` at the root of this repository is
the other record: it lists the proposals this repository has handled, when the compiler pin
moves.

The loop is `docs/vision.md`, section 10. A row moves through these states:

| State                                      | Meaning                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| candidate                                  | The pressure is named. Nothing is measured.                                                          |
| measured                                   | A workaround exists here. A record names the device, the date, the commit and the numbers.           |
| issue #N                                   | The general part is raised on `typeshade/typeshade`.                                                 |
| proposal NNNN (draft, accepted, implemented) | The lifecycle state of the compiler proposal, as its `status` line says.                           |
| retired                                    | The pin moved past the implementation, `compiler-changes.md` records the id, the workaround is gone. |

The letters and the ids are stable. A new ask takes the next free letter. A row never changes
its letter.

## 1. The proposals this engine rests on

Four proposals were drafted and accepted on 2026-11-02, in the session that wrote the design.
They shape the host face a unit shows the developer (`docs/vision.md`, section 8, "The host
face").

| Id   | Proposal                           | What it gives TypeAudio                                                                                                                                                                                              | Status on 2026-11-02                                                                                                                                                                                                                                           |
| ---- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0108 | `changes/0108-host-view-jsdoc.md`  | The host view carries the author's JSDoc verbatim, so a unit's documentation reaches the editor through the host face.                                                                                               | Accepted (#871, `f458fa7`). Implementation in #887 (`claude/0108-host-view-jsdoc`): checks green, merging `main` after #890. One deviation flagged to the owner: an inherited field's comment is taken from the base class.                                     |
| 0109 | `changes/0109-host-classes.md`     | An exported class is a value of the host face: `new` and the methods run on the CPU tier, an instance is the struct's host value, a struct result is an instance. The engine's `new OnePole(0.1)` on the host rests on it. | Implemented (#890, squash commit `9dbc298`, 2026-11-02). Two deviations open in the proposal's record: the view's flat declaration where TypeScript refuses an override; a mixin's members untested.                                                          |
| 0110 | `changes/0110-class-consistency.md` | Rule 8.29: a class is its struct and its functions in every place a struct or a function can be. The class arm of the differential gate holds a method to one result in a compute entry, a kernel loop, the host class and the oracle. | Accepted (#873, `9afe73a`). Implementation in #883 (`claude/0110-class-consistency`): the host leg of the arm waited on 0109 and is in progress since #890 merged.                                                                                          |
| 0116 | `changes/0116-host-type-family.md` | `typeshade/runtime` exports a family of host types spelled as the shader spells them (`f32`, `vec3`, `array<f32>`), so the host view reads as the `.shade.ts` file does. Renumbered from 0111 (#884, `c33f743`).      | Accepted (#876, `8b1a8fe`). Implementation not started. It starts when #887 is on `main`, because both change `src/compiler/ts/host-face.ts`.                                                                                                                 |

At the first compiler pin, `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (pull request #5), the
proposals' `status` lines read: 0108 `accepted`, 0109 `implemented`, 0110 `implemented`, 0116
`accepted`.

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
- Status: candidate. Observed on 2026-11-02 at the pin `14566606` (pull request #5): the proof
  admits the form with no TS8070, and the loop runs on WebGPU on SwiftShader and on the CPU tier
  at 32 and 64 lanes (`src/kernels/synth.shade.ts`). Experiment 4 holds it at 10,000 lanes.

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

- Pressure: a GPU's `sin`, `cos`, `exp` and `pow` differ by driver within 32 ULP (§38). An
  oscillator's phase and a filter's coefficient need a bound the engine can state.
- Compiler: the determinism report (§38); a common module with bounded-error forms (Rule 11.20,
  as `typeshade/algorithms` in change 0072).
- Workaround: a shader package of TypeAudio with polynomial `sin` and `cos` on a wrapped phase,
  held to the oracle.
- Measured by: experiment 3 (the FFT's twiddles) and the oscillator rows of experiment 4.
- Status: candidate.

### D. `f64` transcendentals on the device

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
- Status: candidate.

### F. A worklet build of the CPU tier

- Pressure: the `AudioWorkletGlobalScope` has no WebGPU and no dynamic `import`. The runtime
  imports its WebGL2 tier dynamically (`src/runtime/runtime.ts`), so the generated module does
  not load there today.
- Compiler: a build of the CPU tier with no dynamic import, as a subpath of `typeshade/runtime`
  or an option of the Vite plugin.
- Workaround: a bundler build that inlines the dynamic import, loaded with `addModule`.
- Measured by: experiment 2.
- Status: candidate. Experiment 2 decides whether the path exists at all.

### G. An FFT as a common module

- Pressure: the partitioned convolution, the spectral effects and the analysis need one FFT held
  to the oracle on three tiers.
- Compiler: a common module `typeshade/fft` (Rule 11.20; changes 0072 and 0076 are the
  precedent).
- Workaround: the FFT entry lives in this repository's layer 1.
- Measured by: experiments 3 and 5.
- Status: candidate. The decision follows experiment 3.

### H. GPU time

- Pressure: `explain` reports where a block's time goes, per node, as GPU time and not as host
  wall time that includes the queue's wait.
- Compiler: issue #542 (`timestamp-query` through `typeshade/runtime`, a timing that names its
  tier).
- Workaround: `performance.now()` around the `await` of a block's read, labelled as host time.
- Measured by: experiment 1.
- Status: issue #542 open (raised by typeshade/radiance).

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
- Status: issues #689 and #900 open. #900 is a bug fix that needs no proposal.

### K. The WebAssembly tier

- Pressure: the latency-critical path (F) wants the loops of a kernel in linear memory with
  `f32x4`, bit for bit with the oracle.
- Compiler: issue #459 (the design issue) and change 0042 (opened as a draft with the issue).
- Workaround: none. TypeAudio measures the CPU tier first.
- Measured by: experiment 2, which gives the number the tier would have to beat.
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
- Status: candidate.

### N. A `Resident` of class instances reads back as objects of their fields

- Pressure: a bank is a `Resident` of `Voice` instances. `dev.array(instances)` types it
  `Resident<Voice[]>`, so `read()` is typed `Promise<Voice[]>`, but it resolves to plain objects of
  the fields. A call of `tick()` on what `read()` gave is a `TypeError` that `tsc` did not see.
- Compiler: Rule 8.29 names a `Resident` among the places where a class means one thing; change
  0109 makes a struct result of a helper an instance of its class. A read could do the same, or
  its type could say the fields.
- Workaround: `Bank.read()`, typed as `State<T>[]`, the fields without the methods (`src/bank.ts`).
- Measured by: `test/render.test.ts`, on the CPU tier.
- Status: candidate.

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
- Status: candidate.

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
- Status: candidate.

### R. A method's comment in the host view

- Pressure: a unit's methods carry its documentation (`hz`, `set`, `tick`). The host view copies
  the comment of a class and of its fields, and not the comment of a constructor, a method or an
  accessor, so the editor's hover on `osc.hz(...)` shows no words.
- Compiler: change 0108 (surface §64, "The author's comments").
- Workaround: none. The comments stay in the `.shade.ts` files.
- Measured by: the views `tshc sync` writes at the pin `14566606`.
- Status: candidate.

## 3. Issues raised on the compiler

The issues found while the four proposals were implemented, on 2026-11-02, and the earlier
issues the asks cite.

| Issue | Title, shortened                                                                     | Bears on                                           | Status                                     |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| #900  | The WebGL2 pass program drops `_phx_len_table` for a length read inside an index     | J                                                  | Open; a bug fix that needs no proposal     |
| #901  | The commit-msg hook reads a merge against its first parent                           | The implementing pull requests, not the engine     | Open                                       |
| #908  | TS8070 names a static function by its emitted name                                   | The refusal's wording for a unit's static helper   | Open; a bug fix that needs no proposal     |
| #689  | A kernel loop that reads another array's `.length` has no WebGL2 tier                | J                                                  | Open                                       |
| #459  | A WebAssembly tier between WebGL2 and the CPU                                        | K, F                                               | Open; change 0042 draft                    |
| #535  | Reverse-mode `grad` before 1.0                                                       | L                                                  | Open; change 0056 accepted                 |
| #539  | A stable sort of `u32` keys with values on every tier                                | Experiment 6, if the grain order must be stable    | Open                                       |
| #542  | GPU time through `typeshade/runtime`                                                 | H                                                  | Open                                       |
| #543  | The cost of many dispatches                                                          | I                                                  | Open                                       |

## 4. How a row moves

1. Write the workaround in this repository, in the unit it belongs to or under `experiments/`.
2. Run the experiment on a device.
3. Write the record: the command, the date, the commit, the pin, the device and the numbers.
4. Set the row's status to `measured`, with the record's id.
5. Raise the general part as an issue on `typeshade/typeshade`. Set the status to `issue #N`.
6. Open a proposal in the compiler's `changes/`, `status: draft`, with `downstream: typeaudio`.
7. When the proposal is implemented, move the pin and record the id in `compiler-changes.md`.
8. Retire the workaround. Set the status to `retired`.
