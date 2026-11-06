# TypeAudio recovery and implementation plan

This is the restart entry point for the TypeAudio immersive-audio program.
It must remain sufficient when the chat history and the original workspace are unavailable.
The owner requested durable recovery instructions on 2026-11-06.

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

The next engine task is R1 in [the roadmap](roadmap.md): a bounded real-time contract and its measurement harness.
R2 establishes renderer-independent 3D acoustic paths. R3 adds HRTF output.
R5 starts with a small TypeShade SDF occlusion probe; it does not require a full acoustic solver first.
HRTF, directional reverberation, acoustic tracing, runtime voice budgets and game-wide guarantees are not delivered yet.
Do not restart by replacing the website, moving the compiler pin or merging the stacked engine PRs.

The shared objective is a procedural sound-design engine and professional editor, with reproducible agent iterations.
The owner wants immersive listening from the custom engine and explicitly excludes a dependency on Dolby products.
The existing website is `audio.typeshade.dev`, owned by `typeshade/web`.
The YouTube study is a later integration milestone, not evidence that the engine already has binaural rendering.

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
