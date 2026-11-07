# TypeAudio recovery and implementation plan

This is the restart entry point for the TypeAudio immersive-audio program.
It must remain sufficient when the chat history and the original workspace are unavailable.
The owner requested durable recovery instructions on 2026-11-06.

Start from the durable [recovery index, issue #26](https://github.com/typeshade/typeaudio/issues/26) if the workspace is gone.
[PR #25](https://github.com/typeshade/typeaudio/pull/25) preserves this plan and its source archive remotely.
The [recovery verification receipt](recovery-verification.json) records a fresh remote clone, 69 verified files and one regenerated procedural event.

The room engine baseline is PR #24 at `86560f83a92ff8374346157000b8a467daa39aab`.
It builds on spatial PR #23 and graph-feedback PR #22. These pull requests are not merged.
The current continuation is [function-engine PR #30](https://github.com/typeshade/typeaudio/pull/30), on `feat/typed-function-graphs`.
The latest verified delivery is [E2c composition editing](composition-editing.md) in that PR and Web #47. Resume at reusable subgraph packaging.
The compiler pin remains `87af4eb0d9d15f02b66b8341b72cab0944290472`.

## Benchmark rule from the owner

SwiftShader is software rendering. Use it for functional checks and approximate before/after
comparisons within the same controlled environment. Do not use it as a hardware GPU performance
indicator, a CPU-versus-GPU product comparison, or evidence of game real-time guarantees.
Record actual adapter/backend identity for every measurement. Real-device validation is still required.

## Read in this order

1. Read [Recovery procedure](recovery.md) to recover repositories, dependencies and locally authored source data.
2. Read [Owner decisions](decisions.md) before changing scope or product behavior.
3. Read [Current state](state.md) and [the machine-readable snapshot](snapshot.json) to identify delivered work.
4. Read [Architecture](architecture.md) for the TypeShade execution model and real-time boundaries.
5. Read [Implementation roadmap](roadmap.md) for the next task, dependencies and acceptance gates.
6. Read [Validation policy](validation.md) before making quality or performance claims.
7. Read [Production workflow](production-workflow.md) before designing or publishing sound against picture.
8. Read [Asset inventory](assets.md) to distinguish recoverable source, generated output and external dependencies.

## Resume without the conversation

R0 is complete: the plan, authored source and recovery procedure are remotely stored and the recovery drill passed.
The owner's subsequent first milestone is **editable agent output in the existing Web editor**.
Start with [Web PR #47](https://github.com/typeshade/web/pull/47) and
[its handoff contract](https://github.com/typeshade/web/blob/feat/typeaudio-editable-studies/docs/typeaudio-editable-projects.md).
Open authored projects, edit their source and spatial settings, then save and reopen without losing changes.
This focused handoff precedes further R1/HRTF work. It uses the implemented graph and room baseline.
The real-time expansion track is R1 in [the roadmap](roadmap.md): a bounded contract and its measurement harness.
The later authoring clarification produced E2a's function engine; E2b now adopts it in Web PR #47.
R2 establishes renderer-independent 3D acoustic paths. R3 adds HRTF output.
R5 starts with a small TypeShade SDF occlusion probe; it does not require a full acoustic solver first.
HRTF, directional reverberation, acoustic tracing, runtime voice budgets and game-wide guarantees are not delivered yet.
Do not restart by replacing the website, moving the compiler pin or merging the stacked engine PRs.

The shared objective is a procedural sound-design engine and professional editor, with reproducible agent iterations.
The owner wants immersive listening from the custom engine and explicitly excludes a dependency on Dolby products.
The existing website is `audio.typeshade.dev`, owned by `typeshade/web`.
The YouTube study is a later integration milestone, not evidence that the engine already has binaural rendering.

The owner requested a fresh picture analysis after this recovery checkpoint.
Read [the Frieren study](../studies/frieren/README.md) for 41 design regions, verified timing corrections and the next creative review passages.
The analysis proposes extending the historical 188-second study to 189.314625 seconds to preserve the closing fade.
It does not replace the old render or complete R1, R7 or R8.

The subsequent [audible sound-design study](../studies/frieren/sound-design/README.md), in PR #28, adds the requested creative work.
It designs all 41 regions and renders 47 procedural layers into three A/B passages with aligned stems.
Read its source recipes, artifact receipts and pending listening questions before expanding to the full scene.
It does not complete the full mix, binaural rendering or real-time validation.
The six source-only Web projects are being integrated in Web PR #47; they are not the review masters.
They retain editable graphs, amplitude envelopes, parameters, timing, trajectories and room settings.
The editor prepares stereo previews before playback. This is not a complete game runtime.
The [Web verification receipt](web-project-verification.json) records all six project imports,
source and space edits, exact edited-WAV regeneration, persistence and the mobile viewport flow.
Web PR #47 remains unmerged and undeployed; check its current CI/review status before publication.


UX continuation, 2026-11-07: the owner-approved Web corrections are implemented at
`8cfd39bfb8688c5079e353baa8b9ad3af17bc821`. Read [the correction record](https://github.com/typeshade/web/blob/8cfd39bfb8688c5079e353baa8b9ad3af17bc821/docs/reviews/typeaudio-editor-ux.md)
and [the local UX verification receipt](web-ux-verification.json).
Project version 2 preserves unapplied code drafts; project switches keep recoverable browser copies.
The inspector scrolls, candidate preview preserves current work, and contextual editing retains the composition timeline.
Mobile task panels keep playback visible. Local checks passed; verify current Web PR CI before publication.
Review, physical-phone testing, listening feedback and authorized publication remain. No engine or compiler pin changed.

Node/code continuation, 2026-11-07: Web `63216066bb8a2109d0c7e5b6286500b04ab39cb0` corrects the mismatch between canvas selection and the editable body.
Built-in nodes show settings; one Code node exposes its per-sample body and actual input/output connections.
Parameter completion/hover includes graph names. Drafts and code Undo survive inspection.
Read [the relationship record](https://github.com/typeshade/web/blob/63216066bb8a2109d0c7e5b6286500b04ab39cb0/docs/reviews/typeaudio-node-code.md) and [the verification receipt](web-node-code-verification.json).
Local verification passed 95 unit tests and all 15 browser suites. Inspect current PR CI before publication.
At that historical sample-body checkpoint, whole-graph code authoring remained unimplemented; the function/composition continuation follows below.
This is a Web correction. Engine/compiler pins, project version 2 and authored source assets are unchanged.

The owner's later authoring clarification is recorded in [Function and visual graph authoring](function-graph-authoring.md).
TypeShade functions and Blueprint-style node editing must be first-class ways to compose the same processing definitions.
Read this proposal before extending the old sample-body editor. The previous binding clarification is not the final authoring architecture.
The proposal preserves event/audio execution boundaries, per-instance state, project recovery and a future native-host integration boundary.
At the original E2a checkpoint, Web adoption and composition editing were pending. Their later continuation follows below; native/Unreal execution remains open.
The detailed contract is proposed in [PR #29](https://github.com/typeshade/typeaudio/pull/29).

Implementation continuation, 2026-11-07: [PR #30](https://github.com/typeshade/typeaudio/pull/30) adds full TypeShade modules,
compiler-derived typed pins, stable port IDs, isolated scalar state and synchronous mono CPU execution.
Read [the API](../function-graphs.md) and [verification receipt](function-graph-verification.json) before changing the adapter.
The impact fixture generates sound through excitation, resonator and gain functions with helpers and imports.
Source compilation stays outside the audio callback; actual worklet output matches host PCM.
At the original E2a checkpoint, the compiler pin, legacy graph API, Web project version 2 and deployed website were unchanged.
Web continuation, 2026-11-07: `6c9f0838f297cbcea684fbe1b8577624f879dee2` adopts engine `346efb4cbe7d0c288b919c6155e96ffd9bda292d`.
The existing editor imports engine JSON, exposes reusable typed nodes and edits complete TypeShade modules with helper navigation.
Named controls, source/WAV rendering, Picture editing and project version 3 use the same source data.
Invalid drafts and delayed results preserve the applied sound. Canvas layout changes stay off the audio update path.
Read [the new receipt](web-function-authoring-verification.json) and [Web's workflow record](https://github.com/typeshade/web/blob/feat/typeaudio-editable-studies/docs/reviews/typeaudio-function-authoring.md).
E2b and source/draft preservation were implemented at that checkpoint. The later composition continuation adds static call editing and connected-input rename; reusable subgraphs remain.
Review and authorized publication remain; do not restart the delivered Web integration.


Composition continuation, 2026-11-07: Web `479fb60dae42e06411406d0063a7fc8f21d65c20` consumes engine `5489ac494e69b5eb2dfae63546cc7643ecfea0f0`.
The Network tab edits genuine TypeShade calls and shares nodes, controls, drafts and Undo with the existing editor.
Visual changes preserve unrelated source/comments. Explicit input rename preserves connected pin IDs through TypeShade symbol edits.
Composition projects use version 4; empty/invalid drafts and stale results retain current work.
Local checks pass 108 Web tests, all 17 browser suites, 119 engine tests and exact actual-worklet PCM.
The engine code checkpoint also passed all eight CI jobs. No compiler pin, merge or deployment changed.
Read [the continuation contract](composition-editing.md), [engine receipt](composition-engine-verification.json) and [Web receipt](web-composition-verification.json).
Next: reusable subgraph packaging with typed interfaces and isolated state, followed by E2d/R1 event-frame scheduling.
Physical-device deadlines, listening acceptance and native/Unreal execution remain open.

## Record maintenance

Each implementation PR updates its roadmap item, source commit, checks and remaining limitations.
Refresh `snapshot.json` after a merge, pin move or cross-repository contract change.
Keep rejected directions and unresolved choices visible in the decision record.
Keep historical measurement receipts unchanged; qualify their interpretation through the validation policy.
Push meaningful checkpoints. A local-only note is not a recovery record.
CI artifacts can expire; keep generation recipes, seeds, inputs and configuration identifiers in Git.

Read the repository's `AGENTS.md` and `CLAUDE.md` before making changes.
Keep owner-facing replies in Korean and repository content in English.
Preserve existing dirty worktrees. Do not merge engine code or deploy the website solely because checks pass.
