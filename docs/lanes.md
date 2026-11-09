# Spreading an event over several lanes

> **Status: a proposal, for the owner to decide.** No code changes with this note. The owner
> decided on 2026-11-09 that the next engine work is to spread an event over several lanes. This
> note shows what changes, one example before and after, and three options with their costs, as the
> owner's rule OD-4 asks. The owner picks the design before anything is implemented.

Labels in this note: **Fact** is read from a record or from the code. **Inference** is reasoned
from facts and is not measured. **Proposal** is a design choice for the owner.

Documents read: `docs/records/08-sound-design-container.md` and its `-tiers.json`,
`docs/architecture.md` sections 2 and 3, `docs/compiler-asks.md` ask AA and ask T, and the
compiler's `docs/use-typeshade-surface.md` sections 65 and 71 at the pin `415b276a`. Code read:
`src/kinds/*.shade.ts`, `src/kinds/make.ts`, `src/units/*.shade.ts`, `src/render-plan.ts`,
`src/kernels/synth.shade.ts` and `src/kernels/mixdown.shade.ts`, at `e54628ef`.

## 1. The problem

**Fact.** Each block of 1,024 frames is one `dev.fuse` scope of 33 calls. The block budget is 21.33
ms at 48 kHz.

**Fact.** Record 08 measured the mean GPU time of each group on WebGPU (SwiftShader) over 40
blocks. The sum is 46.05 ms, and `cues` takes 33.09 ms of it, 71.8 %. The median block takes 52.28
ms. No tier keeps the budget.

**Fact.** `cues` (`src/kinds/cue.shade.ts`) is shape V: one lane per event, 25 lanes for the
fixture. Each lane is a serial loop over the 1,024 frames of the block through the `tick` of the
event's kind. A `tick` holds state: a filter's memory, or a phase that moves each frame.

**Inference.** 25 lanes are 25 invocations. A GPU runs thousands at once, so most of it idles while
each lane walks 1,024 frames. The time of `cues` is then the cost of the slowest lane, and not the
sum of the work.

**Fact.** The container cannot measure a real GPU's occupancy. SwiftShader runs on the same four
CPU cores as the tests. The device run (section 6) must show what occupancy does.

**Fact.** Two more numbers frame the goal. Item 5 of `docs/sound-design-loop.md` asks for a 15 s
variant in under one second. 15 s are 704 blocks, so one block may take 1.42 ms. Real time needs
21.33 ms.

## 2. What a kind is made of today

**Fact.** The table is read from the units. "Stateless" means the sample at frame `a` is a function
of `a`, the event's key and the unit's fields. "Stateful" means a recursion: the sample needs the
last output or state.

| Kind       | Stateless today                                                        | Stateful today                   |
| ---------- | ---------------------------------------------------------------------- | -------------------------------- |
| `whoosh`   | noise, sweep centre, `svfCoef`, envelope                               | one `Svf` on the noise           |
| `impact`   | sub sine (needs a closed form), noise, decays, click                   | one `OnePole` on the noise burst |
| `shimmer`  | all six partials (a `Sine` of constant `inc`), their decays and attack | none                             |
| `riser`    | sine chirp (needs a closed form), noise, cutoff, swell                 | one `Svf` on the noise           |
| `wind`     | both LFOs, both coefficients, both noises, fade                        | two `Svf`: body and howl         |
| `drone`    | three saws (`fract(inc * a)`), sub sine, fade                          | one `Lowpass` on the saw sum     |
| `footstep` | eight `Grain` (`Grain.at(t)` reads no state)                           | none                             |
| `cloth`    | eight `Grain`                                                          | one `OnePole` on the grain sum   |
| `voice`    | the stem times the level                                               | none                             |

**Fact.** In the fixture, `shimmer` (3), `footstep` (4) and `voice` (3) have no recursion: 10 of 25
events. The other 15 events have one filter, or two for `wind`.

**Fact.** A filter step is cheap. `Svf.step` is three multiply-adds. `OnePole.tick` is one.
`Biquad.tick` is five multiplies.

**Fact.** The rest of a `tick` is not cheap. Per frame, `whoosh` calls two `hash32`, `exp` and two
`sin`. `shimmer` calls six `sin` and twelve `exp`. `wind` calls four `hash32` and four `sin`.

**Inference.** For the filtered kinds, most of the serial cost is the stateless part, and not the
recursion. Record 08 has no split by kind, so this is not measured. Section 6 starts with the split.

**Fact.** A `Cue` holds the units of all nine kinds. I count about 180 32-bit fields in its
declarations. I did not check this against the emitted struct. Each lane carries all of them,
whatever its kind.

## 3. Three options

### Option A. Components as lanes

**What it is.** A `Cue` becomes K lanes, one per component of its kind. A sum kernel of shape G
folds the component lanes into the event's lane before `history` and `place`.

