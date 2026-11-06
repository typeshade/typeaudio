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

## Reproduce an editor case

The Web File menu exports an applied graph voice as a JSON snapshot. It includes
all three source revisions, the compiler backend, sample rate, block size and
browser environment. It excludes user media, unapplied drafts, layer mixing,
the studio transport end fade and prior edits. `capture: snapshot` makes that
scope explicit. No file is uploaded automatically.

The sequence form adds frame-stamped parameter, volume and retrigger events.
The engine validates event order, values, frame bounds and graph limits before
execution. This form is used by the shared tone regression. The Web does not
claim to record a historical live session.

Run a downloaded case from this repository:

```sh
bun run feedback path/to/reproduction.json --out .feedback/report.json
```

Run the shared corpus:

```sh
bun run test:feedback
bun run feedback --out .feedback/report.json
```

The report identifies the captured versions separately from the execution
versions. It retains the generated TypeShade source beside the JSON report.
This is the source to reduce when a compiler defect is suspected. Reproduction
JSON cannot supply executable JavaScript; only validated graph source reaches
the compiler. The CLI loads compiler-generated modules before running DSP.

Report fields include PCM hash, RMS, peak, invalid samples, compile time and
cold/warm DSP timings. `p99Ms`, `maxMs` and `overBudgetBlocks` cover synchronous
DSP calls only. They exclude browser scheduling, transfer and measured output
underruns. Short fixture timings are diagnostic samples, not device benchmarks.

## Validate and promote a version pair

The engine CI runs the same graph fixtures as the website. The compiler feedback
workflow tests both the pinned compiler and a candidate source archive. It checks
every installed compiler source file against the candidate checkout first.
A separate parity job compares the complete fixture set, PCM fingerprints, signal
statistics and event counts. Missing cases and changed results fail that job.
A candidate failure does not change the pinned compiler or production website.

The TypeShade downstream workflow also runs this corpus on compiler code PRs.
Its engine revision is fixed so unrelated engine changes cannot move its baseline.
Advance that corpus pin deliberately when an engine regression is added.

The Web `pin TypeAudio` workflow accepts a full merged engine revision, reads its
compiler pin, runs studio and reproduction checks, then opens a version-pair PR.
It does not merge or deploy the result. The source modules and website resolve
the same installed TypeShade instance; matching version strings alone are not
enough for GPU resident-array identity.

A compiler proposal's implementation is separate from downstream adoption.
Record a compiler-pin move in `compiler-changes.md`, run the compiler's downstream
impact check, and retire a workaround only after the original case passes through
the website again. Ask F and proposal 0122 track the remaining supported CPU
artifact contract. The private adapter stays until that contract is accepted,
implemented, tested and adopted.

Hardware deadline measurements remain separate from deterministic CPU and
software-browser checks. The graph corpus does not cover the website's legacy
synthesizer, its layered transport, or every planned TypeAudio graph feature.
