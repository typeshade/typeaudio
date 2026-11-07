# Composition editing continuation

Status: engine and Web implementation locally verified, 2026-11-07.
Continues engine PR #30 and Web PR #47.
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


## Delivered continuation

Engine source: `5489ac494e69b5eb2dfae63546cc7643ecfea0f0`. The compiler entry exports
`projectFunctionComposition`, `applyFunctionComposition`, `compositionIdentity` and `renameFunctionInput`.
The composition contract is documented in [the API](../function-graphs.md#composition-source-and-connected-input-rename).
Engine checks pass 119 tests in 19 files. Actual AudioWorklet output matches host PCM over 16,384 frames with maximum error zero.
State-class import aliases, duplicate state instances, trailing signature commas and reserved domain IDs are covered.
No compiler pin move or callback-path change is included.

Web application checkpoint: `479fb60dae42e06411406d0063a7fc8f21d65c20`. It consumes the engine commit above.
The existing Network source tab edits actual calls and reveals the selected call site.
Connected input rename uses stable pins and TypeShade symbol edits. Composition source uses project version 4,
sound-file version 3 and browser envelope version 3. Empty/unsupported drafts remain unapplied and recoverable.
Comment-only source edits retain original bindings/order and keep Live audio identity unchanged.
Background draft reconciliation is separate from newer user edits, so internal rebasing cannot invalidate pending imports.

The final Web checkpoint passes compiler/type/architecture checks, 108 unit tests in 21 files, the production build and all 17 browser suites.
The architecture check covers 226 modules. All six study projects, legacy authoring and mobile flows remain covered.
Read the [engine receipt](composition-engine-verification.json) and [Web receipt](web-composition-verification.json) for exact source hashes, checks, screenshots and PCM hashes.
All eight engine CI jobs passed at the code checkpoint. Current PR-head CI is separate from these local receipts.

Next implementation: reusable subgraph packaging with typed external pins, stable dependency identity,
isolated per-instance state and versioned imports. Then integrate E2d with the R1 audio-frame event queue,
late-event rules, bounded capacity, voice/quality budgets and measured overload behavior.
Native/Unreal execution, GPU function processing, physical-device timing and listening acceptance remain open.