**Proposal, K per kind.** One lane for each term of the kind's sum, where the sum is a sum:

| Kind       |   K | The lanes                                           | Events in fixture |  Lanes |
| ---------- | --: | --------------------------------------------------- | ----------------: | -----: |
| `whoosh`   |   1 | the filtered noise (one recursion; it cannot split) |                 4 |      4 |
| `impact`   |   3 | sub, noise burst, click                             |                 4 |     12 |
| `shimmer`  |   6 | one per partial (15 of 18 sound in the fixture)     |                 3 |     18 |
| `riser`    |   2 | sine chirp, filtered noise                          |                 1 |      2 |
| `wind`     |   2 | body, howl                                          |                 2 |      4 |
| `drone`    |   2 | saws through the lowpass, sub sine                  |                 3 |      6 |
| `footstep` |   8 | one per grain                                       |                 4 |     32 |
| `cloth`    |   8 | one per grain, each with its own `OnePole`          |                 1 |      8 |
| `voice`    |   1 | the stem                                            |                 3 |      3 |
| **Total**  |     |                                                     |            **25** | **89** |

**Fact.** Shimmer density 0.5, 0.7 and 0.8 gives 4, 5 and 6 sounding partials: 15 in all.

**Inference.** The fold keeps today's bits where a component is one term of a left-to-right sum:
`impact` (`s + n + c`) and `shimmer`. Zero plus a term is exact. `cloth` changes bits: the
`OnePole` is linear, so a filter per grain gives the same sound with other rounding.

**Cost.**

- Code changed: `cue.shade.ts` (a narrower `Part` class and a closed set of component classes),
  every kind file, `make.ts` (one event makes K parts), `render-plan.ts` (lane bookkeeping: which
  parts are one event). The nine kinds are rewritten as components.
- New kernels: one fold, `sumParts`, shape G. It writes one `f32` array at its counter and gathers
  the K parts of each event. Ask AA lets WebGL2 draw it. Ask T (the sum over lanes) does not bear
  on it, since it sums at most eight terms.
- What `explain` shows: `cues` with 89 lanes, then `sumParts` with 25,600 invocations (25 events by
  1,024 frames). The `Part` struct is narrower than today's `Cue`, or the bank grows with the lanes.
- What the tests must hold: the fold equals the old `tick` sum within a stated tolerance, and
  exactly for `impact` and `shimmer`; a part's silence outside `start` and `end`; the same bits on
  every tier that runs it.
- Risks: 89 lanes are still 89 invocations. A lane that is a recursion keeps its length. `whoosh`,
  `riser`'s noise and `voice` do not gain at all. Lanes of different components in one workgroup
  diverge on the `kind` branch. Most grain lanes are silent for most of a block.

**Does not solve.** Occupancy stays about 90 invocations against thousands. The critical path falls
only where a kind is a sum of terms.

### Option B. Frame slices for the stateless parts

**What it is.** Each part of a kind that is stateless today runs as one invocation for each
(lane, frame) pair. Each recursion stays one serial loop for each lane, and it reads the stateless
parts from scratch arrays. The pass over the frames is written in shape F's form: it writes one
array at its counter.

**Proposal.**

1. Pass 1 has the trip count `lanes * block` (25,600 for the fixture). It runs four calls: `direct`
   (the complete sample of a stateless kind, and the stateless terms of the others), `drive` (the
   input of the filter), `coef` (the filter coefficient of the frame) and `env` (the gain after the
   filter). Each call writes one `f32` array at `i`.
2. Pass 2, `recur`, replaces `cues`. It is a shape V kernel over the lanes, serial over the
   block. It runs the filter recursion on `drive` and `coef`, multiplies by `env` and adds `direct`.

**Fact.** A stateless part needs the absolute frame. `Cue.t` is a counter today. In this design the
host passes the first frame of the block, `at`, as a scalar argument, and `age` is `t - start`.

**Inference, by kind.** From section 2:

- `shimmer`, `footstep` and `voice` run wholly in pass 1; `recur` copies them.
- `whoosh`, `riser`, `drone`, `cloth` and `impact` move their noise, envelope and
  transcendental work into pass 1. `recur` keeps one cheap recursion each.
- `wind` has two recursions. One pair of arrays holds the body; a second pair holds the howl. Or the
  howl is a component lane (option A, for this kind only). The owner decides (section 7).

**Cost.**

- Code changed: each unit gains pure methods that take the frame (`direct`, `drive`, `coef`, `env`)
  and loses its `age` counter. `Cue` dispatches on `kind` in each method. `make.ts` is unchanged.
  `render-plan.ts` passes `at`.
- New kernels: four in pass 1, and `recur`. Scratch arrays: four of `lanes * block`, 100 KB each as
  `f32` for 25 lanes.
