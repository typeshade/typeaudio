# Typed TypeShade function graphs

This engine entry prepares ordinary TypeShade functions as reusable audio processing definitions.
The source modules retain helpers, imports, scalar types and typed instance state.
TypeAudio supplies port metadata, connections, named controls and synchronous execution.

This is E2a of [the authoring contract](continuity/function-graph-authoring.md), implemented in [PR #30](https://github.com/typeshade/typeaudio/pull/30).
The existing Web editor has not adopted this document format yet.
The older `typeaudio/graph` API and Web project version 2 remain unchanged.

## Source, definitions and instances

[`fixtures/function-graph/impact.json`](../fixtures/function-graph/impact.json) contains a complete source-only example.
Its `Excitation → Resonator → Gain` composition uses four modules and three named controls.
Its seeded noise and stateful resonator generate the sound without recorded audio.

A stateful function uses the normal TypeShade language:

```ts
"use typeshade";

export class Memory {
  value: f32 = 0;
}

export function initialize(): Memory {
  return new Memory();
}

function smooth(state: inout<Memory>, input: f32, amount: f32): f32 {
  state.value += (input - state.value) * amount;
  return state.value;
}

export function process(state: inout<Memory>, input: f32, amount: f32): f32 {
  return smooth(state, input, amount);
}
```

The definition binds this source to audio semantics:

```ts
const definition = {
  id: "smooth",
  version: 1,
  module: "/smooth.shade.ts",
  export: "process",
  inputs: {
    input: { id: "signal", role: "audio", rate: "sample" },
    amount: { id: "amount", role: "control", rate: "block", default: 0.1 },
  },
  output: { id: "out", role: "audio", rate: "sample" },
  state: { parameter: "state", initializer: "initialize", version: 1 },
} as const;
```

TypeShade determines argument and return types. Metadata does not redeclare those types.
Metadata keys identify source parameter names; port IDs identify composition bindings.
Renaming or reordering a source parameter preserves connections when its port ID stays unchanged.
Each instance references a definition and binds inputs by port ID.
Each instance receives independent state, including instances of the same definition.

Bindings select a constant, a named control, or another instance's output port.
Connections require matching scalar type, role, rate and unit.
There are no implicit unit or audio/control conversions.
Block controls remain constant during each `process` call.
A sample-rate function can consume block-rate controls through declared block-rate input pins.
Cycles are rejected; feedback needs state inside a function or a future explicit delay contract.
Disconnected instances are validated but do not execute.

## Public entries and preparation

| Entry | Responsibility |
| --- | --- |
| `typeaudio/function-graph` | Portable source document, descriptors and validation. |
| `typeaudio/function-graph/compiler` | TypeShade compilation, reflection, source diagnostics and prepared registration modules. |
| `typeaudio/function-graph/runtime` | Compiler-free `FunctionGraphDsp`, with synchronous mono output. |

`compileFunctionGraph(raw)` snapshots and validates JSON before compiling its modules.
Imports resolve only against the document's absolute virtual paths.
Named exported function declarations are supported entry points; export aliases and default exports are outside this first profile.
Compiler diagnostics retain source file, line and column.
Compilation and registration module loading belong outside audio processing.

1. Compile the source document on a control thread or Worker.
2. Inspect the returned descriptors and each artifact's execution report.
3. Load the runtime module into the target AudioWorklet scope.
4. Load the trusted compiler-produced registration modules into that same scope.
5. Construct `FunctionGraphDsp` before processing its first block.
6. Pass reusable output storage to `process`.

The [worklet check](../scripts/check-function-worklet.ts) demonstrates module loading without compiler code or dynamic evaluation in the worklet.
Registration JavaScript is generated locally from validated source, never accepted as executable project JSON.
The registration cache retains 64 artifact factories; existing DSP instances keep their own executables.
Reload evicted registration modules before constructing another instance from those artifacts.

```ts
import { FunctionGraphDsp } from "typeaudio/function-graph/runtime";

// The target scope already loaded program.artifacts[].code as trusted modules.
const dsp = new FunctionGraphDsp(program, { sampleRate: 48000 });
const output = new Float32Array(128);

dsp.setParameter("pitch", 420);
const ok = dsp.process(output);
// On failure, output is silent and dsp.faultNode identifies the instance.
```

The runtime validates artifact identity against source modules and definition metadata.
Changed source requires a newly prepared artifact. Parameter values do not require recompilation.
The host remains responsible for applying the current revision and rejecting late preparation results.

## State and failure behavior

`setParameter` validates values before mutation. It preserves oscillator, filter and other instance state.
`reset` restores initialized state and frame time while retaining current named control values.
`new FunctionGraphDsp(program, { previous })` transfers compatible state by instance ID and definition ID.
State version, field names, field types and sample rate must match.
Changed state versions reset their instances. State from a faulted previous graph is never transferred.
Changing initial defaults alone does not reset compatible live state; use a state version change or explicit reset.

Preparation can fail without touching an existing DSP instance.
Runtime faults silence the whole output block and latch until reset or replacement.
Other DSP instances remain independent.
Non-finite output or state and exhausted call/loop budgets produce faults.
The runtime does not add a limiter, smoothing, event queue or replacement crossfade.
The host must arrange those policies before exposing live edits to listeners.

## First execution profile

| Boundary | Supported contract |
| --- | --- |
| Backend | Compiled CPU, `f32` arithmetic; no interpreter fallback. |
| Output | One mono `f32` sample output; 1–128 frames per synchronous call. |
| Sample rate | Integer 8,000–192,000 Hz; default 48,000 Hz. |
| Port values | `f32`, `i32`, `u32`, `bool`; audio ports require sample-rate `f32`. |
| State | One `inout<Struct>` argument with 1–32 scalar fields and a zero-argument initializer. |
| Context | Explicit `f32` time in seconds and/or sample rate; time requires sample-rate processing. |
| Document | 32 modules, 32 definitions, 64 instances, 64 controls, 16 input pins per definition. |
| Source bounds | 1,000,000 serialized characters; 131,072 characters per module. |
| Processing | At most 64 reachable functions, depth 32, no recursion; guarded calls and loops. |
| Step budget | 2,048 calls/loop iterations per instance invocation; 16,384 during initialization. |

These are this TypeAudio execution profile's bounds, not general TypeShade language limits.
GPU resources, module variables, aggregate input/output pins and nested or array state need additional execution profiles.
Constructors can allocate state during preparation. Processing paths reject explicit aggregate allocations and unverified runtime helpers.

The adapter still uses the pinned private CPU generator, pending compiler proposal 0122.
It replaces verified `inout` writeback array literals with writes into instance-owned scratch storage.
Nested scalar and struct writebacks are compared against the unchanged compiler output.
[Compiler ask S](compiler-asks.md#s-the-cost-of-the-cpu-tiers-generated-code) records the upstream fix and pending pin promotion.
Candidate verification accepts its per-function prepared buffers without requiring the older shared scratch shape.
This audit does not prove that the JavaScript VM never allocates.
The step guard limits calls and loop iterations, not wall time or a hardware audio deadline.

## Verification and next work

1. Run `bun run check` and `bun run test`.
2. Run `bun run test:function-worklet` for actual Chromium AudioWorklet output comparison.
3. Run `bun run bench:functions` for host CPU timing at 1, 8 and 32 graph voices.
4. Run `bun run demo:functions` to regenerate the one-second impact WAV and source JSON.

Generated files reside in `artifacts/functions/` and CI's `function-runtime` artifact.
The durable [verification receipt](continuity/function-graph-verification.json) records versions, scope and results.
Host timing and OfflineAudioContext parity do not establish physical output latency, game deadlines or listening quality.

E2b adopts this contract in the existing Web editor with reusable nodes, compatible pin search and named control editing.
E2c adds shared composition/code operations, revision checks, draft preservation and explicit migration from existing projects.
Event scheduling belongs to E2d/R1. Stereo/aggregate pins, transition policies and device profiling remain open.
An Unreal adapter needs E2e's separate native execution and buffer-contract work; no plugin is included here.
