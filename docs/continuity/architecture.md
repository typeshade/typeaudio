# TypeShade spatial audio implementation architecture

This is the planned architecture after the room checkpoint. It does not describe already-shipped 3D audio.
Existing CPU spatial DSP is an explicit open deviation from the longer-term shared TypeShade tier design.
The compiler still owns general execution semantics; TypeAudio owns acoustic meaning and scheduling policy.

## Three execution boundaries

| Boundary | Work | Required behavior |
| --- | --- | --- |
| Control and scene Worker | Authoring, graph compilation, topology, material fitting, geometry preparation | No worklet compilation or network dependency. |
| TypeShade CPU/GPU propagation | Occlusion queries, bounded paths, acoustic statistics, optional probes | Async results with revision and age; no audio callback dependency. |
| AudioWorklet renderer | Synchronous sources, delays, filters, HRTF, directional mix and master output | Bounded work, reused buffers, no GPU wait or Promise completion dependency. |

GPU scene computation and audio production use different clocks. A late propagation result must not delay a new direct sound.
Latest head orientation follows a low-latency control path; it does not wait for a new room solve.
Critical topology changes invalidate affected paths. Stale occlusion is not acceptable indefinitely merely because playback remains continuous.

## Scene representation

Use metres, +X right, +Y up and default forward -Z. Record coordinate conversion at every external boundary.
Separate the listener transform, source transform/trajectory, source directivity and acoustic material from source waveform generation.
Use stable scene, source, event and path identifiers. Reused source slots need a new generation identifier.

A TypeShade SDF scene contains distance functions, normal evaluation and material lookup.
The pinned `rt-renderer-class.shade.ts` provides language examples for those geometric operations.
Share geometric definitions with a preview where useful. Visual roughness or color is not an acoustic absorption coefficient.
Topology changes compile outside playback; position, scale and material controls normally update data buffers.

Mesh scenes use triangle/BVH queries. SDF scenes use bounded sphere tracing with a conservative distance estimate.
Both query implementations return hit distance, normal and material identity.
SDF thin walls, inaccurate distance bounds, step limits and surface epsilon need explicit failure behavior and tests.
WebGPU compute does not imply access to hardware ray-tracing acceleration structures.

## Renderer-independent paths

Keep these fields before any stereo conversion:

- Stable path ID, source ID/generation and path kind.
- Unit arrival direction in world coordinates, pointing from the listener toward the incoming source/image.
- Travel distance and excess delay relative to the immediate direct path.
- Frequency-band response, with energy versus amplitude units declared explicitly.
- Scene revision, computation sequence and source/listener pose sample time.
- Validity, confidence/approximation mode and bounded lifetime where needed.

The authoring form can use readable objects. The real-time transport uses a versioned, fixed-capacity typed layout.
TypeShade's declared element layout owns packing; do not assume three scalar floats match an `array<vec3>` buffer stride.
Validate a complete update before changing live targets. Reject out-of-order completions without erasing newer control edits.
Apply only complete snapshots. Queue ownership must prevent a producer from overwriting a buffer still being read.

Current `prepareRoomSource` supplies an image-source reference, but its `left/right` path representation must be adapted.
Maintain a stereo compatibility renderer while adding 3D paths. Do not infer height or front/back from an already mixed stereo signal.
State transitions preserve stable path histories. Removed paths fade; explicit clear/reset semantics stay distinct.

## TypeShade kernel plan

Start with one visibility query per independent loop iteration in a `.shade.ts` function.
Each iteration writes only its own result slot. Fixed-capacity ray/path storage avoids concurrent unsynchronized writes.
Use explicit limits for source count, rays, bounces, raymarch steps and result slots.

Develop kernels in this order:

1. `traceOcclusion`: compare SDF/mesh visibility with analytical primitives and the existing rectangular room.
2. `traceEarlyPaths`: preserve direction, distance and material response for valid first-order paths.
3. `traceReflections`: add bounded higher-order and diffuse estimates with reproducible seeds.
4. `summarizeRoom`: estimate directional late energy and decay for the renderer.

Reflection direction is `d - 2 * dot(d, n) * n` for normalized incident direction and surface normal.
Reflection energy is the remaining fraction after absorption and transmission; split specular/diffuse energy consistently.
Eight frequency bands represented by two `vec4` values are an initial layout proposal, not a fixed public contract.
Conversion to amplitude gains requires square roots when the model stores energy.