- What `explain` shows: the four pass 1 calls as one group (**Inference:** facts F1 to F5 hold: one
  loop each, one trip count, a write at the counter, distinct arrays, six buffers against eight)
  with 25,600 invocations, then `recur` with 25 lanes.
- What the tests must hold: (1) a render in blocks of 1,024 and in blocks of 512 gives the same bits
  for the stateless parts; (2) the closed forms of the `impact` sub and the `riser` chirp match the
  old accumulated phase within a stated tolerance (a one-time analysis test); (3) the same bits on
  every tier that runs each kernel; (4) the checklist of the fixture stays within its thresholds.
  The goldens of the render are baked again.
- Risks: a closed-form phase in `f32` loses precision at large frame counts. A drone of 12 s
  reaches frame 576,000. The phase may need `f64` or an integer turns counter (to be measured, not
  decided here). Sums of a closed form and an accumulated one differ in the last bits. `recur` still
  writes the bank and an array, so WebGL2 still refuses it (ask AA, "writes more than one array").
  The pass 1 calls write one array each, so they are a candidate for WebGL2.

**Does not solve.** The recursion of each filtered lane stays 1,024 serial steps. Its cost per step
falls, and its length does not. A parallel scan of a time-varying filter is out of scope.

### Option C. Several blocks per dispatch

**What it is.** Render M blocks in one `fuse` scope to amortize the per-block fixed cost.

**Fact.** A lane's loop would walk M times 1,024 frames serially, so the dispatch takes about M
times as long. The invocation count stays 25. C does not help the serial loop.

**Inference.** The most C can recover is the host overhead of a block: the median block (52.28 ms)
minus the GPU sum (46.05 ms) is 6.23 ms. This figure includes the read of `out`.

**Cost.**

- Code changed: `render-plan.ts`. Recording M copies of the 33 calls gives 33M calls and 32M
  dispatches, and saves submissions and reads only. Widening `BLOCK` (`src/spatial/room.ts`) to
  `M * 1024` keeps the dispatch count, but it changes the convolution's partition size, the history
  and the FFT stages.
- What `explain` shows: M times the groups, or one block of `M * 1024` frames.
- What the tests must hold: the same bits as M single blocks.
- Latency (`docs/architecture.md`, sections 3 and 8): the transport renders `lookahead` blocks ahead,
  3 by default (D5). A dispatch of M blocks must finish before the ring runs dry, and the first
  sound waits M blocks. For an offline render, latency does not matter.

**Does not solve.** `cues` takes the same GPU time per block. C is the option for the one-second
goal, since 1.42 ms per block is below today's 6.23 ms of host overhead. It stands apart from lanes.

## 4. Recommendation

**Proposal.** Build option B first. The stateless parts hold most of the serial cost for the filtered
kinds and all of it for ten of the 25 events, and B turns them into 25,600 invocations with no
change to a plan, a kind or a sound. Option A gives 89 lanes and no gain for `whoosh`, `voice` or any
recursion, so use it only for the second filter of `wind` if B needs it.

**Does not solve.** It does not shorten the recursion of a filtered lane. It does not reach the
1.42 ms block, which also needs the other groups (13 ms of 46 ms on SwiftShader) and the fixed
cost of option C. It does not give WebGL2 a program for `recur`.

## 5. One block, before and after

**Fact.** Today's plan, from record 08 (33 calls, 32 dispatches):

| Calls                                                               | Loop shape | Lanes or trip count |
| ------------------------------------------------------------------- | ---------- | ------------------- |
| `cues`                                                              | V          | 25 lanes            |
| `history`                                                           | F          | 128,000             |
| `place`, `layers`, `strips`                                         | V, G, V    | 25, 1,024, 5 lanes  |
| `sendSum`, `pad`, 22 `fftStage`, `store`, `accumulate2`, `overlap2` | F, G       | unchanged below     |
| `pack`                                                              | F          | 12 rows             |

`store` fuses into the eleventh `fftStage`, so 33 calls run as 32 dispatches.

**Inference.** The plan after option B (37 calls, 33 dispatches), by facts F1 to F5 of surface
section 71. `explain` confirms it or does not.

| Calls                                   | Loop shape | Lanes or trip count  | Change     |
| --------------------------------------- | ---------- | -------------------- | ---------- |
| `direct`, `drive`, `coef`, `env`        | F          | 25,600, one dispatch | new        |
| `recur`                                 | V          | 25 lanes             | was `cues` |
| the other 32 calls, `history` to `pack` |            |                      | unchanged  |

### One kind: `impact`

**Before.** `Impact.tick`, as in `src/kinds/impact.shade.ts`: one serial walk, state in `age`,
`sub.phase` and `lp.z`.

