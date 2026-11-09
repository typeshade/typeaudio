# Record 07: a sound match with function-level `grad`, on the container

> **Reference numbers, not a device result.** The device of this run is the container of an agent
> session: its CPU, and WebGPU and WebGL2 on SwiftShader, which runs on the same CPU. The container
> is shared with other sessions, and its load average over one minute was 7.54 to 14.46 on 4 cores
> during the run, so every time here carries that load. These numbers say what the harness measures,
> what `grad` gives and refuses at the compiler pin, and how the cost of a step grows with the
> parameter count on this machine. They do not stand for a GPU. The device runs of experiment 7 are
> pending (`docs/experiments.md`, section 7).

> **Status of the `probe` arm: retired at the pin `415b276a` (2026-11-09).** This record's runs
> include the `probe` form, which the harness no longer has. The compiler fixed issue #1017 in #1019,
> and the pin holds it. At the pin, `generateModuleJs(...).fallbacks` is empty for the reverse-mode
> derivative of the harness's loss at 3, 10, 30 and 100 parameters, at `f32` and at `f64`, so the
> CPU tier's code generator runs `loss_vjp` with no rewrite. A smoke run of the harness with both
> forms at 3 and 10 parameters gave the `probe` gradient equal to the `reverse` gradient bit for bit
> on the CPU arm and on the oracle. The numbers below are unchanged, and the `probe` rows and
> sentences stay as the record of the run.

## The run

| Item         | Value                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 7, a sound match with function-level `grad` (`docs/experiments.md`, section 7)                                                                                                                                                          |
| Command      | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell bun run exp:07 --tier all --timeout 600 --out docs/records/07-sound-match-container.json`                         |
| Date         | 2026-11-02, from 23:39:02 UTC, 42 minutes 8 seconds                                                                                                                                                                                     |
| Commit       | `00b95a332083d5ec02ad5eea1af17a55ddaefa2f` of `typeshade/typeaudio` (pull request #16), with a clean tree                                                                                                                               |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `145666068ca5d6ecfba32aa0ea4289cf0fc3b762` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                         |
| Tools        | Bun 1.4.4, Node v22.23.4, Vite 7.3.7, playwright-core 1.64.1, Chrome Headless Shell 153.0.8010.12                                                                                                                                       |
| Options      | The defaults: on the CPU arms 30 warm-up runs and 2 seconds, then 30 timed runs; on the GPU tiers 5 and 1 second, then 20; the descent 300 steps; 600 seconds for one GPU call                                                          |
| Raw data     | `docs/records/07-sound-match-container.json`: every measure's runs, the comparisons, the descents, `gradCheck`, the FFT checks, the refusals, the programs, the page's console and the load                                             |
| Outputs      | The run writes the frames each GPU tier read back and every gradient the comparisons read to `experiments/07-sound-match/out/raw.json`, and each GPU program and its source to `experiments/07-sound-match/out/web/`, which Git ignores |

## The devices

| Item     | CPU tier                                                                                       | Oracle                     | WebGPU                                                   | WebGL2                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host     | Intel Xeon Processor @ 2.10 GHz, 4 cores, 1 thread per core; Ubuntu 24.04.5 LTS, Linux 6.18.44 | the same                   | the same                                                 | the same                                                                                     |
| Runtime  | Node v22.23.4                                                                                  | Bun 1.4.4 (JavaScriptCore) | Chrome Headless Shell 153.0.8010.12                      | the same                                                                                     |
| Graphics | none                                                                                           | none                       | SwiftShader: vendor `google`, architecture `swiftshader` | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) |

The run did not reserve the container. The load average over one minute, before and after each arm:
cpu 10.35 to 7.70; oracle 7.70 to 10.96; webgpu 12.52 to 14.46; webgl2 14.46 to 7.54. The load bears
on the times. The values and their bits do not depend on it.

## The method

### What `grad` gives at the pin

These are facts of the compiler at the pin, read from its tree and held by this run.

- **Where it is documented.** `grad` and `gradCheck` have no section in
  `docs/use-typeshade-surface.md` at the pin. `AUTHORING.md`, "Derivatives with grad" (line 1624),
  documents both. `src/__api__/surface.md` lists `grad`, `gradCheck` and their option and result
  types (lines 143 to 148, signatures at lines 1380 to 1385), and `SD0118` (line 1022).
  `docs/language-design.md`, section 14, lists "Reverse-mode `grad` of a kernel function and of a
  `@compute` entry" as an open decision under change 0056.
- **What it is.** `grad(m, fn, wrt, opts)` is a host function exported from `typeshade`, an IR to IR
  pass over a `ModuleDecl`, the `module` of `compile(source)`. It adds a function to the module and
  returns the module and the function's name. It has no `"use typeshade"` spelling.
- **Forward mode** (the default) differentiates with respect to one parameter: an `f32`, or an `f32`
  vector along `opts.direction`. It adds `<fn>_d_<param>`, with `fn`'s parameters and result type,
  and a helper `<g>_jvp` for each function the parameter reaches through a call. It carries a
  tangent beside every `f32`, float vector and float matrix, through `if`, `switch` and `for`.
- **Reverse mode** (`opts.mode: 'reverse'`) differentiates with respect to a list of names, each an
  `f32`, an `f32` vector or an `f32` matrix. It adds `<fn>_vjp(params…, dy)`, which returns a struct
  with one field for each name, and a helper `<g>_vjp` for each callee. A loop runs under a
  checkpoint schedule in function memory: `opts.checkpoints` slots, 32 by default; up to C²
  iterations the body runs about three times forward and once backward, and past C² the time grows
  as N² / C. `GradResult.tapeBytes` reports the function memory one call takes.
- **What it refuses**, with `SD0118`: a function that does not return an `f32`, a float vector or a
  float matrix, an entry among them; a parameter of an array or a struct type, in both modes; a
  matrix parameter in forward mode; a vector parameter in forward mode without a direction; a value
  that depends on the parameter written into an array, a struct, a module variable or a binding; a
  texture sample; recursion. Section "Refusals, and calls that did not return" gives the sentences.
- **Where a derivative runs.** A derivative is ordinary IR. The oracle runs it (`compileModule`, the
  interpreter, `f64` by default; `compileModuleJs`, the code generator, bit for bit the same), and
  the WGSL and GLSL writers emit it for an entry that calls it. No entry of a source can call it,
  since `grad` adds it after the source compiled. The host face of a `.shade.ts` file and the
  manifest of `packModule`, which `typeshade/runtime` loads, carry no derivative: change 0056's step
  4 (the derivative programs in the manifest, and the derivative functions in the host import) is
  not implemented at the pin. So an application that imports a `.shade.ts` file or ships the runtime
  alone reaches no derivative; a host that runs the compiler does.
- **`gradCheck(m, fn, { wrt, at, mode })`** builds the derivative of the mode and compares each
  partial derivative with a central difference of `fn` on the `f64` oracle (`compileModule`), step
  `h` (1e-5 by default), at each argument list of `at`. A partial passes within `tolerance` (1e-4 by
  default) times max(1, |difference|). It returns `{ ok, checked, worst }`, and `worst` only when a
  partial fails.
- **Change 0056 at the pin.** Its `status` line reads `accepted`. Its "Configuration and validation
  record" reads "This record does not yet apply", at the pin and on the compiler's `main` at
  `87af4eb0`, read on 2026-11-02. The compiler's `CHANGELOG.md` at the pin lists three implemented
  steps: step 1, reverse mode for loop-free functions and `gradCheck` (#546); step 1b, loops under
  the checkpoint schedule and `opts.custom` (#547); step 2, slice 2a, the `f32` scatter with `+=` on
  the CPU tier in the tree order, which the GPU tiers do not lower (#548). It lists no other step:
  not 2b (the scatter on the GPU), 3 (kernel functions with respect to their arrays), 4 (entries,
  the manifest, the plugin and the runtime's plan runner), 5 or 6. In the tree, `PackOptions` holds
  `console`, `ir` and `emit` and no `derivatives` (`src/core/manifest.ts`, line 82), and the Vite
  plugin has no `derivatives` either.

### The patch and its loss

`experiments/07-sound-match/patch.ts` writes four modules, `patch-3.shade.ts`, `patch-10.shade.ts`,
`patch-30.shade.ts` and `patch-100.shade.ts`, which the tree holds; the runner refuses to run when
one differs from what the generator writes.

- **The voice**: `y[n] = env(n) · sin(2π c n + index · env(n) · sin(2π ratio · c n))`, with `c = 375
  / 48,000 = 1/128` cycles per frame, exact in `f32`. Each phase is reduced to [-π, π) before its
  `sin`, with `fract`, whose derivative is 1.
- **The envelope**: piecewise linear over the 1,024 frames, 0 at the first and the last frame,
  through B breakpoint levels equally spaced. The frame loop runs over the B + 1 segments, and over
  each segment's frames inside, so a level is looked up once a segment (`level(j, …)`, a `switch`).
- **The parameters** are the loss's own `f32` parameters: `ratio`, `index`, `l1` … `lB`. A count of
  P parameters has B = P − 2 breakpoints: 1, 8, 28 and 98. `grad` takes no array or struct
  parameter, and in forward mode no matrix and no vector without a direction (section "Refusals, and
  calls that did not return"), so each level is a parameter of its own.
- **The known answer**: ratio 2, index 1, and the levels on a line from 1.05 at the start to 0.55 at
  the end; one breakpoint (3 parameters) sits at the middle, at 0.8. **The start**: ratio 2.04,
  index 0.7, every level at 60 % of its answer.
- **The loss**: `(1/16) Σ (log(|X_k|² + 1) − T_k)²` over the bins k = 0, 4, 8, …, 60 of the render's
  1,024-point DFT (0 to 2,812.5 Hz; the patch's partials at the answer lie at bins 8, 24, 40 and
  56). Each bin is one Goertzel recurrence, `s = y + 2cos(2πk/1024) · s1 − s2`, fed frame by frame
  inside the frame loop, and `|X_k|² = s1² + s2² − 2cos(2πk/1024) · s1 · s2` after it. The target T
  is `logPower` of the known answer on the oracle at `f32`, the same analysis in a function of its
  own, so the loss is 0 at the known answer on the oracle. Every arm holds its loss to that target.
- **`render`** returns the 1,024 frames as an array; `lossAlong(t, θ, d, T)` is `loss(θ + t·d, T)`.

### The four forms of the gradient

| Form      | What runs for one gradient                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forward` | Forward-mode `grad` per parameter: P derivative functions, `loss_d_ratio`, `loss_d_index`, `loss_d_l1` …, each called once (the method)            |
| `along`   | Forward-mode `grad` of `lossAlong` in `t`: one function, called once for each parameter with that parameter's unit direction as its argument `d`   |
| `reverse` | Reverse-mode `grad` of `loss` with respect to every parameter: one call of `loss_vjp`, whose struct holds the gradient                             |
| `probe`   | The same `loss_vjp` with each loop header `for (iter = 0; …)` written as `iter = 0; for (var unused = 0; …)` (`match.ts`). Not the pin's behaviour |

