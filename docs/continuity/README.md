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

## Current work

This recovery change is in progress. It will record decisions, repository snapshots, staged work,
validation gates, source recovery material and fresh-workspace recovery instructions.
The next engine implementation concerns bounded real-time execution and 3D path data.
HRTF, directional reverberation and TypeShade acoustic tracing remain planned work.

Read the repository's `AGENTS.md` and `CLAUDE.md` before making changes.
Keep owner-facing replies in Korean and repository content in English.
Preserve existing dirty worktrees. Do not merge engine code or deploy the website solely because checks pass.
