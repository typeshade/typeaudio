<p align="center">
  <img height="112" src="assets/icon.png" alt="TypeAudio">
</p>

# TypeAudio

**A GPU audio engine written in TypeScript, on [TypeShade](https://github.com/typeshade/typeshade).**

TypeAudio is in its design phase. This repository holds the design, the record of what the
engine asks of the compiler, and the experiments that decide the first implementation. There is
no library code yet, and nothing to install.

- [`docs/vision.md`](docs/vision.md): what a developer writes, sees and never has to know; the
  principles and the bar they are measured by; what the engine does for a sound designer; the
  architecture; the honest boundaries; the first experiments.
- [`docs/compiler-asks.md`](docs/compiler-asks.md): the compiler proposals TypeAudio rests on and
  the ones it asks for, each with its status.
- [`docs/experiments.md`](docs/experiments.md): the experiments, in order, with their status.
- [`compiler-changes.md`](compiler-changes.md): the proposals of the compiler this repository
  has handled, recorded when the compiler pin moves.
- [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md): the operating rules and the map, for
  every agent and person working here.

TypeAudio is a downstream repository of the compiler, as TypeNN and TypeCV are: it pins a commit
of `typeshade/typeshade`, writes its own workarounds first, measures them on devices, and asks
the compiler for the general part as a change proposal whose `downstream` entry names what this
repository then retires.