A surface hit alone is not a source-to-listener path.
Specular paths need reflection-law/path reconstruction and visibility checks. Diffuse connections need sampling-probability compensation.
Raymarching changes geometry intersection, not the acoustic law. It does not add diffraction automatically.
Add diffraction through a separate validated model such as an appropriate edge approximation.

Keep geometry, materials and intermediate results in `Device.array()`/`Resident` buffers.
Group work with `dev.fuse()` and read only bounded completed output asynchronously.
Inspect each `FuseReport` group; a WebGPU device does not prove that every group ran on WebGPU.
`fuse()` can still produce several dispatches. Measure dispatch count, transfer bytes and end-to-end result age.
Avoid rebuilding scratch storage or reading GPU results once per reflection bounce.
Do not mix arbitrary ray writes into shared IR bins until a correct bounded accumulation strategy is validated.

## Headphone and field rendering

Version the HRTF asset format with source/license, sample rate, coordinates, normalization, direction topology and retained delay/ITD information.
Convert a selected SOFA convention offline or in setup. Validate coverage and malformed assets before playback.
Compare short direct FIR and small partitioned convolution on target devices.
The existing 1,024-frame FFT convolution experiment is not an automatic low-latency HRTF implementation.

Keep direct sources and selected strong early paths as precise binaural objects.
Collect weak reflections and late reverberation in an Ambisonic field, initially first order with four channels.
Fix channel order and normalization, for example an explicitly documented ACN/SN3D contract, before exporting assets.
Ensure a path belongs to exactly one route to avoid double-counted energy.
Rotate the field for head orientation; listener translation requires propagation updates or spatial interpolation.
First-order Ambisonics is a local directional representation, not the pressure field throughout a whole room.

The current four-line FDN outputs stereo. Extend its output model rather than relabeling those two channels as directional data.
Interpolation/crossfades must preserve histories and avoid clicks. Record any added algorithmic latency.
Headphone localization requires listening evidence; numerical filter parity alone cannot establish perceived height or front/back accuracy.

## TypeShade synchronous CPU boundary

At the recorded compiler pin, ordinary kernel entry calls are asynchronous, including CPU fallback.
Do not rely on a browser's microtask timing to finish an AudioWorklet output after `process()` returns.
GraphDsp uses a pinned internal-generator adapter today. Proposal 0122 requests a supported synchronous CPU artifact and remains draft.
Use a verified synchronous path while that contract is unresolved; retain the deviation explicitly.

Before promoting a TypeShade DSP artifact, check immediate output, typed-array ownership, bounds validation, state retention,
allocations in generated `inout` handling, array conversion and interpreter fallback.
Do not claim that an imported class or a successful typecheck proves callback-safe execution.
General compiler changes follow the existing proposal → implementation → candidate feedback → pin promotion process.

## Real-time contract

At 48 kHz, 128 frames represent 2.667 ms. That is a processing interval, not button-to-speaker latency.
An initial 1 ms full-engine processing target is a planning budget, not a measured guarantee.
Define device profiles before fixing maximum active voices, HRTFs, paths, filter lengths and event counts.

Use a bounded event queue with audio-frame timestamps. Coalesce replaceable parameter updates.
Reserve capacity for important start/stop events and define overflow behavior; do not silently lose note-off/stop state.
Sample-accurate execution applies to events that arrive before their scheduled frame; late arrivals need a recorded policy.
Voice virtualization keeps timeline/envelope state while omitting expensive audible rendering.
Choose voice stealing by explicit priority and audibility, with fades and deterministic tie-breaking.

Reduce weak reflections, expensive late processing and low-priority voices before violating the processing budget.
Use hysteresis for quality restoration. A block that already missed its deadline cannot be repaired by later adaptation.
Use premeasured cost models and load counts; do not assume a portable high-resolution callback timer exists.
SharedArrayBuffer requires the appropriate browser isolation. A fallback transport needs its own measured service profile.
Use no blocking wait on the audio thread.

## Later wave acoustics

FDTD solves a discretized pressure wave field and can model low-frequency interference and diffraction.
It is a later experiment for bounded volumes, limited frequency ranges or offline probe generation.
For a typical explicit 3D grid, halving cell size gives roughly eight times the cells and twice the time steps.
That roughly sixteenfold work increase prevents assuming full-band scene-wide real time merely because the solver uses a GPU.
Include boundary stability, numerical dispersion, energy checks and real-device memory/compute budgets in any FDTD proposal.
