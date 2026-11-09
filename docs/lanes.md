# Spreading an event over several lanes

> **Status: decided on 2026-11-09.** No code changes with this note. The owner decided that the next
> engine work is to spread an event over several lanes. The owner answered the four questions of
> section 7 as follows.
>
> - **Decision 1.** Build option B first.
> - **Decision 2.** The closed-form phase may change the bits of the render, with new goldens. A
>   stated tolerance is checked once against the accumulated phase. The precision of long events is
>   measured, and an integer turns counter is added if the measurement asks for it.
> - **Decision 3.** The howl of `wind` takes a second pair of scratch arrays in `recur`, not a
>   component lane.
> - **Decision 4.** Option C is a separate note, written after the device measurement of option B.

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
   **Result of step 1 (2026-11-09).** Command:
   `TYPESHADE_CHROMIUM=<chromium> bun experiments/08-sound-design/run-split.ts` (40 blocks, WebGPU on
   SwiftShader, commit `9a423a0`, Bun 1.4.4, load average 6.61 4.79 3.89 before and 5.71 4.72 3.89
   after). Each event starts at frame 0, so every lane sounds in every timed block. The table is the
   mean GPU time of the group that holds `cues`, for 1 lane and for 9 lanes of one kind (the fixture's
   first event of the kind, under nine ids).

| Kind       | 1 lane (ms) | 9 lanes (ms) | Per added lane (ms) |
| ---------- | ----------: | -----------: | ------------------: |
| `whoosh`   |        5.06 |        13.94 |                1.11 |
| `impact`   |        4.64 |        14.36 |                1.22 |
| `shimmer`  |        4.91 |        14.15 |                1.16 |
| `riser`    |        4.63 |        13.64 |                1.13 |
| `wind`     |        5.23 |        15.15 |                1.24 |
| `drone`    |        5.17 |        14.71 |                1.19 |
| `footstep` |        5.22 |        13.92 |                1.09 |
| `cloth`    |        5.19 |        14.56 |                1.17 |
| `voice`    |        5.33 |        15.30 |                1.25 |

The whole fixture at frame 0 (25 lanes) gives 33.82 ms for `cues` and a block median of 53.79 ms.

**Fact.** The cost of a lane does not depend on its kind. `voice` computes `x * level` and costs as
much as `wind`, which calls four `hash32` and four `sin` a frame. A first lane costs about 5 ms, and
each added lane about 1.2 ms. The 25 lanes of the fixture cost about 5 + 24 x 1.2 = 34 ms, which is
the measured 33.82 ms.

**Inference, and it contradicts the inference of section 2.** The cost of `cues` on SwiftShader is
a per-lane, per-frame cost that the kind's arithmetic hardly changes. The stateless arithmetic is
not most of the serial cost here. Candidates, not measured: the load and the store of the whole
`Cue` (about 180 fields) around each `tick`, and the dispatch on `kind`. Step 1b tests both. Option B moves the
arithmetic into pass 1 and leaves a per-lane, per-frame cost of the same size in `recur`, so it
cannot be expected to cut `cues` on this machine until that cost is understood.

**Step 1b: the overhead (2026-11-09).** Step 1 found a per-lane cost that does not depend on the
kind. Three measurements look for its cause. Configuration: commit `9a423a0` plus the scratch files
`experiments/08-sound-design/overhead.shade.ts`, `overhead.ts` and `run-overhead.ts`, Bun 1.4.4,
the pin `415b276a`, WebGPU on SwiftShader and the CPU tier in Node.

**(a) The emitted WGSL of `cues`.** Fact. The module's manifest entry `cues` holds the kernel's
WGSL (`hostFace` over `src/kinds/cue.shade.ts`). The frame loop passes a pointer to the bank element
and copies nothing:

```wgsl
for (var n: u32 = 0u; (n < cues_args.block); n = (n + 1u)) {
  out[((v * cues_args.block) + n)] = Cue_tick(&lanes[v], inputs[((v * cues_args.block) + n)]);
}
fn Cue_tick(self_: ptr<storage, Cue, read_write>, x: f32) -> f32 {
  let t = (*self_).t;
  (*self_).t = (t + 1u);
```