At the pin, reverse mode writes each loop it generates with an assignment as its first statement,
and the CPU tier's code generator takes only a `let` or a `var` there (`emitForInit`,
`src/core/cpu-codegen.ts`, line 1655, at the pin and at `87af4eb0`). So `compileModuleJs` runs the
whole of `loss_vjp` in the interpreter. The probe keeps every statement and its order, and the
generator then compiles it; its gradient is reverse mode's bit for bit (section "The numbers").

### The arms

| Arm      | What runs                                                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu`    | The CPU tier in Node: the harness bundled with Vite, the compiler's plugin and the compiler (`typescript` kept external), run with Node. `render` and `loss` through the host face, and every form through `compileModuleJs` at `f32`                                                                 |
| `oracle` | The same forms in Bun, through `compileModuleJs` at `f32`; also the descents, `gradCheck`, the FFT checks and the refusals                                                                                                                                                                            |
| `webgpu` | A packed program (`program.ts`) in headless Chromium on SwiftShader, with `typeshade/runtime` alone: `renderEntry` and `lossEntry` (one invocation), `framesEntry` (one invocation per frame), `forwardStep` (`along`, one invocation per parameter, one dispatch) and `reverseStep` (one invocation) |
| `webgl2` | The same page in a fresh browser, `createRuntime({ prefer: ['webgl2'] })`: the entries as the pass programs of change 0054                                                                                                                                                                            |

### The timing

Each measure runs untimed until it has run 30 times and for 2 seconds on the CPU arms (5 times and 1
second on the GPU tiers), then 30 times timed (20 on the GPU tiers). A JavaScript engine compiles a
function again, faster, once it has run for a while, and each of forward mode's P derivative
functions warms up on its own. A step is one gradient and Adam's update of the parameters, and the
steps follow one another as a descent from the start. A GPU call is timed from the dispatch to the
end of its read-back; a GPU step uploads the parameters, dispatches and reads the gradient back. The
tables give the median and the 95th percentile by nearest rank.

### The checks

- **The descent** of 3 parameters runs 300 steps from the start on the oracle at `f32`, with forward
  mode's gradient per parameter: Adam at rate 0.01, and plain gradient descent at rate 0.002. The
  GPU tiers run the same Adam descent with their own forward mode (`forwardStep`) and loss
  (`lossEntry`).
- **`gradCheck`** holds the loss of 3 parameters to a central difference in both modes, at the start
  and halfway to the known answer, with its defaults. It returns no numbers when it passes, so the
  runner makes the same comparison on the same oracle and keeps the worst case.
- **The `f64` reference**: forward mode's gradient at the start on the oracle at `f64`. Every form
  and every tier is held to it, as the largest difference over the largest component.
- **The swap**: each GPU program's entries run on the oracle at `f32` and are held to the CPU arm's
  render, loss and gradients, bit for bit.
- **The FFT of experiment 3**: `fftSmallTable`, the 1,024-point entry with the host's twiddle table,
  on the oracle at `f32` (`experiments/03-fft/oracle.ts`), and `fft64`, the `f64` reference of
  experiment 3. They hold the loss's 16 bins of the known answer's render. They also measure the
  match over the 512 bins below the Nyquist frequency, as the mean squared distance of `log(|X_k|² +
  1)` between a render and the known answer's render.

## The numbers

### Time per call

The median / the 95th percentile, in milliseconds. A step is one gradient and Adam's update. On the
GPU tiers forward mode is the form `along`, one dispatch of one invocation per parameter, and
"Frames" is the render with one invocation per frame. "n/a": the form does not run there, or did not
finish (section "Refusals, and calls that did not return").

| Arm    | Params | Render        | Frames      | Loss          | forward       | along         | reverse     | probe       |
| ------ | -----: | ------------- | ----------- | ------------- | ------------- | ------------- | ----------- | ----------- |
| cpu    |      3 | 0.073 / 0.088 | n/a         | 0.167 / 0.182 | 1.05 / 1.63   | 1.11 / 2.49   | 387 / 485   | 2.26 / 2.74 |
| oracle |      3 | 0.063 / 0.077 | n/a         | 0.115 / 0.208 | 0.601 / 0.680 | 0.608 / 0.655 | 267 / 402   | 7.17 / 11.2 |
| webgpu |      3 | 2.92 / 7.67   | 2.90 / 9.85 | 3.95 / 6.18   | n/a           | 3.11 / 11.7   | 4.03 / 11.7 | n/a         |
| webgl2 |      3 | 4,353 / 5,079 | 4.98 / 9.16 | 5.02 / 16.0   | n/a           | 5.48 / 10.0   | 2.76 / 6.84 | n/a         |
| cpu    |     10 | 0.073 / 0.091 | n/a         | 0.168 / 0.187 | 4.09 / 5.72   | 3.60 / 5.51   | 394 / 550   | 2.37 / 3.20 |
| oracle |     10 | 0.068 / 0.087 | n/a         | 0.115 / 0.136 | 2.48 / 2.60   | 2.06 / 2.94   | 297 / 336   | 7.72 / 9.35 |
| webgpu |     10 | 3.97 / 5.30   | 2.80 / 5.06 | 2.91 / 5.14   | n/a           | 4.81 / 15.3   | 3.32 / 7.19 | n/a         |
| webgl2 |     10 | 4,681 / 8,716 | 9.65 / 18.7 | 8.89 / 16.2   | n/a           | 8.65 / 16.0   | 23.7 / 59.8 | n/a         |
| cpu    |     30 | 0.077 / 0.090 | n/a         | 0.174 / 0.198 | 15.2 / 19.2   | 11.2 / 12.0   | 407 / 464   | 12.5 / 12.8 |
| oracle |     30 | 0.071 / 0.086 | n/a         | 0.118 / 0.143 | 8.36 / 10.0   | 6.40 / 14.1   | 273 / 356   | 7.45 / 7.71 |
| webgpu |     30 | 3.06 / 8.84   | 2.87 / 6.45 | 3.06 / 5.25   | n/a           | 2.81 / 8.42   | 3.63 / 6.36 | n/a         |
| webgl2 |     30 | 5,372 / 7,411 | 7.09 / 13.0 | 7.67 / 11.3   | n/a           | 5.00 / 11.3   | 28.8 / 51.6 | n/a         |
| cpu    |    100 | 0.152 / 0.173 | n/a         | 0.251 / 0.281 | 62.0 / 236    | 56.3 / 74.8   | 507 / 607   | 16.3 / 17.4 |
| oracle |    100 | 0.101 / 0.122 | n/a         | 0.153 / 0.171 | 44.7 / 151    | 31.2 / 32.0   | 330 / 377   | 14.0 / 19.5 |
| webgpu |    100 | 2.84 / 6.04   | 3.42 / 7.05 | 2.87 / 6.05   | n/a           | 14.9 / 23.1   | n/a         | n/a         |
| webgl2 |    100 | 5,811 / 7,181 | 8.05 / 32.2 | 16.0 / 49.5   | n/a           | 37.1 / 118    | n/a         | n/a         |

### What the question asks: a step against the render

The median step over the median render. On the GPU tiers the step over the render with one
invocation per frame is in brackets.

| Arm    | Params | Loss           | forward | along           | reverse         | probe |
| ------ | -----: | -------------- | ------- | --------------- | --------------- | ----- |
| cpu    |      3 | 2.28           | 14.4    | 15.1            | 5,290           | 30.8  |
| oracle |      3 | 1.84           | 9.60    | 9.72            | 4,262           | 115   |
| webgpu |      3 | 1.35 (1.36)    | n/a     | 1.07 (1.07)     | 1.38 (1.39)     | n/a   |
| webgl2 |      3 | 0.0012 (1.01)  | n/a     | 0.0013 (1.10)   | 0.00063 (0.554) | n/a   |
| cpu    |     10 | 2.31           | 56.4    | 49.7            | 5,437           | 32.7  |
| oracle |     10 | 1.67           | 36.2    | 30.0            | 4,332           | 113   |
| webgpu |     10 | 0.733 (1.04)   | n/a     | 1.21 (1.72)     | 0.838 (1.19)    | n/a   |
| webgl2 |     10 | 0.0019 (0.922) | n/a     | 0.0018 (0.896)  | 0.0051 (2.46)   | n/a   |
| cpu    |     30 | 2.26           | 197     | 145             | 5,277           | 162   |
| oracle |     30 | 1.66           | 117     | 89.7            | 3,830           | 105   |
| webgpu |     30 | 0.998 (1.06)   | n/a     | 0.917 (0.977)   | 1.19 (1.27)     | n/a   |
| webgl2 |     30 | 0.0014 (1.08)  | n/a     | 0.00093 (0.705) | 0.0054 (4.07)   | n/a   |
| cpu    |    100 | 1.65           | 407     | 370             | 3,327           | 107   |
| oracle |    100 | 1.51           | 443     | 309             | 3,273           | 138   |
| webgpu |    100 | 1.01 (0.842)   | n/a     | 5.27 (4.38)     | n/a             | n/a   |
| webgl2 |    100 | 0.0028 (1.99)  | n/a     | 0.0064 (4.61)   | n/a             | n/a   |

The same steps over the median loss, and forward mode's step over the count and the loss: the losses
one parameter costs.

| Arm    | Params | forward | along | reverse | probe | forward / params |
| ------ | -----: | ------- | ----- | ------- | ----- | ---------------: |
| cpu    |      3 | 6.31    | 6.63  | 2,322   | 13.5  |             2.10 |
| oracle |      3 | 5.23    | 5.30  | 2,321   | 62.4  |             1.74 |
| cpu    |     10 | 24.4    | 21.5  | 2,351   | 14.2  |             2.44 |
| oracle |     10 | 21.6    | 17.9  | 2,587   | 67.3  |             2.16 |
| cpu    |     30 | 87.4    | 64.4  | 2,335   | 71.5  |             2.91 |
| oracle |     30 | 70.6    | 54.1  | 2,307   | 63.0  |             2.35 |
| cpu    |    100 | 247     | 224   | 2,017   | 64.8  |             2.47 |
| oracle |    100 | 293     | 204   | 2,164   | 91.5  |             2.93 |

### Building the derivatives

Milliseconds of the `grad` calls / of `compileModuleJs` of the module they built, on the oracle arm;
the functions `grad` added, its helpers included; reverse mode's report of its tape.

| Params | forward     | along        | reverse     | probe | Added (forward) | Added (along) | Added (reverse) | Tape bytes |
| -----: | ----------- | ------------ | ----------- | ----- | --------------: | ------------: | --------------: | ---------: |
|      3 | 10.8 / 94.0 | 0.627 / 32.1 | 13.4 / 106  | 61.8  |              10 |             5 |               4 |     17,380 |
|     10 | 1.91 / 182  | 0.498 / 101  | 36.7 / 113  | 70.9  |              38 |             5 |               4 |     17,380 |
|     30 | 21.2 / 325  | 0.316 / 16.9 | 13.2 / 22.1 | 26.0  |             118 |             5 |               4 |     17,380 |
|    100 | 123 / 967   | 7.63 / 24.2  | 44.7 / 27.2 | 26.1  |             398 |             5 |               4 |     17,380 |

### The gradients' agreement

Each form's gradient at the start against forward mode's on the oracle at `f64`: the largest
difference over the largest component. Then the values whose `f32` bits differ between two forms.

| Arm    | Params | forward | along  | reverse | probe  | along ≠ forward | reverse ≠ forward | probe ≠ reverse |
| ------ | -----: | ------- | ------ | ------- | ------ | --------------- | ----------------- | --------------- |
| cpu    |      3 | 9.2e-5  | 9.2e-5 | 8.5e-5  | 8.5e-5 | 0 of 3          | 3 of 3            | 0 of 3          |
| cpu    |     10 | 6.3e-3  | 6.3e-3 | 6.6e-3  | 6.6e-3 | 0 of 10         | 10 of 10          | 0 of 10         |
| cpu    |     30 | 3.1e-2  | 3.1e-2 | 2.2e-2  | 2.2e-2 | 0 of 30         | 30 of 30          | 0 of 30         |
| cpu    |    100 | 1.1e-2  | 1.1e-2 | 1.0e-2  | 1.0e-2 | 0 of 100        | 100 of 100        | 0 of 100        |
| oracle |      3 | 9.2e-5  | 9.2e-5 | 8.5e-5  | 8.5e-5 | 0 of 3          | 3 of 3            | 0 of 3          |
| oracle |     10 | 6.3e-3  | 6.3e-3 | 6.6e-3  | 6.6e-3 | 0 of 10         | 10 of 10          | 0 of 10         |
| oracle |     30 | 3.1e-2  | 3.1e-2 | 2.2e-2  | 2.2e-2 | 0 of 30         | 30 of 30          | 0 of 30         |
| oracle |    100 | 1.1e-2  | 1.1e-2 | 1.0e-2  | 1.0e-2 | 0 of 100        | 100 of 100        | 0 of 100        |

### The CPU tier's host face

In Node, the render and the loss through the host face (median / p95, ms), and whether they give the
bits of `compileModuleJs`; and whether Node's own `logPower` of the known answer gives the target
the runner made in Bun.

| Params | Render (host face) | Loss (host face) | Same render bits | Same loss bits | Same target bits |
| -----: | ------------------ | ---------------- | ---------------- | -------------- | ---------------- |
|      3 | 0.111 / 0.132      | 0.167 / 0.185    | yes              | yes            | yes              |
|     10 | 0.120 / 0.611      | 0.168 / 0.185    | yes              | yes            | yes              |
|     30 | 0.119 / 0.154      | 0.174 / 0.190    | yes              | yes            | yes              |
|    100 | 0.195 / 0.242      | 0.258 / 0.311    | yes              | yes            | yes              |

### The GPU programs

The packed program of each count:

| Params | WGSL characters | WebGL2 pass programs | Tape bytes |
| -----: | --------------: | -------------------: | ---------: |
|      3 |          87,787 |                    5 |     17,380 |
|     10 |          93,451 |                    5 |     17,380 |
|     30 |         110,985 |                    5 |     17,380 |
|    100 |         170,520 |                    5 |     17,380 |

Each program's entries on the oracle at `f32`, against the CPU arm's values, bit for bit:

| Params | renderEntry | framesEntry | lossEntry | forwardStep | reverseStep |
| -----: | ----------- | ----------- | --------- | ----------- | ----------- |
|      3 | yes         | yes         | yes       | yes         | yes         |
|     10 | yes         | yes         | yes       | yes         | yes         |
|     30 | yes         | yes         | yes       | yes         | yes         |
|    100 | yes         | yes         | yes       | yes         | yes         |

The time WebGPU took to make each pipeline, in milliseconds:

| Params | renderEntry | framesEntry | lossEntry | forwardStep | reverseStep |
| -----: | ----------: | ----------: | --------: | ----------: | ----------: |
|      3 |         327 |        26.0 |      59.4 |         123 |         894 |
|     10 |         335 |        36.8 |      72.3 |         134 |         461 |
|     30 |         387 |         123 |       203 |         837 |       9,850 |
|    100 |         676 |         271 |       296 |      77,032 |    not made |

The time of each entry's first call, in milliseconds, which the measures do not time. WebGL2 makes
an entry's pass program at its first dispatch (`program.compute` returns at once there), so on
WebGL2 this time holds the build:

| Tier   | Params | renderEntry | framesEntry | lossEntry | forwardStep | reverseStep |
| ------ | -----: | ----------: | ----------: | --------: | ----------: | ----------: |
| webgpu |      3 |        9.16 |        4.77 |      3.04 |        8.27 |        6.55 |
| webgpu |     10 |        5.70 |        13.3 |      5.98 |        12.4 |        4.42 |
| webgpu |     30 |        4.20 |        3.41 |      3.47 |        7.64 |        43.9 |
| webgpu |    100 |        16.2 |        4.30 |      4.05 |        78.0 |         n/a |
| webgl2 |      3 |       7,245 |         179 |     1,730 |         824 |       2,724 |
| webgl2 |     10 |      11,176 |         909 |       727 |       1,002 |       2,880 |
| webgl2 |     30 |      13,615 |       2,364 |       684 |       3,564 |      21,942 |
| webgl2 |    100 |      16,467 |       5,558 |     5,996 |     207,537 |         n/a |

### The GPU tiers against the oracle

WebGPU against the oracle: the frames whose bits differ, with the largest difference, for the render
by one invocation and by one invocation per frame; the loss at the start; the gradients against the
oracle's forward mode at `f32`, and at `f64` in brackets.

| Params | Frames, one invocation | Frames, one per frame | Loss at the start (GPU / oracle) | Forward mode    | Reverse mode    |
| -----: | ---------------------- | --------------------- | -------------------------------- | --------------- | --------------- |
|      3 | 1003 of 1024 (1.6e-4)  | 1003 of 1024 (1.6e-4) | 1.53977 / 1.54092                | 1.1e-2 (1.1e-2) | 1.1e-2 (1.1e-2) |
|     10 | 1000 of 1024 (1.9e-4)  | 1000 of 1024 (1.9e-4) | 4.00934 / 4.01031                | 1.9e-3 (5.0e-3) | 1.0e-3 (5.3e-3) |
|     30 | 1000 of 1024 (1.9e-4)  | 1000 of 1024 (1.9e-4) | 5.0244 / 5.02551                 | 1.7e-2 (3.4e-2) | 1.0e-2 (2.2e-2) |
|    100 | 1000 of 1024 (1.9e-4)  | 1000 of 1024 (1.9e-4) | 4.58362 / 4.58543                | 1.2e-2 (1.6e-2) | n/a             |

WebGL2 against WebGPU: the values whose bits differ.

| Params | renderEntry | framesEntry | Loss | Forward | Reverse | Descent |
| -----: | ----------: | ----------: | ---: | ------: | ------: | ------: |
|      3 |           0 |           0 |    0 |       0 |       0 |       0 |
|     10 |           0 |           0 |    0 |       0 |       0 |     n/a |
|     30 |           0 |           0 |    0 |       0 |       0 |     n/a |
|    100 |           0 |           0 |    0 |       0 |     n/a |     n/a |

### The descent of 3 parameters

The loss before steps 0, 10, 50, 100 and 200, and after the last; the parameters at the end. The
known answer is 2, 1 and 0.8; the start is 2.04, 0.7 and 0.48.

| Descent       | Step 0 |      10 |      50 |     100 |     200 |     300 | Ratio, index, l1 at the end |
| ------------- | -----: | ------: | ------: | ------: | ------: | ------: | --------------------------- |
| oracle, Adam  | 1.54e0 | 7.10e-1 | 4.27e-3 | 1.23e-4 | 2.41e-5 | 6.91e-6 | 2.00006, 1.00537, 0.79742   |
| oracle, plain | 1.54e0 | 7.57e-1 | 5.59e-2 | 5.78e-3 | 2.90e-3 | 2.41e-3 | 1.99978, 0.90512, 0.84779   |
| WebGPU, Adam  | 1.54e0 | 7.10e-1 | 4.28e-3 | 1.29e-4 | 2.62e-5 | 8.91e-6 | 2.00007, 1.00479, 0.79752   |
| WebGL2, Adam  | 1.54e0 | 7.10e-1 | 4.28e-3 | 1.29e-4 | 2.62e-5 | 8.91e-6 | 2.00007, 1.00479, 0.79752   |

At the end of Adam's descent on the oracle the parameters are off the answer by +0.003 %, +0.537 %,
-0.322 %, and plain gradient descent's by -0.01 %, -9.49 %, +5.97 %.

### `gradCheck`

At the start and halfway to the known answer, forward mode passes, 6 partial derivatives checked,
and reverse mode passes, 6 partial derivatives checked. The worst |derivative − difference| / max(1,
|difference|) is 4.4e-8 in forward mode and 4.4e-8 in reverse mode, both for `ratio`, against
`gradCheck`'s tolerance of 1e-4.

### The FFT of experiment 3

- The loss's 16 bins of the known answer's render against `fftSmallTable`'s: within 4.2e-4 in
  `log(|X_k|² + 1)`; against `fft64`'s: within 4.2e-4. `fftSmallTable` against `fft64` over the 512
  bins: within 1.3e-6.
- The match over the 512 bins, by `fftSmallTable` (by `fft64`): 0.179 (0.179) at the start, and
  1.83e-6 (1.83e-6) at the end of Adam's descent.

## Refusals, and calls that did not return

**What `grad` refuses of the method's forms.** The runner holds each form as the smallest program
that shows it (`experiments/07-sound-match/refusals.ts`) and records the sentence. Each sentence
starts `typeshade [SD0118]: grad cannot differentiate this function —` and ends with the same hint,
"the detail names the construct and what to write instead; grad differentiates f32, float-vector and
float-matrix arithmetic, the component-wise builtins, if, switch and for, and calls to other
functions of the module". The details:

| Form                                              | Forward mode                                                                                                                                                                                 | Reverse mode                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The render kept in an array, inside the function  | `"energy" writes a value that depends on the parameter to "y", which is a struct, an array or a parameter; grad carries a derivative through f32, float-vector and float-matrix locals only` | `"energy" stores a value that depends on the parameter in "y", a array<f32,64>; grad carries a derivative through f32, float-vector and float-matrix values only` |
| A `@compute` entry, as the FFT of experiment 3 is | `"scale" returns void; grad differentiates a function that returns f32, an f32 vector or an f32 matrix`                                                                                      | the same                                                                                                                                                          |
| The levels as one array parameter                 | `"levels" of "shape" is array<f32,4>; grad differentiates with respect to an f32 or an f32 vector`                                                                                           | `… with respect to an f32, an f32 vector or an f32 matrix`                                                                                                        |
| The patch as one struct of scalars                | `"p" of "voice" is Patch; grad differentiates with respect to an f32 or an f32 vector`                                                                                                       | `… with respect to an f32, an f32 vector or an f32 matrix`                                                                                                        |
| Sixteen levels as one `mat4x4`                    | `"m" of "shape" is mat4x4<f32>; grad differentiates with respect to an f32 or an f32 vector`                                                                                                 | accepted                                                                                                                                                          |
| Four levels as one `vec4`, with no direction      | `"v" of "shape" is vec4<f32>; pass opts.direction with 4 numbers, the direction to differentiate along`                                                                                      | accepted                                                                                                                                                          |
| The frames as a kernel function's array parameter | `"xs" of "total" is array<f32>; grad differentiates with respect to an f32 or an f32 vector`                                                                                                 | `… with respect to an f32, an f32 vector or an f32 matrix`                                                                                                        |

**What is not refused but does not run as it should.** `compileModuleJs` runs every reverse-mode
derivative with a loop in the interpreter, with no diagnostic (section "The method", "The four forms
of the gradient"). The smallest program that shows it:

```ts
import { compile, compileModule, compileModuleJs, grad } from 'typeshade';

