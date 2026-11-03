# Compiler changes this repository has handled

A change to the compiler that alters what this repository builds on is agreed first as a
proposal in the compiler's `changes/` directory (the compiler's `changes/README.md` explains the
process). Each proposal lists, under `downstream`, the work it will owe the repositories it names.

When a pull request moves the compiler pin (`typeshade` in `package.json`) past a proposal that
names `typeaudio`, `scripts/downstream-impact.ts` of the compiler
(`bun <typeshade>/scripts/downstream-impact.ts --repo typeaudio`) lists the proposal until its work
is done on that branch and its id is recorded below. Record one list item per proposal: the id
first, then the pull request that did the work.

A source tarball carries no git history, so the script runs from a checkout of the compiler, with
the two pins named: `bun <typeshade>/scripts/downstream-impact.ts --repo typeaudio --submodule
<typeshade> --old <commit> --new <commit>`, where `<typeshade>` is the path of the checkout,
relative to this repository's root.

The checkout must lie inside this repository's root. The script names it to `git` as the pathspec
`:!<typeshade>`, and a path outside the root fails with `is outside repository`. Put the checkout in
a directory that `.gitignore` names, such as `.cache/typeshade`, and remove it before `bun run
check`: `tshc sync --check` reads the compiler's own shader modules under it (observed with a symlink
to a checkout).

The first pin is `145666068ca5d6ecfba32aa0ea4289cf0fc3b762`, set by pull request #5. No proposal at
that commit names `typeaudio` under `downstream`, so no proposal was recorded then.

The second pin is `87af4eb0d9d15f02b66b8341b72cab0944290472`, set by pull request #15. The script
lists two implemented proposals that the move passes and that name `typeaudio`. Both are recorded
here.

- 0109, pull request #15: Amendment 1 (typeshade/typeshade#993, `87af4eb0`). `Bank.read()` is
  `Promise<T[]>` and returns what the `Resident` gives, instances of the unit class. The `State<T>`
  type is gone. `test/render.test.ts` holds a bank read back after a render to `instanceof Voice`.
  Ask N of `docs/compiler-asks.md` is retired. The same implementation meets item 2 of ask F.
- 0118, pull request #15: typeshade/typeshade#990 (`480b6a64`). `explain` reads the `tier` and the
  `why` of each group from the `FuseReport`, and no longer infers the tier from the absence of
  `workgroupShapes`. `test/explain.test.ts` holds a WebGL2 report in which `synth` and `peak` ran on
  the CPU tier. Ask P of `docs/compiler-asks.md` is retired.
