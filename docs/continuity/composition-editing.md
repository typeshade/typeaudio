# Composition editing continuation

Status: implementation in progress, 2026-11-07. Continues engine PR #30 and Web PR #47.
Engine base: `08ce938d58d6ab3d4e8c4bc253c1a7bd67ba1368`.
Web base: `bc38b0160e4cad7986ae241da085924cf35d5a67`.
Compiler pin remains `87af4eb0d9d15f02b66b8341b72cab0944290472`.

## Contract

Add E2c composition editing through genuine TypeShade imports, scalar controls,
explicit per-instance state parameters, typed function calls and a returned output.
Each call maps to one engine instance. Stable identity annotations retain state across local symbol renames.
TypeShade validates language semantics. TypeAudio maps supported call statements to its existing graph and validates audio bindings.
No project source is evaluated as JavaScript. Full processing bodies remain in their existing modules.
Unsupported composition statements fail with locations; their drafts are preserved.

The existing graph stays the executable source contract. Composition text is authoring data,
saved alongside it in the Web project with an explicit format version.
Graph and code edits share validation, one document transaction, Undo and stale-result guards.
Projection preserves unrelated source and comments. Comment-only edits do not reset or update Live audio.
Named control values remain in graph metadata; changing a live value does not overwrite a composition draft.

Add explicit connected-input rename using TypeShade symbol edits and existing stable port IDs.
Apply source and metadata together. Unapplied drafts block this separate rename operation until resolved.
State types exposed by composition must be exported from their source module; private state remains valid for ordinary node playback.

## Verification gates

- Graph/code round trips retain IDs, connections, controls and PCM.
- Pointer edits update calls; code edits update the canvas and inspector.
- Symbol rename retains wires and state; invalid edits never replace current work.
- Comments, unrelated helper functions, drafts, save/reopen, Undo and delayed results survive.
- TypeShade completion/diagnostics work in the composition document.
- Existing Web/engine tests, six study projects and mobile viewport flows remain valid.

Reusable subgraph packaging, events/R1, native/Unreal execution and device deadline validation remain separate work.
No merge or production deployment is included. Update this record and recovery index with verified results before handoff.
