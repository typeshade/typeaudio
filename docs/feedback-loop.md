# Web, TypeAudio and TypeShade feedback

The procedural graph implementation moves from the web editor into TypeAudio.
The initial source is `typeshade/web` at `769f3e7818329e1cc936048afb56e8724f34a9d3`.
The engine baseline is `575b42baa13ee666cc050b25da1e63720dfbf6e4`.
The compiler remains pinned to `87af4eb0d9d15f02b66b8341b72cab0944290472`.

`typeaudio/graph` owns graph validation and parameter layout.
`typeaudio/graph/compiler` compiles a graph outside the audio callback.
`typeaudio/graph/runtime` runs the installed program with persistent state.
Compiler code and TypeScript are not imported by the runtime entry point.
The editor owns selection, document history, panels and module loading.

The current graph contract is mono, 48 kHz, and blocks of 1–128 frames.
It permits 16 nodes, two bounded Code nodes and four exposed parameters.
Positions and names remain in the portable graph for document compatibility.
They do not select a kernel or reset its state.

The compiler adapter still imports a private TypeShade generator. It rejects
fallbacks, allocations and nested kernel calls. This is a recorded workaround,
not a supported compiler execution contract. The compiler ask is tracked in
[compiler-asks.md](compiler-asks.md), section F.

Shared reproduction fixtures, candidate checks and web adoption are added in
this change before it is ready for review. Hardware deadline measurements are
separate from deterministic CPU and software-browser checks.
