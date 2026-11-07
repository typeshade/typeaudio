# TypeAudio recovery and implementation plan

This is the restart entry point for the TypeAudio immersive-audio program.
It must remain sufficient when the chat history and the original workspace are unavailable.
The owner requested durable recovery instructions on 2026-11-06.

Start from the durable [recovery index, issue #26](https://github.com/typeshade/typeaudio/issues/26) if the workspace is gone.
[PR #25](https://github.com/typeshade/typeaudio/pull/25) preserves this plan and its source archive remotely.
The [recovery verification receipt](recovery-verification.json) records a fresh remote clone, 69 verified files and one regenerated procedural event.

The implemented engine is on room PR #24 at `86560f83a92ff8374346157000b8a467daa39aab`.
It builds on spatial PR #23 and graph-feedback PR #22. These pull requests are not merged.
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
The later authoring clarification defines E2a as the engine contract needed before extending the old sample-body editor.
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
Whole-graph TypeScript authoring and node/code round trips remain unimplemented.
This is a Web correction. Engine/compiler pins, project version 2 and authored source assets are unchanged.

The owner's later authoring clarification is recorded in [Function and visual graph authoring](function-graph-authoring.md).
TypeShade functions and Blueprint-style node editing must be first-class ways to compose the same processing definitions.
Read this proposal before extending the old sample-body editor. The previous binding clarification is not the final authoring architecture.
The proposal preserves event/audio execution boundaries, per-instance state, project recovery and a future native-host integration boundary.
Implementation is pending; no Unreal plugin or function-graph round trip is delivered yet.
The detailed contract is proposed in [PR #29](https://github.com/typeshade/typeaudio/pull/29).

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