```ts
tick(): f32 {
  const age = this.age;  this.age = age + 1;
  const a = f32(age);
  this.sub.inc = this.base * (1 + this.drop * exp(-a * this.dropRate));
  const s = this.sub.tick() * exp(-a * this.subDecay) * this.aSub;
  const n = this.lp.tick(noise(this.key, age)) * exp(-a * this.noiseDecay) * this.aNoise;
  let c = 0;
  if (a < this.clickLen) { c = noise(this.key ^ 12345, age) * (1 - a / this.clickLen) ** 2 * this.aClick; }
  return s + n + c;
}
```

**After (a sketch, not compiled).** The unit gains pure methods of the frame `a`. The sub's phase is
the geometric sum of its steps, and not an accumulated field.

```ts
// In Impact: pure, so a call on an element of the bank is a read (Rule 8.29).
direct(a: u32): f32 {
  const f = f32(a), r = this.dropRate;
  const turns = this.base * (f + this.drop * (1 - exp(-f * r)) / (1 - exp(-r)));
  const click = f < this.clickLen ? noise(this.key ^ 12345, a) * sq(1 - f / this.clickLen) * this.aClick : 0;
  return sin(TAU * fract(turns)) * exp(-f * this.subDecay) * this.aSub + click;
}
drive(a: u32): f32 { return noise(this.key, a) * exp(-f32(a) * this.noiseDecay) * this.aNoise; }

// Pass 1: one invocation for each (lane, frame); one array written, at `i`.
export function drive(out: array<f32>, cues: array<Cue>, at: u32, block: u32) {
  for (let i: u32 = 0; i < out.length; i++) { out[i] = cues[i / block].drive(at + (i % block)); }
}
// Pass 2: the recursion only. It writes `raws` and the bank, so WebGL2 refuses it (ask AA).
export function recur(raws: array<f32>, cues: array<Cue>, dir: array<f32>, drv: array<f32>, at: u32, block: u32) {
  for (let v: u32 = 0; v < cues.length; v++)
    for (let n: u32 = 0; n < block; n++) raws[v * block + n] = dir[v * block + n] + cues[v].lowpass(at + n, drv[v * block + n]);
}
```

**Fact.** `drive` and `direct` are one loop each that writes one `f32` at its counter. Ask AA does
not refuse that form. `recur` writes two arrays, as `cues` does, and WebGL2 refuses it with the same
sentence as today. `lowpass` returns 0 outside `start` and `end` and leaves `lp.z` as it is.

**Inference.** Per frame, the serial loop falls from three `exp`, one `sin` and one or two `hash32`
to one multiply-add. The numbers of that fall are for section 6 to measure.

## 6. The measurement plan

**Proposal.** Run these in order. Each run records the command, the date, the commit, the pin, the
Bun version and the load average, as record 08 does.

1. **The split by kind (before any code).** Render the fixture with the events of one kind at a time
   on WebGPU, and record the mean GPU time of `cues` for each. This tests the inference of section 2.
2. **The smoke run on the container, before and after.**
   `TYPESHADE_CHROMIUM=<chromium> bun run exp:08 --tier webgpu --blocks 40 --repeat-blocks 2 --variant-seconds 0`.
   Record `cues` (33.09 ms, 71.8 %, record 08 command 2), and after the change the sum of the
   pass 1 group and `recur`. Run it at least three times, since the container is shared.
3. **The device run on the owner's GPU.** `bun run exp:08` with the defaults, on WebGPU. The option
   passes when the median and p95 of the block time are below 21.33 ms. Record the `gpuTime` of each
   group, so that `cues` and its successors are visible.
4. **The variants.** The two 15 s variants, cold and warm, with `--variant-seconds webgpu=15`. The
   target is one second for each. That is 1.42 ms for each of 704 blocks.

**Fact.** SwiftShader is a CPU. A gain there is a gain in total work and in SIMD use. It is not a
gain in occupancy. A device result decides, and a container result that shows no gain does not
refute the option.

**Fact.** The tests do not read the GPU for this change. `bun run test:gpu` is not needed for this
note, which changes no code.

## 7. What the owner decides

1. The option: B first (the recommendation), A, or C.
2. Whether a closed-form phase may change the bits of the render, with new goldens, in exchange for
   the frame-parallel form.
3. For `wind`: one more pair of arrays for the howl, or a component lane for it.
4. Whether C, for offline renders only, is a separate note after B.

## 8. What the design does not change

- The plan format (`docs/sound-design-loop.md`, "The schema") and the validator.
- The checklist and its thresholds. They are read again after the change, as test (4) of option B.
- The spatial chain: `history`, `place`, `layers`, `strips`, the send and the convolution. They read
  `raws` as they do today.
- The master (`src/master.ts`): the loudness target and the limiter.
- The event key (`eventKey`) and every draw from it: an edit to one event changes that event only.
