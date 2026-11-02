# Architecture

This document is the detail of `docs/vision.md`, section 8. It decides how the engine is built
on the compiler as it is on 2026-11-02: an exported class is a value of the host face (change
0109), a class is its struct and its functions in every place (Rule 8.29, change 0110), a kernel
function's loops run as dispatches (surface §65), and a chain of kernel calls runs as one plan
(`fuse`, surface §71). Every claim about the compiler names its section or rule. A claim about
the engine is a design decision until an experiment (`docs/experiments.md`) confirms it, and the
document says which.

## 1. What the engine stands on

| Compiler piece                                               | Where                           | What the engine does with it                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| An exported class is a host value: `new`, methods, instances | §64, Rules 8.20, 8.21 (0109)    | A unit is a class. The host builds it with `new`, tests it on the CPU tier, and passes instances to kernels.                                    |
| A class is its struct and its functions everywhere           | Rule 8.29, the class arm (0110) | The same `tick` gives the same bits in a compute entry, a kernel loop, the host class and the oracle. The engine adds no second implementation. |
| Kernel functions and the loop proof R1 to R6                 | §65, Rule 8.22                  | Every kernel is a loop and nothing else. `voices[v].tick()` is a write at `v` (Rule 8.29). `out[v * B + n]` over `n < B` is a write R3 admits.  |
| `fuse`: a plan of recorded calls, facts F1 to F7             | §71                             | One block is one plan. Chains of per-frame kernels become one dispatch. The report is `explain`.                                                |
| Scratch arrays of a scope                                    | §71                             | Intermediates nobody reads cost no buffer: a fused group holds them as locals.                                                                  |
| A reduction at the end of a scope                            | §65, §71                        | Meters (`peak`, `rms`) fold in the tree order, the same bits on every tier.                                                                     |
| `gpuTime` per group, `chunk` timing                          | §71 (0066, 0074)                | `explain` reports GPU time per group and milliseconds per block.                                                                                |
| Residents, a device owner, the pool, the queue               | §65, §69, Rule 11.8             | Banks and buses live on the device between blocks. The host reads only at the transport.                                                        |
| `Map<K, V>` and `Set<K>` as kernel parameters                | §74 (0080)                      | Note events of a block, keyed by frame.                                                                                                         |
| `push`, device-resident counts, indirect dispatch            | 0078, 0094, 0075                | Grains and other device-side schedules.                                                                                                         |
| `Record` over a key type, optional values, defaults          | §75, §76, §14                   | Parameter objects that read as TypeScript.                                                                                                      |
| The common modules                                           | §72, §73 (0072, 0076)           | Scans, fills, hashes and noise without writing them again.                                                                                      |
| The host view: JSDoc, the type family                        | §64 (0108, 0116)                | The editor shows the author's words and the shader's names.                                                                                     |
| The determinism report, `f64`                                | §38, §39                        | What may differ by driver is listed; coefficient math that needs a double has one.                                                              |

## 2. The four loop shapes

A kernel's loop has a range and a write pattern. The planner fuses calls whose loops have the
same range (F2) and that read and write at the loop's counter (F3). The engine therefore writes
every kernel in one of four shapes, and knows before it runs which ones fuse.

| Shape | The loop runs over                   | The body                                                                  | Fuses with                                                                                                                                                                                                                                              |
| ----- | ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V     | the lanes (voices, channels, grains) | `tick` of the lane's unit over the block, written to `out[v * B + n]`     | another shape V call over the same lanes that reads and writes at `v` only                                                                                                                                                                              |
| F     | the frames of a block                | one frame of a bus: `out[n] = f(a[n], b[n], p)`                           | the shape F calls before it, as long as F1 to F5 hold: one dispatch per chain                                                                                                                                                                           |
| R     | the frames, folding                  | a meter: `s = max(s, abs(x[n]))`, `s += x[n] * x[n]`                      | the shape F calls before it, as the last call of the scope (F6)                                                                                                                                                                                         |
| G     | the frames, gathering                | a read at another index: a mixdown over lanes, a delay line, an FFT entry | the shape F calls after it, when every array it gathers from was written by an earlier group or by the host (F3 binds only the arrays a call of the group writes); a gather from an array the group itself writes stands apart, and the report says why |

Facts behind the table. A nested loop of `n` below `B` writing `out[v * B + n]` is the form R3
admits, with `B` loop-invariant; a kernel parameter is. A method call on an element is a write
at that element's index (Rule 8.29). A fused group holds one loop per call, so a shape V kernel
with its nested block loop is one call with one top-level loop (F1). A call that writes an array
another call of the group reads or writes starts a new group (F4), so the engine never processes
in place: a chain writes fresh scratch arrays, and the planner turns them into locals. F3 binds
only the arrays a call of the group writes, so a gather from an array written by an earlier group
or by the host joins the group that follows it.

