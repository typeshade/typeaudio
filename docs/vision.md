# TypeAudio: the design

> **Status:** design, written 2026-11-02 against the compiler `typeshade/typeshade` at `main`
> `7f4e916e`, with proposals 0108, 0109, 0110 and 0116 accepted and their implementations
> (pull requests #887, #890, #883) green and awaiting merge. Every claim about the compiler
> names the section of its surface document (`docs/use-typeshade-surface.md`, "§"), the rule of
> its design rules (`docs/language-design.md`, "Rule"), or the change proposal (`changes/`,
> "change NNNN"). Everything about the engine is design intent until an experiment or an
> implementation says otherwise, and is labelled so. The API names in the sketches are not
> decided.

## 1. The claim

The compiler's developer-experience contract (`docs/dx.md`) says: the CPU oracle is `-O0`, the
meaning of the TypeScript the developer wrote; the GPU is `-O3`, the same computation faster;
the developer does not learn the GPU, they turn it on. TypeAudio adds one sentence.

**The developer does not learn the audio thread either. They schedule.**

And one rule for every design question: when the developer's experience and the engine's
throughput conflict, the experience wins. Throughput is the engine's business, and `explain`
reports it.

What that buys, in one line each:

- **One class, two sides, the same bits.** A unit is a class. The host builds it with `new` and
  tests it one sample at a time on the CPU tier. A kernel runs the same methods over a bank of
  instances on the GPU. Both compute what the oracle computes (Rule 11.1, Rule 11.7).
- **The wide axes are parallel.** Audio's time axis is sequential. Its other axes are not:
  voices, partials, grains, channels, sources, modes, impulse-response partitions. The GPU wins
  where there are thousands of those at once, and in offline rendering, analysis, verification
  and differentiable synthesis.
- **The honest boundary.** A browser's GPU round trip is milliseconds, and the AudioWorklet
  thread has no WebGPU. So the GPU renders ahead and the worklet plays. Sub-10 ms monitoring is
  not promised; playback, generative music, games with scheduled events and offline rendering
  are.

## 2. The five moments

Each moment names what the developer types, what they never see, and what the error says when
it fails. The code is a sketch.

**1. The first sound.** The setup is the compiler's own: the Vite plugin line, two `tsconfig`
lines and `tshc sync` (§64), then `npm install typeaudio`.

```ts
import { play, sine } from 'typeaudio';

button.onclick = () => play(sine(440).gain(-12));
```

Never seen: `AudioContext`, `AudioWorklet`, `SharedArrayBuffer`, a device, a block size, a tier.
The one visible boundary is the click handler, since a browser allows sound after a user
gesture. Outside a handler the error says so:
`play(): the browser allows sound after a user gesture. Call play() from a click or keydown
handler.` The first sentence is the fact, the second the remedy, as the compiler's diagnostics
are shaped (Rule 12.5).

**2. The first effect.** A patch is a value. Composing functions makes a graph.

```ts
import { play, saw, note, hz, lowpass, delay, reverb, hall } from 'typeaudio';

const lead = saw(note('A3'))
  .pipe(lowpass({ cutoff: hz(1200), q: 0.7 }))
  .pipe(delay({ time: '8n', feedback: 0.4 }))
  .pipe(reverb({ ir: hall }));

await play(lead, { at: '1:0:0' });
```

Types refuse the common mistakes before anything runs: `delay({ time: 5 })` is a type error
(time is `seconds(5)`, `ms(5)` or a note value such as `'8n'`); a 44.1 kHz buffer into a 48 kHz
bus is a type error at the call; an unsmoothed parameter into a gain is a type error. These are
the library's TypeScript types, not the compiler's.

**3. Your own DSP.** The textbook formula, as written, with a typed state.

```ts
"use typeshade";

export class OnePole {
  z: f32 = 0.;
  k: f32;
  constructor(k: f32) {
    this.k = k;
  }
  tick(x: f32): f32 {
    this.z = this.z + this.k * (x - this.z);
    return this.z;
  }
}
```

```ts
import { effect, play } from 'typeaudio';
import { OnePole } from './warm.shade.ts';

const warm = effect(OnePole, { k: 0.1 });
await play(lead.pipe(warm));
```

Never seen: the loop over voices, the loop over the block, the state array, the dispatch. The
library's kernel runs those loops and calls the method on each element; a changing method on an
element is a write to that element at that index (Rule 8.29 after change 0110; the kernel loop
over instances lowers to the GPU, as the journey of change 0109 holds). A developer who writes
the `for` loop themselves gets `TS8070` when the loop stays on the CPU, with the line and the
reason (§65).

**4. Test and debug.** A test is a render, and it needs no device.

```ts
import { render, peakDb } from 'typeaudio';

test('warm is a lowpass', async () => {
  const out = await render(lead.pipe(warm), { seconds: 1 }); // the CPU oracle tier
  expect(peakDb(out)).toBeLessThan(-0.1);
  expect(out).toMatchGolden('warm.wav'); // the same bits on every tier, §38's rows excepted
});
```

A breakpoint inside `tick` stops on the CPU with the same numbers (`typeshade/debug`);
`console.log` inside a unit reaches the host, from the GPU too under `console: 'gpu'` (§66); a
scope or spectrogram is drawn by a fragment entry of the same compiler into a canvas (§67);
when a golden differs, the determinism report (§38) says which operation may differ by driver
and by how much.

**5. Explain and perform.** One door, and it speaks the source language (`docs/dx.md`,
principle 2).

```text
explain(lead)

saw, lowpass      GPU, one dispatch
delay             GPU, its own dispatch: it reads buf[i - 4800], which another lane writes
reverb            GPU, FFT entry, 2 dispatches, latency 1024 frames
latency           2 blocks of 1024 at 48 kHz: 42.7 ms, class "playback"
last second       0 underruns; the longest block took 3.1 ms of 21.3 ms
```

Most rows come from today's `FuseReport` (`groups`, `why`, `dispatches`, `gpuTime`,
`chunkRates`, §71 and change 0074). The compiler-level `explain(f)` is roadmap item X4 and is
not shipped; the library builds its own `explain` from the report first and is X4's first
consumer.

