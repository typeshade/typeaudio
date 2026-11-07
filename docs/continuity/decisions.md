# Owner decisions and scope

Recorded on 2026-11-06 from the owner conversation and verified repository state.
This record preserves intent without claiming that every requested feature has shipped.
Numbers in proposed implementation budgets are starting assumptions, not owner-approved performance guarantees.

## Product direction

| ID | Decision | Consequence |
| --- | --- | --- |
| D01 | Extend TypeAudio at `audio.typeshade.dev` in the existing `typeshade/web` repository. | Do not create or publish a replacement Sites project. |
| D02 | Use Photoshop/After Effects as workspace and editing-flow references. | Build coherent panels, timelines, inspectors and commands; avoid a collection of demo cards. |
| D03 | Split responsibilities into components, hooks, services and focused engine modules. | Preserve the requested atomic-design approach; avoid another monolithic editor or DSP file. |
| D04 | Support designing sounds from scratch with oscillators, filters, effects, code and procedural graphs. | Keep source recipes editable and deterministic, rather than exposing only rendered PCM. |
| D05 | Make code and node authoring work like a structured development workspace. | Provide TypeScript/TypeShade completion, diagnostics, definitions, parameter controls and understandable compile errors. |
| D06 | Improve context menus, tooltips, dragging, resizing and keyboard/touch operation. | Treat interaction coverage and accessibility as product work, not decoration. |
| D07 | Preserve state across selection, workspaces, delayed loads and render completion. | Field-level edits must merge against current document state; old async results cannot roll back Tone or other edits. |
| D08 | Use a custom engine for immersive listening. Dolby products and certification are not required or planned dependencies. | Evaluate perceptual direction, depth, space and narrative focus without an Atmos label. |
| D09 | Advance the engine before expanding immersive UI promises. | Establish acoustic-path contracts, rendering and measured runtime budgets first. |
| D10 | Build a Web → TypeAudio → TypeShade feedback loop. | A Web failure must export a minimal engine reproduction with exact version-pair metadata. |
| D11 | Support agent-led production through explicit evidence, versions and review. | Keep spotting, synthesis, technical checks, listening review and selection as distinct stages. |
| D12 | Keep the full plan recoverable if chat and workspace disappear. | Store decisions, snapshots, recipes, recovery steps and next actions remotely. |
| D13 | First deliver an agent-authored project that opens in the existing Web editor and remains directly editable. | Prioritize source project import, code/parameter/space edits and reliable save/reopen before further R1/HRTF expansion. |

D13 records the later owner direction on 2026-11-06. It refines the sequencing of D09.
Use the implemented engine baseline for this first handoff; do not wait for the entire immersive roadmap.

## Real-time and performance direction

The reported Live problem was audible stuttering. It was not only slow finite WebGPU rendering.
Treat onset latency, per-block processing deadlines and spatial-result freshness as separate requirements.
CPU/GPU selection must follow complete-path measurements, including dispatch and readback where applicable.
The direct game response must not depend on completion of GPU acoustic simulation.

The owner explicitly clarified SwiftShader's role on 2026-11-06:

> SwiftShader is not appropriate as a hardware performance indicator. It can provide an approximate indication of improvement.

Use a controlled software-renderer run for correctness and coarse relative regression evidence.
Do not infer hardware GPU speed, CPU-versus-GPU product performance or game deadlines from it.
See [validation policy](validation.md) for required labels and device acceptance.

## Picture and template direction

The reference is https://www.youtube.com/watch?v=YHCqcyX9N3s.
Use a YouTube reference in the public template. Do not rehost the supplied reference video as the template's media.
Use R2 for authored audio, project data, source recipes and receipts under versioned keys.
Integrate the template into the existing editor and verify mobile access.
The previous separate-site direction was rejected. Do not revive it.

The owner requested a fresh analysis and a professional production workflow after rejecting the first sound-design presentation.
Preserve the v1 study only as revision history and A/B material. V2 is a review study, not a selected final mix.
Muting the YouTube original also removes its dialogue and music. No dialogue/music separation has been implemented.
Do not describe synthesized effects as a full replacement of those missing production elements.

## Proposed technical choices

The following choices define the current implementation plan. They remain subject to focused measurement and review.

- Keep geometry and acoustic paths independent of headphone/speaker rendering.
- Store 3D arrival direction, excess delay, distance and frequency-dependent response before stereo conversion.
- Start HRTF work with a versioned asset contract and a small bounded renderer.
- Start directional reverb with first-order Ambisonics, then measure higher orders.
- Use the existing room image-source model as a deterministic geometric reference.
- Add mesh intersections and SDF sphere tracing through a common acoustic query interface.
- Keep large propagation work in a Worker; consume prepared results synchronously in AudioWorklet.
- Treat low-frequency FDTD and acoustic probes as later, separate experiments.
- Preserve a source's live state when control values change; make reset and replacement explicit.

## Open choices

| Item | Why open | Decision evidence |
| --- | --- | --- |
| HRTF dataset and redistribution terms | No dataset selected or imported. | Coverage, license, onset/ITD handling, size and listening trials. |
| Supported device/browser matrix | No physical mobile/game deadline run recorded. | Full-chain tests on owner-targeted hardware. |
| Voice/path limits and quality tiers | Room-only server timing does not price HRTF or source synthesis. | Minimum-device measurements with a representative game load. |
| Public synchronous TypeShade CPU artifact | Proposal 0122 is a draft. | Accepted contract, implementation and downstream reproduction tests. |
| Directional late-field model and order | Current FDN outputs only stereo. | Rotation, energy, cost, mono compatibility and listening evidence. |
| External YouTube offset and browser behavior | No live frame-accurate synchronization established. | Real player seek/buffer/rate-change tests with measured error. |
| R2 publication path and application API | Draft data contract only. | Existing Worker/bindings review and versioned manifest integration. |

## Authorization boundary

The owner authorized engine advancement and this durable recovery task.
Earlier merge approvals applied to earlier changes; do not treat them as blanket permission for all future PRs.
Preserve each repository's merge and deployment rules. Prepare reviewable work without repeated permission requests.
No new compiler implementation is authorized merely by recording proposal 0122 in this plan.
