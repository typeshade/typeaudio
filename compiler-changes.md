# Compiler changes this repository has handled

A change to the compiler that alters what this repository builds on is agreed first as a
proposal in the compiler's `changes/` directory (the compiler's `changes/README.md` explains the
process). Each proposal lists, under `downstream`, the work it will owe the repositories it names.

When a pull request moves the compiler pin (`typeshade` in `package.json`) past a proposal that
names `typeaudio`, the script `scripts/downstream-impact.ts` of the compiler lists the proposal
until its work is done on that branch and its id is recorded below. Record one list item per
proposal: the id first, then the pull request that did the work.

A source tarball carries no git history, so the script reads a checkout of the compiler, with the
two pins named. Run it from the root of this repository:

```text
bun <script> --repo typeaudio --compiler <checkout> --old <commit> --new <commit> --check
```

- `<script>` is `scripts/downstream-impact.ts` of a compiler checkout at or after `43413f9f`
  (compiler #1011, for issue #1000), the commit that added `--compiler`. It need not be the pin's
  checkout. The script of the pin `87af4eb0` has no `--compiler`.
- `<checkout>` is a checkout of the compiler at any path, inside this repository or outside it. Its
  history holds both pins.
- `--old` is the pin before the move. A checkout named by `--compiler` has no pin to read, so
  `--old` is required.
- `--new` is the pin after the move. Its default is the `HEAD` of the checkout, so name it.
- `--check` makes the script exit 1 while a finding binds.

Pull request #15 ran it on its clean tree, with the script of the compiler's `main` at `f007d4c5`
and a checkout at `87af4eb0`. The result was exit 0, and the script printed:

```text
Nothing in this repository names what the compiler bump removes.
```

Keep the checkout outside the tree of this repository. At the pin `87af4eb0`, `tshc sync --check`
reads the compiler's own shader modules under the tree, and `bun run check` then fails (observed
with a symlink to a checkout). That is compiler issue #1001, fixed on the compiler's `main` by #1012
(`96adb1e4`), after the pin.

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