## 3. The principles, each with the reviewer's question

The compiler's eight principles (`docs/dx.md`) are inherited whole. These are the engine's own.

| Principle                                                        | The reviewer asks of a new API                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The first sound is one line; the setup is §64's three lines      | Does a fresh project reach a sound with one click? Is the user gesture the only visible boundary?    |
| DSP is a function, the formula as written                        | Can a filter be written from its formula and a typed state, with no library abstraction learned first? |
| A patch is a value                                               | Does the caller connect, disconnect, free or order anything by hand?                                 |
| Time is a schedule; `await` only at `render` and `read`          | Does any API make the caller act inside the audio callback, or per block?                            |
| Where a node runs is said by `explain`                           | Can the caller learn a node's tier, group, latency and reason without WGSL or the report's internals? |
| Every failure names the author's line and the remedy             | Does any failure name generated text?                                                                |
| The same sound without a GPU                                     | Does the test suite need a device?                                                                   |
| A test is a render                                               | Can Vitest assert on samples and goldens with no device?                                             |
| Edit to sound in one second                                      | In `vite dev`, does an edit to a `.shade.ts` play without a restart? (measured)                      |
| Domain vocabulary in the library; lower layers are escape hatches | The questions of `docs/dx.md` principles 6, 7 and 8, unchanged                                       |

## 4. Prior art

Six models of audio programming, and what the engine takes from each.

| Model             | What the engine takes                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Web Audio API     | The node graph; `AudioParam`'s scheduled automation; the render quantum; the AudioWorklet as the sink                      |
| Tone.js           | Musical time, `'8n'` and `'1:0:0'`; a transport; one line to a sound                                                       |
| Elementary Audio  | The graph as a value of pure functions; `render(graph)` reconciled like React; state kept by key                           |
| Faust             | DSP as a pure function of signals; one source, several targets; a compiler that proves and explains. Here with TypeScript and no new syntax |
| SuperCollider     | The client and server split: the server renders, the client schedules by timestamp. The model of the GPU rendering ahead and the worklet playing |
| gen~, Cmajor      | Per-sample code with a typed state                                                                                        |

