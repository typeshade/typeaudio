# Implementation state and source references

Snapshot date: 2026-11-06. [snapshot.json](snapshot.json) records exact remote PR heads and bases.
Re-query remote status before continuing; this file is a historical checkpoint, not a live dashboard.

Priority update, 2026-11-07: the owner's first delivery milestone is editable agent output in the existing Web editor.
[Web #47](https://github.com/typeshade/web/pull/47) adds six source-only study projects,
code/parameter/space edits and save/reopen verification, based on Web #46.
It consumes engine room commit `86560f83a92ff8374346157000b8a467daa39aab` with the unchanged compiler pin.
Its [contract and status](https://github.com/typeshade/web/blob/feat/typeaudio-editable-studies/docs/typeaudio-editable-projects.md)
precede further R1 work. No new deployment or merge is implied by this checkpoint.
Local Web verification is complete at `fad1cd07fb516d7eb1b2dc949c617606d4cdad45`.
Read [the verification receipt](web-project-verification.json) for commands, scope and remaining limits.


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

Authoring direction, 2026-11-07: the owner requires normal TypeShade functions and Blueprint-style visual composition.
The [E2 proposal](function-graph-authoring.md) is the next authoring contract to review before another sample-body extension.
It records typed pins, reusable functions/subgraphs, isolated instance state, transaction history and separate event/audio execution.
Design [PR #29](https://github.com/typeshade/typeaudio/pull/29) is followed by implemented E2a in [PR #30](https://github.com/typeshade/typeaudio/pull/30).
The new function engine has its own version-1 source document; legacy graphs and Web project version 2 remain unchanged.
Web adoption, code/graph composition editing and event scheduling remain pending. The compiler pin and Web deployment are unchanged.
See [the delivered API](../function-graphs.md) and [verification receipt](function-graph-verification.json).

## Repository ownership

| Repository | Responsibility | Recorded main commit |
| --- | --- | --- |
| `typeshade/web` | Existing editor, UI, persistence, video transport, template loading and deployment | `769f3e7818329e1cc936048afb56e8724f34a9d3` |
| `typeshade/typeaudio` | Audio semantics, portable graph execution, spatial rendering and reproduction corpus | `575b42baa13ee666cc050b25da1e63720dfbf6e4` |
| `typeshade/typeshade` | Language, compiler, runtime and supported execution artifacts | `093f6c609dacf91a783c0b8b9d96981bcea16cf7` |

The engine and TypeAudio Web application still install compiler pin `87af4eb0d9d15f02b66b8341b72cab0944290472`.
Compiler main is not the application pin. Do not silently replace the tarball or lockfile.

## Open review chain

| PR | Recorded head | Base | State and content |
| --- | --- | --- | --- |
| [TypeAudio 22](https://github.com/typeshade/typeaudio/pull/22) | `93d9a7c6086fe7f8b80a97aef3aa2198e077cae2` | main | Ready for review. Engine-owned graph, portable reproduction and candidate feedback. |
| [TypeAudio 23](https://github.com/typeshade/typeaudio/pull/23) | `7d33eb8c243e0bc6c066de348c6034c4ef42645a` | `feat/audio-feedback-loop` | Ready for review. Listener-relative stereo, distance damping and authored occlusion. |
| [TypeAudio 24](https://github.com/typeshade/typeaudio/pull/24) | `86560f83a92ff8374346157000b8a467daa39aab` | `feat/spatial-audio` | Ready for review. Six room reflections, moving-delay crossfades and diffuse stereo tail. |
| [Web 45](https://github.com/typeshade/web/pull/45) | `61bdf291cbd5f5dd5fdc260302c7857c4ac7f644` | main | Ready for review. Consume engine graph execution and export feedback. |
| [Web 46](https://github.com/typeshade/web/pull/46) | `8517faca763e75dec997fa9ed6f792f4563a1acb` | `feat/typeaudio-feedback-loop` | Ready for review. TypeShade code language intelligence and editor structure. |
| [TypeShade 1037](https://github.com/typeshade/typeshade/pull/1037) | `73a966c475acad27ab95fcd59b44c339fccc9458` | main | Draft proposal 0122. A requested synchronous CPU artifact, not an available implementation. |
| [TypeShade 1038](https://github.com/typeshade/typeshade/pull/1038) | `5a6b43cf572a1f9390c8c169e57290e793707c68` | main | Ready for review. Candidate compiler feedback against TypeAudio. |

Engine review order is 22 → 23 → 24. Web review order is 45 → 46.
After any authorized base merge, retarget dependent PRs and verify their diff and exact new head.
Other open compiler and Web pin PRs exist. They are not implicitly part of this program.

## Delivered engine behavior

- `src/function-graph/`: full TypeShade functions, reflected typed pins, reusable stateful instances and synchronous mono CPU processing (E2a, PR #30).
- `fixtures/function-graph/impact.json`: source-only excitation/resonator/gain example with named controls.
- `scripts/check-function-worklet.ts`, `bench-functions.ts`, `render-function-demo.ts`: worklet PCM parity, host timing and regenerable listening artifact.
- `src/graph/`: portable synthesis graph, generated CPU execution and deterministic state.
- `src/feedback/` and `fixtures/feedback/`: source-only reproductions and shared regression cases.
- `src/spatial/`: fixed-capacity stereo mixing, listener basis, distance gain, damping and authored occlusion.
- `src/spatial/room/`: rectangular room preparation, six image paths, bounded delay buffers and shared four-line FDN.
- `scripts/check-room-worklet.ts`: actual OfflineAudioContext/AudioWorklet PCM comparison.
- `scripts/bench-room.ts`: host CPU component timing, static and moving sources.
- `scripts/render-room-demo.ts`: reproducible dry, small-room and hall listening candidates.

Room PR code `09947daab1cded81f8da3c0e71e7045cc2d8c5f4` passed 82 tests, including 19 room tests.
CI tested merge checkout `0be9fd4a82a68d77e83ce93a749edd7c82b07b70`.
The recorded Chromium worklet comparison has zero maximum sample error over 65,536 frames.
Source head `86560f8` adds API documentation and receipts after that code check.
See [the room receipt](../records/room-acoustics-ci.json), [room API](../room-acoustics.md) and [spatial API](../spatial-audio.md).

These checks do not establish binaural perception, live-device deadlines or a production website deployment.
The room FDN has no directional late field. The first-order path is converted to stereo too early for a complete 3D renderer.

## Web behavior and remaining integration

The existing application is `web/apps/typeaudio`; the engine's legacy `website/` is not the current product development destination.
Web PR #47 pins `sources/typeaudio` to room commit `86560f83a92ff8374346157000b8a467daa39aab`.
The new function engine in PR #30 has not been adopted by that Web submodule.

Repository review records describe the component workspace, Tone rollback correction, synchronous live processing,
finite render changes, node/code workspace and feedback tooling. Re-read those records and current tests before editing.
Relevant Web documents are `docs/reviews/typeaudio-studio.md` and `docs/reviews/typeaudio-component-workspace.md`.
Historical evidence is scoped to each change; it is not a claim that every context menu, tooltip or device has been reviewed.

The sound-study loader still needs chapter/asset handling, source-to-cache revision links, shared render parity and live YouTube validation.
Previously recorded constraints include 60-second scenes, 24 cues and a global asset library unsuitable for the whole study.
Re-check the current implementation before removing those limits; they can change after this checkpoint.

## Compiler observations

The pinned compiler includes `examples/rt-renderer-class.shade.ts` and `examples/loop-kernel.shade.ts`.
The first has SDF classes, normals and sphere tracing. Both passed `tshc check` on 2026-11-06.
That is a language check, not an acoustic-solver implementation or a GPU performance measurement.

[Compiler asks](../compiler-asks.md) record the synchronous worklet boundary, generated-code allocations,
array conversion, dispatch, scratch-buffer and timing issues. Some entries describe older measurements.
Verify each issue against the actual candidate before treating it as a current universal limitation.

## Original workspace inventory

| Path | Recorded state | Recovery significance |
| --- | --- | --- |
| `/workspace/typeaudio-room` | Clean, room head `86560f8` | Canonical implemented engine snapshot. |
| `/workspace/typeaudio-feedback` | Clean, graph head `93d9a7c` | Original sound-study renderer dependency. |
| `/workspace/typeaudio-spatial` | Head `5131e5f`, dirty package and untracked spatial files | Interrupted older work. Preserve as archival context; PR #23 supersedes it. |
| `/workspace/typeaudio` | `feat/live-audio`, `1d6eb0d` | Earlier worktree; do not reset it. |
| `/workspace/web` | Web head `8517fac`, untracked production workflow | Workflow text is preserved in the recovery archive and adapted into this plan. |
| `/workspace/scratch/frieren-sound-design-v2` | Local review mix and source data | Recover source from the archive; regenerate outputs. |

Absolute workspace paths are provenance, not requirements for a new machine.
The recovery procedure uses remote commits and a portable extraction directory.
