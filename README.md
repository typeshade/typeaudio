<p align="center">
  <img height="112" src="assets/icon-256.png" alt="TypeAudio">
</p>

# TypeAudio

**A GPU audio engine written in TypeScript, on [TypeShade](https://github.com/typeshade/typeshade).**

TypeAudio is in its first code. This repository holds the design, the record of what the engine
asks of the compiler, the experiments that decide the implementation, and the first units, kernels
and render, tested on the CPU tier of the compiler. Nothing is published to npm yet.

The website and interactive playground target [audio.typeshade.dev](https://audio.typeshade.dev/).
See [website/README.md](website/README.md) for build and deployment details.

To work on it:

1. Install [Bun](https://bun.sh).
2. Clone the repository.
3. Run `bun install`. It installs the pinned compiler and writes the host views.
4. Run `bun run check` and `bun run test`.

- [`docs/vision.md`](docs/vision.md): what a developer writes, sees and never has to know; the
  principles and the bar they are measured by; what the engine does for a sound designer; the
  architecture; the honest boundaries; the first experiments.
- [`docs/architecture.md`](docs/architecture.md): the architecture in detail: the loop shapes,
  one block as one `fuse` plan, banks and buses on the device, events, the transports, and the
  decisions the owner takes.
- [`docs/compiler-asks.md`](docs/compiler-asks.md): the compiler proposals TypeAudio rests on and
  its asks of the compiler, each with its status.
- [`docs/experiments.md`](docs/experiments.md): the experiments, in order, with their status;
  [`docs/records/`](docs/records/) holds the record of each run.
- [`compiler-changes.md`](compiler-changes.md): the proposals of the compiler this repository
  has handled, recorded when the compiler pin moves.
- [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md): the operating rules and the map, for
  every agent and person working here.

TypeAudio is a downstream repository of the compiler, as TypeNN and TypeCV are: it pins a commit
of `typeshade/typeshade`, writes its own workarounds first, measures them on devices, and asks
the compiler for the general part as a change proposal whose `downstream` entry names what this
repository then retires.