Each field access is a load or store on the storage buffer. Per frame in `Cue_tick` there are 4 loads
(`t`, `start`, `end`, `kind`) and 1 store (`t`), then the loads and stores of the kind's own fields:
for `whoosh`, 11 loads and 3 stores; for `voice`, 1 load. The loop does not load or store the whole
`Cue`. The struct is 716 bytes (179 words, from the manifest's layout). On the CPU tier the generated
JavaScript reads the element and writes it back around each call (`$t2[$t3] = $.inout.values[0]`), a
reference to one object.

**(b) and (c), and two forms that separate the causes.** Command:
`TYPESHADE_CHROMIUM=<chromium> bun experiments/08-sound-design/run-overhead.ts` (40 blocks after 3 of
warm-up; 1 lane and 9 lanes of the fixture's first `whoosh`; three runs, load average 4.03 to 5.70).
The table is the mean of the three runs. WebGPU columns are the mean GPU time of the call; CPU
columns are the median host time of the block's `fuse` scope and read.

| Form                                                                                       | WebGPU 1 lane (ms) | WebGPU 9 lanes (ms) | WebGPU per added lane (ms) | CPU 1 lane (ms) | CPU 9 lanes (ms) | CPU per added lane (ms) |
| ------------------------------------------------------------------------------------------ | -----------------: | ------------------: | -------------------------: | --------------: | ---------------: | ----------------------: |
| `cues` (as on `main`)                                                                      |               5.20 |               15.31 |                       1.26 |            0.35 |             1.94 |                    0.20 |
| hoisted: `let c = lanes[v]` before the frame loop, `lanes[v] = c` after it (c)             |               2.69 |                7.96 |                       0.66 |            0.43 |             2.12 |                    0.21 |
| wide: full `Cue` in the bank, kernel ticks `whoosh` directly, no window check, no dispatch |               0.36 |                0.92 |                       0.07 |            0.29 |             1.99 |                    0.21 |
| one branch: full `Cue`, window check and dispatch in the kernel, `whoosh` branch only      |               0.46 |                0.97 |                       0.06 |            0.27 |             2.01 |                    0.22 |
| inlined: full `Cue`, window check and all nine branches written out in the kernel          |               5.45 |               16.35 |                       1.36 |            0.27 |             2.13 |                    0.23 |
| narrow: `NarrowCue` with the `whoosh` fields only (b)                                      |               0.41 |                0.88 |                       0.06 |            0.24 |             1.60 |                    0.17 |

Fact: the language at the pin accepts the struct value copy of the hoisted form. `tshc check` reports
no refusal, and the emitted WGSL is `var c: Cue = lanes[v];`, then `Cue_tick(&c, ...)` in the loop,
then `lanes[v] = c;`.

Facts from the table:

- Narrowing the bank to the `whoosh` fields (b) cuts the per-lane cost from 1.26 ms to 0.06 ms.
- The wide form keeps the 716-byte struct and costs 0.07 ms a lane. The width of the struct is not
  the cost.
- The one-branch form costs 0.06 ms a lane. The inlined form, with all nine branches, costs 1.36 ms,
  as `cues` does. The call of `Cue_tick` is not the cost. The nine branches present in the loop body
  are, although one lane takes one of them.
- Hoisting the element into a local (c) halves `cues`: 5.20 ms to 2.69 ms, and 1.26 to 0.66 ms a lane.
- On the CPU tier every form costs 0.17 to 0.23 ms a lane. None of the forms changes the CPU tier.

**Inference.** The numbers point to the size of the dispatch body, and not to the struct width. A
loop body that holds the nine kinds costs about 20 times a body that holds one, and the kernel
takes one branch for each lane. The per-frame load and store of the bank element is a second, smaller
part: it is the half that hoisting removes. I did not measure why SwiftShader pays for the branches
not taken (code size, register pressure and the predication of the branches are candidates), so this
is a property of this device and compiler, not of the language. A real GPU may behave differently.

**What the engine could do.** One bank and one kernel for each kind: each kernel holds one branch,
as the one-branch and narrow forms do, and the plan gains up to nine calls for the kinds present. A
kind with no event needs a bank of at least one lane (`bank()` refuses an empty array), so its call is
left out of the plan. This keeps option B open: pass 1 would then read the narrow element of its kind.
A hoisted frame loop (c) is a smaller change: it halves `cues` with no change to a kind.

**What the compiler could do.** Hoist the load and the store of a bank element whose index is
invariant in the loop (`lanes[v]` in the frame loop), when the loop reads no other path to the same
element. The compiler can prove this exact, so no result changes. The form (c) is what that
optimization would emit, and it halves `cues` on this device. The compiler could not be asked to
remove the cost of the branches not taken, since the measurement does not say where that cost lies.

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
   **Decision:** option B first.
2. Whether a closed-form phase may change the bits of the render, with new goldens, in exchange for
   the frame-parallel form.
   **Decision:** yes, with a stated tolerance checked once and new goldens; the precision of long
   events is measured first, and an integer turns counter is added if it is needed.
3. For `wind`: one more pair of arrays for the howl, or a component lane for it.
   **Decision:** a second pair of scratch arrays in `recur`.
4. Whether C, for offline renders only, is a separate note after B.
   **Decision:** yes, a separate note, after the device measurement of option B.

## 8. What the design does not change

- The plan format (`docs/sound-design-loop.md`, "The schema") and the validator.
- The checklist and its thresholds. They are read again after the change, as test (4) of option B.
- The spatial chain: `history`, `place`, `layers`, `strips`, the send and the convolution. They read
  `raws` as they do today.
- The master (`src/master.ts`): the loudness target and the limiter.
- The event key (`eventKey`) and every draw from it: an edit to one event changes that event only.