Confirmed by the first code (pull request #5, `src/kernels/synth.shade.ts`): a shape V kernel
with a runtime `B` lowers and runs as one dispatch on WebGPU and on the CPU tier. Observed in the
same code (`docs/records/01-round-trip-container.md`, observation 8): on WebGPU the shape G
`mixdown` heads the fused group with the shape F chain and the meter, because `lanes` was written
by the synth group, and the one group boundary is between `synth` and `mixdown` (F2: 64 and 4096
iterations).

## 3. One block is one plan

The engine renders a block of `B` frames as one `dev.fuse(body)`. The body records the calls in
this order, and the planner groups them:

```ts
const report = await dev.fuse((scope) => {
  const lanes = scope.scratch(voices.length * B); // never read by the host
  synth(lanes, voices, B); // V: the bank's dispatch
  mixdown(bus, lanes, voices.length, B); // G: heads the chain below; lanes came from the group before
  const a = scope.scratch(B);
  const b = scope.scratch(B);
  lowpassBlock(a, bus, coeffs); // F: the chain starts
  drive(b, a, amount); // F: joins the group (F1 to F5)
  gain(master, b, level); // F: one dispatch for the three
  peak = maxAbs(master); // R: folds inside the chain's dispatch
});
```

What holds, by §71: the body is synchronous and records; the plan runs as one item of the kernel
queue; a call that fails its check fails the plan before any call runs; `a` and `b` are locals of
the fused group when every call that names them is in it; `peak` resolves after the plan; the
report lists the groups, whether each fused, why one did not, its workgroup shape and its GPU
time when the device has `timestamp-query`.

The engine keeps the plan body the same from block to block, so the runtime builds the fused
entry once and reuses it (§71: "A second scope of the same shape builds nothing"). What changes
per block are the arguments: the scalar parameters, the automation arrays and the event map.

`explain` is the report in words, plus the engine's own facts:

```
block 1024 frames (21.3 ms), lookahead 3 blocks, webgpu
  synth            1 dispatch   64 lanes     0.21 ms gpu
  mixdown+lowpass+drive+gain+peak   1 dispatch   fused (F1-F6), scratch a, b as locals
  2 dispatches, 1 submission, 0.37 ms gpu, 0.9 ms host per block
```

## 4. Units, banks and state

A unit is a class in a `"use typeshade"` file: its state is its fields, its sample is `tick`, and
its math is shared through `abstract` bases, `extends`, `super`, generics and `implements`
(surface §26; `docs/typescript-coverage.md` lists what the file may use). The host builds units
with `new`, and the editor shows the author's comments and the shader's names.

A bank is the device-resident array of a unit's instances: `dev.array(instances)` gives a
`Resident<Voice[]>`, the kernel's `array<Voice>` parameter takes it, and `tick` writes each
element's fields in place, so the bank is the voice state between blocks. The host never reads a
bank during a run; it reads it at the end, or never.

- One bank per concrete class. A kernel's array is monomorphic, and a base class is never a
  value (§26). Two banks of equal lane count fuse when their kernels write different outputs
  (F2, F4); unequal counts run as two dispatches. A closed set of kinds in one lane is a `kind`
  field and a `switch` (change 0097 lowers an untaken arm to an `if`).
- Per-lane parameters are fields. Per-block parameters are scalar arguments of the kernel.
  Per-frame automation is a shape F input array.
- A unit's constructor runs on the CPU tier at `new`, so a host-built instance has run its
  initializers; the engine never builds a lane from a plain object.

## 5. Buses, scratch and the pool

A bus is a `Resident<Float32Array>` of `B` frames that the engine owns. A chain never writes a
bus in place: each stage writes the next scratch array of the scope, and the bus is written once,
by the last stage. The planner keeps the scratch arrays as locals of the fused group, so a chain
of ten effects costs one dispatch and no buffer. A bus the host reads (the master) is a
`Resident` the engine allocates from the device's pool (`dev.array`, `dev.release`, `poolBytes`,
§65), reused block after block.

A delay line, a reverb's feedback and a lookahead limiter keep their state in Residents too, and
their kernels are shape G: they read at `n - d`. A gather from a state Resident written in an
earlier block or an earlier group joins the chain after it; one from an array the group itself
writes stands apart, and `explain` says so.