const m = compile(`"use typeshade";
export function f(k: f32): f32 {
  let s: f32 = 0.;
  for (let i: i32 = 0; i < 1024; i++) {
    s += sin(k * f32(i));
  }
  return s;
}
`).module;
const rev = grad(m, 'f', ['k'], { mode: 'reverse' });
compileModuleJs(rev.module, { precision: 'f32' }).fns[rev.name](0.01, 1); // as slow as compileModule's
```

The code generator's own list of the functions it hands to the interpreter,
`generateModuleJs(…).fallbacks` (`src/core/cpu-codegen.ts`, not exported), is `["f_vjp"]` for this
module and `[]` for its forward-mode derivative.

On the oracle in Bun the same function's reverse-mode derivative took 7.26 ms through
`compileModuleJs` and 7.99 ms through `compileModule`, the interpreter. With its loop headers
rewritten as the probe writes them it took 0.290 ms and gave the same bits. Its forward-mode
derivative took 0.043 ms. These medians of 30 calls come from a script outside the harness, run
after the run at its commit; they are given for the reproduction only.

**Calls that did not return, or failed.**

- On WebGPU, at 100 parameters, the pipeline of `reverseStep` was not made. The page recorded:
  `reverse: Error: the pipeline of reverseStep did not return within 600 s`
- On WebGL2, at 100 parameters: `reverse: Error: reverseStep did not return within 600 s`
- Two earlier runs of the same programs did not make WebGPU's `reverseStep` of 100 parameters
  either. The first, at the commit `f0e8643` with a change to the page not yet committed (a time
  bound around each pipeline's build), made `forwardStep` in 74,050 ms and did not make
  `reverseStep` within 1,800 seconds, from 22:22 to 22:52 UTC on 2026-11-02; the GPU process held
  3.9 GB of memory during the build. The second, the command of this record at the commit `f90c45b`
  with a clean tree, from 22:53 to 23:33 UTC, recorded after about 100 seconds: `Error: The compute
  pipeline of "reverseStep" (typeshade-input.ts:713) could not be created: A valid external Instance
  reference no longer exists.` Line 713 of the source the runner compiled is the entry
  `reverseStep`. That run wrote the GPU tiers' frames into its result, so this record's run repeats
  it with the outputs in `--raw`; its other numbers are not this record's.

**What Chromium printed.** On WebGL2 the page's console drew `performance warning: READ-usage buffer
was written, then fenced, but written again before being read back. This discarded the shadow copy
that was created to accelerate readback.` 1,024 times, and `WebGL: too many errors, no more errors
will be reported to the console for this context.` 4 times, once for each count's WebGL2 context. In
the earlier runs of one count it came during the render by one invocation. That render's frames are
WebGPU's bit for bit.

## What departs from the method

Each item is a difference between the method of `docs/experiments.md`, section 7, and this run.

1. Step 2 asks for the loss "with the FFT of experiment 3". `grad` refuses an entry ("returns void")
   and a value that depends on the parameter kept in an array, in both modes (section "Refusals, and
   calls that did not return"). So the loss can neither call the FFT entry nor keep the render for a
   transform. It takes 16 bins of a 1,024-point DFT, every fourth bin from 0 to 60, by one Goertzel
   recurrence per bin inside the frame loop. The FFT of experiment 3 (`fftSmallTable`, on the
   oracle) holds the loss's bins and measures the match over 512 bins. Disposition: open. It closes
   when `grad` differentiates a loss that keeps the render, through an array local or through change
   0056's steps 3 and 4; the method's text is the owner's to amend.
2. Step 3 asks for forward-mode `grad` per parameter. The `forward` form is that. Three more forms
   are added: `along`, forward mode with the direction as an argument, which the GPU tiers run as
   one dispatch; `reverse`, the function-level reverse mode the pin has (change 0056, steps 1 and
   1b), since the experiment decides the need for ask L; and `probe`, reverse mode with its loop
   headers rewritten, which measures what the generated code costs where the pin falls back to the
   interpreter. The probe is not the pin's behaviour. Disposition: open, as item 1.
3. At the pin a derivative reaches neither the host face of a `.shade.ts` file nor the manifest
   (change 0056, step 4, not implemented). The CPU tier's derivatives run through `compileModuleJs`
   at `f32`, the code generator the host face uses, with the compiler bundled into the Node build;
   the render and the loss run through the host face as well. The GPU tiers run a packed program the
   harness builds: entries that call two placeholders, which take the bodies `grad` built
   (`program.ts`). On the oracle the program gives the CPU arm's values bit for bit. Disposition:
   open until the pin moves past change 0056's step 4.
4. Step 3 says "step". The descent uses Adam (rate 0.01, the usual moments). Plain gradient descent
   (rate 0.002) is run beside it on the oracle. Disposition: made part of the method's status text
   in `docs/experiments.md`, section 7.
5. Step 4 measures the time per step against the render. The GPU tiers time the render twice: by one
   invocation, as the CPU arms call `render`, and by one invocation for each frame (`framesEntry`),
   as a GPU renders. The second is added. Disposition: made part of the method's status text in
   `docs/experiments.md`, section 7.
6. Step 1 asks for a constant-bounded loop over the frames. The render loops over the envelope's
   segments, a constant bound, and inside it over each segment's frames, a counted loop whose bounds
   the segment's index gives; so a level is looked up once a segment. The frames total 1,024 at
   every count, and both modes of `grad` take the loop. Disposition: made part of the method's
   status text in `docs/experiments.md`, section 7.

## Observations

These are facts of this run.

1. `grad` at the pin differentiates the loss over a whole render, a function with a loop over 1,024
   frames and 16 recurrences, in forward mode and in reverse mode, at every count. It refuses the
   forms the method's step 2 asks for: an entry, and a value kept in an array.
2. Adam's descent of 3 parameters on forward mode's gradient takes the loss from 1.54 to 6.91e-6 in
   300 steps on the oracle, and ends at 2.00006, 1.00537, 0.79742 against 2, 1 and 0.8. Over the 512
   bins the match's distance falls from 0.179 to 1.83e-6. Plain gradient descent at rate 0.002 ends
   at a loss of 2.41e-3, at 1.99978, 0.90512, 0.84779.
3. `gradCheck` passes in both modes, 6 partial derivatives each. The worst partial is within 4.4e-8
   of the central difference, against a tolerance of 1e-4.
4. The loss's 16 bins agree with experiment 3's FFT within 4.2e-4 in `log(|X_k|² + 1)`, and the FFT
   on the oracle agrees with the `f64` FFT within 1.3e-6.
5. On the CPU arms the loss costs 2.28 renders in Node and 1.84 in Bun at 3 parameters, and 1.65 and
   1.51 at 100: its 16 bins cost more than the voice.
6. Forward mode's step costs 14.4, 56.4, 197 and 407 renders at 3, 10, 30 and 100 parameters in
   Node, and 9.60, 36.2, 117 and 443 in Bun. Each parameter costs 2.10 to 2.91 losses in Node and
   1.74 to 2.93 in Bun (the tables under "What the question asks").
7. `along` gives forward mode's gradient bit for bit at every count. Its step costs about as much as
   forward mode's: 56.3 against 62.0 ms at 100 parameters in Node.
8. Reverse mode's step costs 387 ms at 3 parameters and 507 ms at 100 in Node, and 267 and 330 ms in
   Bun: its time moves little with the count. Through the interpreter it costs 368 forward steps at
   3 parameters and 8.18 at 100 in Node.
9. The probe gives reverse mode's gradient bit for bit at every count, and runs 172 (3 parameters)
   to 31.1 (100) times faster than the interpreter in Node. Its step costs 2.26 ms at 3 parameters
   and 16.3 ms at 100 in Node, and 7.17 and 14.0 ms in Bun. Against forward mode's step it costs
   2.14, 0.580, 0.819 and 0.263 times as much in Node, and 11.9, 3.12, 0.892 and 0.312 in Bun.
10. At `f32` forward mode's gradient is 9.2e-5 from the `f64` gradient at 3 parameters, 6.3e-3 at
    10, 3.1e-2 at 30 and 1.1e-2 at 100, relative to its largest component. Reverse mode's is 8.5e-5,
    6.6e-3, 2.2e-2 and 1.0e-2. Node and Bun give the same values.
11. On WebGPU on SwiftShader a call costs a few milliseconds whatever it computes: the render by one
    invocation 2.84 to 3.97 ms, the render with one invocation per frame 2.80 to 3.42 ms, the loss
    2.87 to 3.95 ms. Forward mode's step costs 3.11, 4.81, 2.81 and 14.9 ms at 3, 10, 30 and 100
    parameters; reverse mode's 4.03, 3.32 and 3.63 ms at 3, 10 and 30.
12. WebGPU's pipelines take longer to make as the count grows: `forwardStep` 123, 134, 837 and
    77,032 ms; `reverseStep` 894, 461 and 9,850 ms, and at 100 parameters it was not made. On WebGL2
    the first call of `forwardStep` takes 207,537 ms at 100 parameters, and reverse mode's first
    call at 100 did not return within 600 seconds.
13. The GPU tiers' frames differ from the oracle's in 1,000 to 1,003 of the 1,024 values, by up to
    1.9e-4: SwiftShader's `sin` (record 03). Their gradients differ from the oracle's at `f32` by
    1.9e-3 to 1.7e-2, and from the `f64` gradient by 5.0e-3 to 3.4e-2, relative to the largest
    component. WebGL2 gives WebGPU's bits in every output, and WebGPU's descent of 3 parameters ends
    at 2.00007, 1.00479, 0.79752.
14. On WebGL2 the render by one invocation takes 4,353 to 5,811 ms a call, the render with one
    invocation per frame 4.98 to 9.65 ms. The pass executor cuts a phase each time an invocation's
    write log of 4 entries can fill (change 0054), so one invocation's 1,024 writes take 256 phases.
    Chromium printed its performance warning 1,024 times in the run, and "too many errors" 4 times.
15. In Node the host face's `render` and `loss` give the bits of `compileModuleJs`, and Node's own
    target gives Bun's bit for bit.

## Inferences

These are inferences, not results. They rest on a shared CPU and on SwiftShader, which runs a GPU's
lanes on that CPU; the owner's devices give the real numbers.

- **The question: how many parameters fit before one step costs more than the render itself?** On
  the CPU tier, none. At 3 parameters forward mode's step already costs 14.4 renders in Node and
  9.60 in Bun. One parameter costs 1.74 to 2.93 evaluations of the loss in Bun (2.10 to 2.91 in
  Node), and the loss costs 1.51 to 1.84 renders (1.65 to 2.31 in Node), because its 16 bins cost
  more than the voice. So the step grows in a line with the count, to 407 renders at 100 parameters
  in Node. On WebGPU, forward mode runs as one dispatch of one invocation per parameter. There the
  step costs 1.07, 1.72 and 0.977 renders with one invocation per frame at 3, 10 and 30 parameters,
  and 4.38 at 100. On a GPU the count that fits in one render's time is the count of lanes the
  device runs at once; SwiftShader on 4 cores runs 30 such lanes in about one dispatch's time. What
  bounds the GPU path here is the pipeline's build, not the step: `forwardStep` of 100 parameters
  took 77,032 ms to make.
- **Is differentiable audio in the catalog with forward mode?** As offline sound matching of a small
  patch, the numbers support yes. The 3-parameter match reaches the known answer in 300 steps on the
  oracle and on both GPU tiers, `gradCheck` holds both modes to a central difference, and a step of
  3 to 30 parameters costs 1.05 to 15.2 ms on the CPU tier in Node. Two things keep it out of an
  application at the pin. No host face and no manifest carries a derivative, so the application must
  run the compiler, which Node does not load from the source tarball (ask Q). And the GPU path is
  this experiment's swap of placeholders, not the compiler's. Forward mode at 100 parameters costs
  62.0 ms a step on the CPU tier: an offline descent of 1,000 steps takes about a minute.
- **What ask L needs.** Function-level reverse mode is at the pin, and its cost moves little with
  the count. Four things stand between it and the catalog:
  1. The CPU tier's code generator must take reverse mode's loops. Through the interpreter, reverse
     mode costs 368 forward steps at 3 parameters in Node. Generated, as the probe stands for it, it
     costs 2.14 forward steps at 3 parameters and 0.263 at 100: it overtakes forward mode per
     parameter between 3 and 10 parameters in Node, and between 10 and 30 in Bun. This is the first
     candidate compiler issue below.
  2. Change 0056's step 4: derivatives on the host face and in the manifest, so an application calls
     a derivative without the compiler, and a GPU tier runs one without this experiment's swap.
  3. A loss that keeps the render: `grad` through an array local, or change 0056's steps 3 and 4 for
     a kernel function or an entry. Then the loss can use the FFT of experiment 3 over every bin,
     instead of 16 bins inside the frame loop.
  4. The reverse-mode program's size on a GPU. Its body carries the checkpoint schedule's slots for
     every value a loop carries, and each call's adjoints as a struct with one field for each float
     parameter of the callee: `level`'s adjoint has a field for every breakpoint. SwiftShader made
     `reverseStep` in 461 ms at 10 parameters and 9,850 ms at 30, and not at 100. A device run says
     whether a real driver's compiler meets the same wall.
- **The gradient's precision.** At `f32` both modes' gradients are 6.3e-3 to 3.1e-2 of the largest
  component from the `f64` gradient from 10 parameters up. Adam's descent tolerates the 9.2e-5 of 3
  parameters; whether it tolerates the error at 100 parameters is not measured.
- **Candidate compiler issues** (none is raised by this pull request; `docs/compiler-asks.md`,
  section 3, and the compiler's issues hold no report of either):
  1. `compileModuleJs`, and so the host face's CPU tier, runs a reverse-mode derivative with a loop
     in the interpreter, with no diagnostic: reverse mode writes each loop's first statement as an
     assignment, and `emitForInit` takes only a `let` or a `var` (`src/core/cpu-codegen.ts`, line
     1655, at the pin and at `87af4eb0`). The reproduction is in section "Refusals, and calls that
     did not return".
  2. On WebGPU on SwiftShader the pipeline of a reverse-mode derivative with a loop and a callee of
     many float parameters grows past usable: 9,850 ms at 30 parameters, and not made at 100
     (section "Refusals, and calls that did not return"). The program is
     `experiments/07-sound-match/out/web/program-100.json` after a run; a smaller reproduction is
     not written.
- **Candidate asks** (for the owner; no row is added to `docs/compiler-asks.md`, section 2):
  1. `grad` carries a derivative through a fixed-size local array, so a loss can keep a render (step
     2 of the method).
  2. Forward mode takes a direction as an argument, as `along` writes it by hand: one derivative for
     every parameter, which a GPU runs as one dispatch.
  3. Forward mode takes a matrix parameter, as reverse mode does.

## What this run finds in the design documents

These are facts of this run against `docs/vision.md` and `docs/experiments.md`, which this record
does not change beyond the status of section 7. Their amendment is the owner's decision.

- `docs/vision.md`, section 5, says: "Function-level forward and reverse `grad` with `gradCheck` is
  shipped." At the pin both modes and `gradCheck` are exported from `typeshade` and hold here
  (section "The numbers"). They are shipped to a host that runs the compiler. They are not shipped
  to an application: the host face and the manifest carry no derivative, so a program that imports a
  `.shade.ts` file or ships `typeshade/runtime` alone reaches none (change 0056, step 4). On the CPU
  code path a reverse-mode derivative with a loop runs in the interpreter.
- `docs/vision.md`, section 7, "Differentiable audio", says that today's form is "function-level
  `grad` and `gradCheck` over a per-sample parametric model with a small parameter vector", and that
  "a loss over a whole buffer, in reverse mode" waits for change 0056's later steps. This run
  differentiates a loss over a whole render of 1,024 frames, in both modes, as one function with a
  loop over the render's segments and frames, as long as the loss keeps nothing in an array. What
  waits is a loss that keeps the render (an FFT), and every path from a derivative to an application
  or a GPU tier.
- `docs/experiments.md`, section 7, method step 2, asks for the loss "with the FFT of experiment 3".
  At the pin `grad` refuses it (item 1 of "What departs from the method").
- `docs/compiler-asks.md`, row L, names as the workaround "forward-mode function-level `grad` over
  few parameters". The pin has function-level reverse mode as well; the row's status records what
  this run measured of both.

## What this run does not measure

- The owner's devices: a real GPU, where forward mode's invocations per parameter run side by side
  in the thousands, and where a pipeline of the size of the reverse-mode program meets a real
  driver's compiler. One record per device, `07-sound-match-<device>.md`.
- A machine with no other load: the container is shared (section "The devices").
- A loss that keeps the render: the FFT of experiment 3 in the differentiated path, which `grad`
  refuses at the pin.
- Reverse mode on the CPU tier as the compiler would run it once its loops leave the interpreter:
  the probe stands for it, through a rewrite this repository makes.
- A derivative as an application reaches it: no host face and no manifest carries one at the pin.
- The descent with more than 3 parameters to its end, and its convergence: the counts of 10, 30 and
  100 are timed over their first steps only.
- Other patches, losses or bin counts: the cost of the loss scales with its bins (16 here), and the
  ratio of a step to the render with it.
