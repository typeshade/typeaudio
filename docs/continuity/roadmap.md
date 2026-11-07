# Implementation roadmap and acceptance gates

Statuses refer to the 2026-11-06 checkpoint. Exact delivered commits are in [state.md](state.md).
This is an ordered program, not authorization to silently merge every stage or to implement a draft compiler proposal.
R0 recovery is complete; see [the verification receipt](recovery-verification.json).
The later owner direction makes editable agent projects in the existing Web editor the first delivery milestone.
[Web PR #47](https://github.com/typeshade/web/pull/47) implements this focused handoff using the current graph/room baseline.
Its approved UX corrections and local checks are recorded in [web-ux-verification.json](web-ux-verification.json).
The subsequent node/code clarification is recorded in [web-node-code-verification.json](web-node-code-verification.json).
It preserves the per-sample contract; whole-graph TypeScript authoring remains future engine-owned work.
The owner subsequently required ordinary TypeShade functions and first-class Blueprint-style authoring.
Read [the E2 authoring proposal](function-graph-authoring.md) before extending the sample-body model.
E2a starts with engine-owned function/port/state contracts; event scheduling reuses R1 rather than creating a second runtime.
Review current CI, then complete authorized publication and user/listening acceptance before resuming R1.

## Completed foundations

| Item | Status | Evidence |
| --- | --- | --- |
| Recovery plan, source archive and restore procedure (R0) | Implemented and recovery-verified, PR #25 review pending | Fresh remote clone, 69 file hashes, one procedural event, overwrite/corruption rejection and CI recovery job. |
| Portable procedural graph and reproduction corpus | Implemented, review pending | TypeAudio #22, Web #45, compiler #1038. |
| TypeShade language intelligence in Web code workspace | Implemented, review pending | Web #46. |
| Listener-relative stereo bus | Implemented, review pending | TypeAudio #23, 16 spatial tests in its 63-test snapshot. |
| Rectangular early reflections and diffuse stereo tail | Implemented, review pending | TypeAudio #24, 19 room tests in the 82-test snapshot. |
| Full-scene v2 sound-study source recipes | Rendered and signal-checked, listening pending | Recovery archive and production workflow. |
| Fresh Frieren picture analysis | Visual and mixed-signal analysis complete; listening not performed | [Study](../studies/frieren/README.md), 41 design regions, 15 anchors and reference measurements; PR #27. |

## Work packages

| ID | Scope and repository | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| R0 | Durable plan, state snapshot, source archive and recovery drill in TypeAudio | Existing source checkpoints | Fresh clone can find the plan, verify hashes and restore a procedural event. |
| E1 | Editable agent source projects in the existing Web editor | Current graph/room baseline; Web #46 | Six source projects, code/parameter/space edits, new audio after edits, undo/redo, save/reopen/reload, stale-import rejection and mobile viewport flow. Web #47; no R1/HRTF prerequisite. |
| E2 | First-class TypeShade functions and visual composition | E1 preservation rules; compiler reflection; R1 for event scheduling | [E2a–E2e](function-graph-authoring.md): typed pins, reusable stateful instances, shared code/graph edits, migration and a separate native-host feasibility gate. Proposed, not implemented. |
| R1 | Bounded real-time contract, telemetry and full-chain harness in TypeAudio | Graph runtime and room baseline | Explicit limits, event-age/overflow counters, complete DSP chain measured separately from device output. |
| R1a | Audio-frame event queue and stale-result handling | R1 contract | Burst events, paired start/stop, late events, slot generation, out-of-order results and bounded processing. |
| R1b | Voice priority, virtualization, stealing and quality budgets | R1a and measured costs | Deterministic selection, preserved virtual state, no hard cuts, overload policy and hysteresis. |
| R2 | Renderer-independent 3D acoustic path schema and stereo adapter | Room baseline; coordinate decisions | Six analytical paths retain full direction, delay and band units; stereo behavior stays covered. |
| R3a | Versioned HRTF asset contract and importer/preprocessor | R2, selected dataset/license | Correct axes, rate, onset/ITD, directional coverage, hashes and malformed-input rejection. |
| R3b | Bounded binaural renderer and head-orientation updates | R3a and R1 budgets | Impulse oracle, interpolation continuity, history preservation, complete-chain timing and listening passages. |
| R4 | Directional early/late bus and first-order Ambisonics | R2, R3b | Defined normalization/order, rotation checks, energy accounting, no duplicate routes and audible A/B review. |
| R5a | TypeShade SDF visibility kernel and reference harness | Scene query contract and R2 | Analytical hits/misses, real CPU/GPU tier report, software parity and separately identified hardware runs. |
| R5b | Mesh/BVH and SDF first-order acoustic paths | R5a, R1 freshness policy | Agreement with image-source room, occluders, thin surfaces, bounded steps and path continuity. |
| R5c | Bounded higher-order/diffuse paths and room summaries | R5b, R4 | Energy conservation, sampling consistency, convergence, stable revisions and measured device cost. |
| R6 | Synchronous TypeShade CPU artifact and pin promotion | Accepted compiler proposal 0122 and implementation | Immediate output, no hidden callback allocation/copy, candidate corpus, downstream-impact record and Web replay. |
| R7 | Existing Web editor integration and interaction audit | Stable R1/R2/R3 APIs and engine pin pair | Shared project state, scene/source/listener controls, mobile interaction, undo and live/offline parity. |
| R8 | Frieren template production and publication | R7, production review and R2 storage integration | YouTube timing tests, source-linked editable layers, reviewed stems/mix, R2 manifest and mobile production verification. |
| R9 | Agent production and feedback loop | Reproduction schemas, R7/R8 review records | Brief → candidates → checks → listening notes → revision, with reproducible versions and explicit review status. |
| R10 | Limited-band FDTD/probe experiments | Stable geometric/rendering path and a bounded research case | Energy/stability, dispersion, acoustic references and physical-device or offline cost measurements. |

R6 is a compiler contract track. Do not block the first geometric probe on an unimplemented public CPU API.
Do not promote a private workaround to a supported public contract without the compiler change.
R5a is a small feasibility probe, not completion of GPU acoustic propagation.
R10 does not precede useful HRTF and runtime-budget validation.

## Next task in concrete terms

First finish E1 using [the Web contract](https://github.com/typeshade/web/blob/feat/typeaudio-editable-studies/docs/typeaudio-editable-projects.md).
Keep the source-only JSON in Git. Source JSON and prerecorded review audio have distinct roles.
After an authorized Web merge/deployment, verify the same operations on the existing site and collect listening feedback.
Do not mark the broader R7/R8 packages complete merely because E1 passes.

R1 starts from the reviewed room/graph source, after reconciling remote PR status.
It defines a runtime profile before increasing acoustic complexity.

1. Specify maximum voices, active paths, filter length, events per block and overflow behavior as configurable bounded values.
2. Define event time, receipt time, late-event policy, snapshot sequence and source generation.
3. Build a full-chain harness using deterministic GraphDsp sources plus the room renderer.
4. Record warm/cold behavior, control bursts, source activation/reset cost, long runs and software/backend identity.
5. Keep physical output latency and underrun observation separate from compute-only timings.
6. Preserve the current passing corpus and add contract-level tests for the new scheduler boundary.
7. Record unmeasured device profiles explicitly; do not fill them with SwiftShader figures.

Candidate module boundaries are `realtime/`, `events/`, `voices/`, `spatial/paths/`, `spatial/hrtf/`,
`spatial/ambisonics/` and `acoustics/`. These are proposed folders, not current imports.
Keep one feature per file. Reuse existing validation and buffer ownership conventions.

## First spatial demonstration

Use one source moving left/right, front/back and above/below a stationary listener.
Then rotate the listener while the source stays fixed in world space.
Add a reflecting wall and an occluder, with separate direct/early/late audition controls.
Compare equal-power stereo and HRTF at matched source level, with room and sample-rate metadata visible.
Record direction judgments from listening separately from numerical filter checks.
The first demonstration does not require a cinematic template or full arbitrary-scene ray tracer.

## Web and production follow-through

Preserve the Adobe-style workspace and the existing component hierarchy.
Audit context-menu parity, tooltip/shortcut coverage, pointer capture, drag/drop, resize/docking, keyboard alternatives and touch layout.
Keep code editing, graph topology, source parameters, authored trajectories and rendered-cache versions distinct in document state.
Updating one field must not reapply an old whole-patch snapshot.

Create immutable public template revisions and fork user edits into projects.
Load chapters/assets on demand; a whole-film PCM blob is not an editable procedural template.
R2 stores authored assets and source data. YouTube remains the picture reference.
Verify seeks, buffering, speed changes, tab interruption, audio unlock, offset adjustment and duplicate-audio prevention.

## Review and stop conditions

Open a focused PR and push an early checkpoint. Record base SHA, compiler pin and generated-artifact version.
Keep direct audio working when propagation is delayed or unavailable.
Reject or simplify workloads whose configured cost exceeds the supported profile.
Do not silently accept interpreter fallback, unbounded user loops or a changed compiler execution tier.
If a required contract is missing, preserve the reproduction and raise the compiler proposal with a measured reason.
Mark complete only the scope supported by its acceptance evidence. Do not use passing unit tests as creative listening approval.