## 6. Time and events

- The clock is the frame index of the transport, a `u32` of the block's first frame plus `n`.
- Note events of a block are a `Map<u32, f32>` keyed by the frame offset, built by the host
  per block and passed to the shape V kernel (§74); the kernel reads `onsets.get(n)` and
  triggers the lane. A loop that reads a map it does not add to lowers (R4).
- Grains and other device-side schedules use `push` onto a list whose count stays on the device
  (0078, 0094): a kernel appends the events of a block, a second kernel renders the live ones,
  and no host read happens per block.
- Parameter changes are block-synchronous by default, with a per-frame ramp array where a click
  would be heard.

## 7. The host graph

`Signal`, `Bus` and `Node` form a deferred graph, as TypeNN's Tensor graph is: building the graph
records it, and `render` and `play` plan it. A node is a kernel function of `typeaudio/units` or
one the developer wrote; `pipe` is a shape F chain; `mix` is a shape F add of two buses, which
fuses; a bank's mixdown is the one shape G call a voice graph needs.

The planner of the engine orders the recorded calls so that the compiler's planner fuses as much
as the facts allow, and never hides what it could not fuse: `explain(node)` prints the report of
the last block, group by group, with the `why` of each unfused group in the developer's names.

## 8. Transports

- **Offline.** `render(graph, { seconds })` runs block after block in one device, each block one
  plan, with `dev.fuse(body, { chunk })` on a long render so that the time per block is learned
  (0074) and reported. The output is a `Float32Array`, or a WAV through a writer on the host.
- **Real time.** A Worker owns the device and renders `lookahead` blocks ahead into a
  `SharedArrayBuffer` ring; an AudioWorklet reads the ring and plays. Latency is `lookahead × B`
  frames. The numbers are experiment 1's. The worklet thread has no WebGPU and no dynamic
  `import`, so the worker holds everything.
- **Low latency.** The CPU tier of the same kernels inside the worklet, if experiment 2 shows it
  loads and keeps up. Nothing in the graph changes: a node runs where the transport puts it,
  and `explain` says where.

## 9. Verification

- The CPU tier is the oracle (Rule 11.7). Unit tests build units with `new` and call `tick`
  synchronously. Render tests run `render` on the CPU tier and compare with golden files.
- GPU against CPU: each unit's members are already held to one result by the class arm; the
  engine adds a block-level check, a render on WebGPU against the CPU tier, bit for bit except
  the rows the determinism report lists (§38).
- Sums and meters fold in the tree order on every tier, so they are bit for bit (§65).
- Subnormals in tails are measured by experiments 3 and 5 before any promise is made about them.

## 10. Packages and build

- `typeaudio`: the host API (`bank`, `render`, `play`, `explain`, the graph and the DSL) and the
  transports.
- `typeaudio/units`: a shader package (change 0024) of units and shape F kernels, imported by
  name from a `.shade.ts` file and from the host.
- `typeaudio/fft` later, or a common module of the compiler (ask G).
- The engine's own kernels compile at build time through the Vite plugin; their views are
  committed and checked with `tshc sync --check`. A developer's kernels compile the same way in
  their project.

## 11. Decisions

**Decided 2026-11-02.** The owner approved D1 to D6 as proposed ("승인", pull request #4). Each
item keeps its alternative for the record; the proposal in each is the decision.

- **D1. Lane buffer layout.** Flat `out[v * B + n]` (the proposal; R3 admits it), or one struct
  per lane with a fixed array of frames. Experiment 4 confirms the flat form lowers with a runtime
  `B`.
- **D2. Banks.** One bank per concrete class (the proposal), or one bank of a tagged class with
  a `switch`.
- **D3. Events.** A `Map` per block from the host (the proposal, for notes), and `push` with a
  device-resident count for grains; or events only through `push`.
- **D4. The graph.** Deferred and planned per block (the proposal), or eager calls.
- **D5. Defaults.** `B` 1024 and `lookahead` 3 until experiment 1 replaces them.
- **D6. The device.** The engine creates its device and owns its pool; a developer may pass one
  of their own.

## 12. What this changes in the ledger

- Ask A of `docs/compiler-asks.md` (a lane writes its own block) is expected to be satisfied by
  R3's `i*W + x` form; its status moves to "to confirm" and experiment 4 confirms it.
- Ask H (GPU time) is partly satisfied: the fuse report carries `gpuTime` per group when the
  device has `timestamp-query` (§71, change 0066). The rest of #542, a timing outside a scope
  and on WebGL2, stays an ask.