Three conclusions. None of the six runs DSP on a GPU. All six hide the audio thread behind a
schedule, and all six converge on a per-sample function and a graph of them. None has a
reference implementation its engine is checked against, nor derivatives. Those two are the
engine's own ground, inherited from the compiler's oracle and `grad`.

## 5. What is not promised

- The first play needs a user gesture. The library says so.
- Latency is a class the developer picks, `'playback'` or `'interactive'`, and the actual number
  is reported. Zero is not offered.
- A feedback loop may run on the CPU tier. `explain` says why. Nothing is silently slow.
- Floating point may differ in the last places across drivers: `sin`, `cos`, `tan`, `tanh`,
  `exp`, `log`, `inverseSqrt` and `/` within 32 ULP or 2^-11 (§38). Where exact bits matter, a
  table or polynomial oscillator is bit-exact, and the library says which is which.
- Speed needs WebGPU. Correctness does not: the CPU tier runs the same kernels.
- Whole-buffer reverse-mode differentiation waits on change 0056's later steps. Function-level
  forward and reverse `grad` with `gradCheck` is shipped.
- A long single dispatch loses the device (about 2 s on Windows; no reason on iOS Safari, per
  the compiler's `docs/hardware-notes.md`). Long renders are chunked under `timeBudgetMs`
  (change 0074) from the first day.
- The WebGL2 tier has no atomics in GLSL ES 3.00, so a histogram and the whole reductions fall to
  the next tier there (§72). The scans and the compaction run on WebGL2 since change 0072,
  Amendment 1, with element counts the call supplies. An entry that reads an array's `.length`
  in an index or a loop body runs on WebGL2 at the pin `415b276a` (compiler issues #900 and
  #689, fixed; `docs/compiler-asks.md`, ask J).

## 6. The bar

Each line becomes a check in CI once the thing it measures exists, as the compiler's bar does.

| Bar                                                                   | How it is checked                                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A fresh project reaches a sound with `npm install typeaudio` and §64's three lines | A journey in the compiler's `gate:journeys` style: the packed tarball, a fresh project, one click, the render compared |
| No GPU and no audio-thread vocabulary in an application file          | The compiler's roadmap item X1 scan, extended with `AudioWorklet`, `AudioContext`, `SharedArrayBuffer` and block |
| Every documentation snippet renders in CI                             | The compiler's `doc-snippets.test.ts` pattern                                                      |
| Every patch renders without a device                                  | Vitest on the CPU oracle tier                                                                      |
| Every failure names the author's line                                 | A diagnostic-span check                                                                            |
| Edit to sound under one second                                        | Measured in `vite dev`; the plugin already watches shader files (`addWatchFile`)                   |
| An underrun is reported, never silent                                 | An `explain` row and a counter                                                                     |
| A golden render is the same bits on every tier, §38's rows excepted   | The compiler's `gpu-differential.ts` pattern                                                       |
| A site example plays the real render                                  | The `typeshade/web` rule: no fabricated output                                                     |

## 7. What the engine does for a sound designer

Each row names the idea, why the GPU wins, and the compiler feature it rests on.

### Synthesis

| Idea                                                   | Why the GPU wins                                                                                                   | Rests on                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Additive synthesis, 10,000 partials per voice          | Partial × sample is independent; the mixdown is one `sumAxis`; `f64` phase does not drift over an hour             | §65, `sumAxis` §72, `f64` §39                     |
| Modal synthesis: bells, plates, strings                | Thousands of second-order resonators per struck object, one lane per mode                                          | §65, the `i*W + x` write form                     |
| FDTD membranes, strings and rooms                      | A stencil over a grid; time steps inside a tiled `@compute` entry with barriers, chunked under a budget; render a designed room's impulse response offline, then convolve with it | §25, change 0074                                  |
| Granular synthesis, 10,000 simultaneous grains         | A scheduler kernel pushes grains, the render kernel reads the count; `hash32(seed ^ grainId)` makes one seed reproduce a piece on every tier | changes 0078 and 0094, `typeshade/random` §73     |
| Procedural textures: rain, fire, crowds                | Thousands of micro-events, each a lane; Farnell-style procedural audio at counts a CPU cannot afford              | §65, §73                                          |
| Wavetable, FM and phase distortion at 16× oversampling | The oversample factor is an `override` constant; the voice axis hides the cost, so brute-force antialiasing is affordable | §15, change 0084                                  |
| Spectral synthesis, PadSynth-style                     | Each bin is independent; a huge wavetable in one dispatch                                                           | an FFT entry over workgroup memory, §25           |

### Effects

| Idea                                               | Why the GPU wins                                                                                                                   | Rests on                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Convolution reverb with a 10-second impulse response | Partitioned FFT convolution is a frequency-domain delay line; every partition's multiply-add is parallel; true-stereo and ambisonic IRs; 100 sources × 100 IRs for a game | §25, `Resident`                           |
| Spectral effects                                   | STFT frames are independent: denoise, vocoder, cross-synthesis, pitch shift, spectral delay and freeze; offline time stretch is parallel over output frames | §25, §71                                  |
| FIR, linear-phase EQ, sinc resampling              | Each output sample is independent; a 1000-tap sinc per sample is one kernel                                                        | §65                                       |
| Per-voice IIR: biquad banks, `tanh` ladder filters | Sequential inside a lane, parallel over voices; 1000 voices each with a four-pole filter                                            | §65, the class model of section 8         |
| Time-parallel linear recurrences                   | A one-pole, a DC blocker and an envelope follower are first-order scans; a biquad is a 2×2 matrix scan with `mat2x2<f64>` state; "a whole song through an IIR EQ" becomes parallel over time | the two-loop scan form of §72, §39        |
| Saturation and ADAA                                | Per-sample maps fuse into one dispatch; ADAA's read of `x[i-1]` is a read of the input, which the proof admits                      | §71 fact F3, §65 rule R4                  |
| Dynamics                                           | A lookahead limiter's window maximum is a read of the input, so it is parallel; the envelope follower is sequential per channel; a multiband split is linear-phase and parallel | §65                                       |
| Delays, chorus, FDN reverbs                        | With a delay of at least one block, feedback crosses blocks only; inside a block the lines and the samples are parallel, and a 64-line Hadamard mix is a matrix product per sample | `Resident` ring buffers, §71              |

### Space and analysis

| Idea                                                              | Why the GPU wins                                                                                   | Rests on                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| HRTF binaural for hundreds of sources; 7th-order ambisonics; WFS  | Source × sample × FIR is independent; an ambisonic decode is a matrix product per sample           | §65, §40                            |
| Acoustic ray tracing and image sources                            | Thousands of rays are the GPU's daily work; the compiler's SDF ray tracer example is the neighbour | change 0021                         |
| Spectrograms, CQT, chroma, YIN, onsets, EBU R128 loudness         | Frames, lags and gating blocks are independent; the scope is a fragment entry of the same file     | §65, §67, Rule 7.2 reductions       |
| Neural audio with TypeNN                                          | TypeNN's operations are kernel functions and each `data()` is a `fuse` scope; if the two libraries agree on `Resident` as the exchange format, a neural effect joins the same plan with no copy | `typeshade/web`, `apps/typenn/PRODUCT.md` |

### Differentiable audio

Sound matching by gradient: fit an FM, additive or modal patch to a target sound; learn an EQ to
a reference; estimate an impulse response from a recording; DDSP with TypeNN. Today: function-
level `grad` and `gradCheck` over a per-sample parametric model with a small parameter vector.
After change 0056's later steps: a loss over a whole buffer, in reverse mode.

### Verification as a feature

Every effect has a CPU oracle twin: golden renders, tier parity, and a determinism report that
says where `sin` may differ by driver and by how much. A render manifest can state "this bounce
is reproducible across devices, except these operations within this bound". Change 0110's class
arm holds every exported unit class to one result on every tier, on the host and on the oracle.

## 8. The architecture

`docs/architecture.md` is the detail of this section: the loop shapes, the block plan, the
banks, the buses, the events, the transports and the decisions the owner takes.

### Layers

| Layer          | Owns                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| 0. TypeShade   | The language, the compiler, the generated programs, the runtime. Unchanged by this engine.              |
| 1. Kernels     | `.shade.ts` units: oscillators, filters, windows, an FFT entry, convolution, resamplers; a host face baked as `typeshade/algorithms` bakes its own (Rule 11.20). Whether the FFT lives here or later as a common module `typeshade/fft` is a decision to make. |
| 2. Graph       | `Signal`, `Bus`, `Node`: a deferred graph, as TypeNN's Tensor graph; `render()` runs one block as one `fuse` scope; the fuse report is the explanation of why a chain is two dispatches. |
| 3. Transports  | Offline to a `Float32Array` or a WAV; real time through a Worker that holds WebGPU, a `SharedArrayBuffer` ring and an AudioWorklet that plays; the CPU tier of the same kernels inside the worklet for the latency-critical path, once experiment 2 confirms it loads there. |

### Four layers of composition, and the class model

A class is its struct and its functions in every place a struct or a function can be
(Rule 8.29, change 0110). The engine composes in four layers, each with one kind of work:

| Layer                 | What                                              | How it composes             | Cost                                                     |
| --------------------- | ------------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| 1. A unit             | A class with state fields and a `tick` method     | None; one responsibility    | None                                                     |
| 2. Static composition | A class whose fields are units, such as `Voice`   | Fields and generics         | None; monomorphised and inlined into one lane            |
| 3. A kernel           | One loop over `array<Voice>`                      | The loop only; no math      | One dispatch                                             |
| 4. The host graph     | Kernels imported and wired                        | `fuse` plans it             | A few dispatches; `explain` says which and why           |

Rule 8.6 enforces the shape: a kernel function is called by no other function, so composition
inside a file is always by classes and composition between kernels is always on the host. A
kernel is a boundary and a class is a component.

```ts
"use typeshade";
import { Ladder } from 'typeaudio/units'; // an npm shader package, change 0024

interface Source { tick(): f32; }
interface Effect { tick(x: f32): f32; }

class Phasor implements Source {
  phase: f32 = 0.;
  inc: f32 = 0.;
  tick(): f32 {
    this.phase = fract(this.phase + this.inc);
    return this.phase;
  }
}

class Serial<A extends Effect, B extends Effect> implements Effect {
  a: A;
  b: B;
  constructor(a: A, b: B) { this.a = a; this.b = b; }
  tick(x: f32): f32 { return this.b.tick(this.a.tick(x)); }
}

class Voice {
  osc: Phasor = new Phasor();
  chain: Serial<Ladder, OnePole> = new Serial(new Ladder(), new OnePole(0.1));
  tick(): f32 { return this.chain.tick(this.osc.tick() * 2. - 1.); }
}

/** The kernel: the loop only, one lane per voice. */
export function synth(out: array<f32>, voices: array<Voice>, block: u32) {
  for (let v: u32 = 0; v < voices.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = voices[v].tick();
    }
  }
}
```

The clean-code rules follow from the layers: one class, one responsibility, and `tick` writes
nothing outside `this` (the proof's rule R5 forbids a module-variable write in a kernel loop);
state lives in fields only; composition is by fields and generics, `abstract` for shared math,
`implements` for contracts; a kernel holds no math; a unit library is a package imported by
name; an annotation declares and never computes.

**The boundary of dynamic polymorphism.** An abstract class is a base and never a value (§26);
there are no pointers and no virtual calls. A graph whose node kinds change at run time inside
one lane is written in two ways only: a closed set as a `kind` tag and a `switch` (change 0097
lowers a costly arm to an `if`, so an arm not taken does not run), or on the host graph.
SuperCollider draws the same line: a SynthDef is static, the server's graph of synths is dynamic.

### The host face

What the host sees of a unit is decided by the compiler's host face (§64), and four proposals
of 2026-11-02 shape it: 0108, the view carries the author's JSDoc; 0109, an exported class is a
value of the host face (`new` and methods on the CPU tier, an instance wherever the struct's
object is taken); 0110, Rule 8.29 and the class arm of the differential gate; 0116, the view
spells each type with the shader's own name (`array<f32>`, `vec3`, `u32`) from a family of host
types `typeshade/runtime` exports. `docs/compiler-asks.md` tracks each.

## 9. The honest boundaries

### Latency

| Item                                   | Value                                              | Source                                             |
| -------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 128 frames at 48 kHz                   | 2.67 ms                                            | The Web Audio render quantum                       |
| 1024 frames at 48 kHz                  | 21.3 ms                                            | Arithmetic                                         |
| 4096 frames at 48 kHz                  | 85.3 ms                                            | Arithmetic                                         |
| A fenced chunk's cost on a real device | At chunks of 4.1 ms the fences cost more than the work | compiler `docs/hardware-notes.md`, row A5, a typecv record |

Inference: the GPU round trip is milliseconds, so real time is blocks of 512 to 1024 frames
rendered two or three blocks ahead, about 40 to 70 ms end to end. Enough for playback,
generative music, games that schedule ahead and a DAW's offline render; not enough for live
monitoring. The AudioWorklet thread has no WebGPU and no dynamic `import`; the compiler's
runtime imports its WebGL2 tier dynamically (`src/runtime/runtime.ts`), so a worklet build of
the CPU tier is a compiler ask (`docs/compiler-asks.md`, F). Experiment 1 measures the round
trip on the owner's devices; experiment 2 tries the CPU tier inside a worklet.

### Tiers and determinism

- WebGPU is the fast path. WebGL2 runs a `@compute` entry as passes cut at barriers (change
  0054) and refuses what GLSL ES 3.00 cannot spell. The CPU tier runs every kernel and, since
  change 0092, entries with barriers too.
- The determinism report (§38) lists the operations that may differ by driver, within 32 ULP or
  2^-11; everything else is bit for bit. A driver may flush subnormals to zero and the JavaScript
  oracle does not; filter and reverb tails reach subnormals, so this is the first thing the
  experiments measure across tiers (`docs/compiler-asks.md`, E).
- `f64` is an emulated double (§39): about 48 bits of significand, `sin`, `cos`, `sqrt`,
  `floor`, `fract`, `mix` and the comparisons, and no `exp`, `tan`, `log`, `pow` or `atan2`.
  Coefficient math that needs those runs on the host in JavaScript doubles today, uploaded as
  the two words an `f64` is; the device-side forms are a compiler ask (D).

## 10. The compiler loop

The engine is the compiler's second hardware laboratory, as TypeCV is its first. The loop,
as TypeCV ran it for change 0074:

1. Write the workaround in this repository first.
2. Measure it on devices and keep the record ids.
3. Raise the general part as an issue on `typeshade/typeshade` that asks for compiler work.
4. Let the compiler side decide how to meet it.
5. Ask for a language change only as the last resort, when compiler work cannot meet the need.
6. When the work is implemented, move the pin.
7. Record any proposal id in `compiler-changes.md` and retire the workaround.

The audio-shaped pressures the compiler did not get from graphics and vision: time recurrence,
subnormals, the precision of transcendentals, the worklet, and the metadata channel from a
class to the host. `docs/compiler-asks.md` is the ledger.

## 11. The first experiments

`docs/experiments.md` lists them in order with their status. Measurement comes before any
proposal: the round trip per block size, the CPU tier in a worklet, the FFT entry held to the
oracle on three tiers, a 10,000-partial additive render with the fuse report read, a 10-second
partitioned convolution, a granular scheduler on `push` and device-resident counts, and a sound
match with function-level `grad`.

## 12. Status and baselines

- Design written 2026-11-02 in a Claude Code session with the owner, in Korean, against the
  compiler at `main` `7f4e916e`. The session's proposals: 0108 (#871, accepted), 0109 (#872,
  accepted), 0110 (#873, accepted), 0116 (#876, accepted; renumbered from 0111 in #884);
  issues #900, #901 and #908.
- Nothing in this repository is implemented. The first code sets the compiler pin.
