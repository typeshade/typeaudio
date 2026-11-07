# Typed TypeShade function graphs

This engine entry prepares ordinary TypeShade functions as reusable audio processing definitions.
The source modules retain helpers, imports, scalar types and typed instance state.
TypeAudio supplies port metadata, connections, named controls and synchronous execution.

The first engine profile and composition API are implemented in [PR #30](https://github.com/typeshade/typeaudio/pull/30).
The existing Web editor adopts the function format in [Web PR #47](https://github.com/typeshade/web/pull/47).
The older `typeaudio/graph` API and legacy project semantics remain unchanged.

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

Web PR #47 adopts this contract with reusable nodes, typed connections, named controls and full source modules.
Project version 3, draft preservation and revision guards are integrated there.
E2c composition-source operations and connected-input rename are implemented in the compiler entry below; Web integration continues in #47. Reusable subgraphs remain open.
Read [the Web verification receipt](continuity/web-function-authoring-verification.json) before extending that workflow.
Event scheduling belongs to E2d/R1. Stereo/aggregate pins, transition policies and device profiling remain open.
An Unreal adapter needs E2e's separate native execution and buffer-contract work; no plugin is included here.

## Preparing source signature edits

`typeaudio/function-graph/compiler` exports `synchronizeFunctionInputs(raw)` for explicit authoring operations.
Call it before `compileFunctionGraph` when applying source edits. Ordinary imports and compilation remain strict.
The operation snapshots the input document and reads parameter types through TypeShade.

Existing parameter names retain their stable port IDs and authored audio metadata.
New scalar parameters receive unique IDs and block-rate control metadata, with zero or false defaults.
The host can then expose these pins as named controls or explicitly change their audio roles and units.
Removed parameters with connections or named-control bindings cause a diagnostic. Disconnect every instance before removal; use the explicit rename operation below for a connected input.
Removed constant bindings are deleted from the snapshot. Caller data is unchanged, including on failure.
State/context mappings and entry-point names remain explicit. This operation does not infer state initializers or rename connected ports.
Type changes still pass the normal compiler and connection validator before the host applies the result.

Registration modules refresh their position in the 64-entry factory cache.
Hosts must register every definition for a replacement sound before constructing its DSP.
A combined layered sound must fit that registry capacity; existing DSP instances retain their executable references.

## Composition source and connected input rename

`projectFunctionComposition(program, previousSource?)` returns `{ source, nodes }`.
The source is a genuine TypeShade module at `FUNCTION_COMPOSITION_PATH`,
`/__typeaudio_network.shade.ts`. Each node location includes a file, line and column.
The composition imports processing functions and exported state classes, passes scalar controls
and context explicitly, and returns the output node. For example:

```ts
"use typeshade";
/** @typeaudioDefinition gain */
import { gain } from "./gain.shade.ts";

/** @typeaudioComposition */
export function sound(
  /** @typeaudioControl strength */ strength: f32,
  /** @typeaudioContext time */ time: f32
): f32 {
  /** @typeaudioNode level */
  const result: f32 = gain(0.1, strength, time);
  return result;
}
```

The catalog supplies audio roles, rates, units and parameter metadata. A block-rate definition
still executes at its declared rate; this source view does not replace the TypeAudio scheduler.
Function bodies may contain supported loops and conditions. Composition maps single `const`
call declarations and a final returned node. It accepts scalar literals, exposed controls and
previous node outputs as ordinary call arguments. Processing expressions, branches and loops
inside the composition entry produce located diagnostics; move that processing into a function.

`applyFunctionComposition(program, source)` returns a new `{ program, composition }` after
TypeShade language checking and TypeAudio connection validation. It never evaluates project
source as JavaScript. It can add/remove call instances and change connections/constants/output.
New controls and definition metadata are supplied through the graph document. State parameters
must have the matching `inout<Class>` type; each stateful instance owns a distinct argument.
Classes used in the composition signature must be exported. Private state classes still work
in ordinary node playback; export them to enable composition projection.

Stable `@typeaudioNode` annotations retain identity when a local variable is renamed.
Definition, control, context and state annotations disambiguate their domain identity from
language names. The generated source is editable; annotations are metadata, not new syntax.
The composition file path is reserved. Source is bounded to 131,072 characters.

With a previous applied source, visual projection retains unrelated module text and helpers.
It changes managed imports, signature and call statements. Comments inside replaced arguments
or deleted managed declarations are retained beside their enclosing statements; their exact
position can change. Unchanged compatible source is returned byte for byte. Keep invalid or
conflicting buffers separately and pass only the last applied source as the projection base.
`compositionIdentity(program)` compares graph execution structure independently of node
presentation order and omitted default bindings. A host should validate that a saved composition
matches its applied graph before replacing a document.

`renameFunctionInput(raw, definitionId, portId, newName)` uses the TypeShade language service
for symbol edits, updates the metadata key and compiles the result before returning a new
document. The stable port ID, connections, controls and compatible state remain intact.
This operation changes all instances of the definition. Unrelated same-named symbols remain
unchanged. It does not rename entry functions, state classes or arbitrary metadata.
Hosts must resolve unapplied source drafts before this separate operation and apply its source
and metadata together as one history entry.

Composition source is optional host authoring data; the portable engine graph remains version 1.
The Web stores it with source/drafts in project version 4 and excludes it from audio identity.
Comment-only composition edits therefore do not invalidate audio or reset Live state.
