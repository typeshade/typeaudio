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

The third pin is `415b276a7408936cb483d05ca8bb39e797b05966` (2026-11-08), set by pull request #34 on
2026-11-09. The script lists six implemented proposals that the move passes and that name
`typeaudio`. All six are recorded here. The compiler's `main` is 86 commits after the second pin.

- 0119, pull request #34: the subgroup variant (compiler #1020 and #1026, with the rules). Nothing changes in
  the code. `peak` (`src/kernels/meter.shade.ts`) is a `max` reduction on `f32`, and the variant
  covers it where it runs unfused. The compiler's `CHANGELOG.md` says what a device reports:
  `device.info.subgroups` holds what the probe saw (the adapter's size range, the subgroup size,
  the subgroup count and whether the lanes were consecutive), and `device.statistics.variants`
  names the text the last call of each kernel function dispatched, `'subgroup'` or `'tree'`. Not
  measured here: no code of this repository reads either member. Searched on 2026-11-09.
- 0121, pull request #34: `explain` (`src/explain.ts`, the function `where`) reads
  `group.dispatches` and no longer counts `workgroupShapes`. A fused group with a reduction fold
  prints its dispatches (`fused into one loop, 2 dispatches in all`). `test/explain.test.ts` holds
  such a report. Ask U and ask Y of `docs/compiler-asks.md` read this member. The proposal says
  to update ask W. Ask W reads no dispatch count, and its issue #984 is still open, so it is not
  changed by this pull request.
- 0122, pull request #34: nothing owed, searched on 2026-11-09. No report, record or bundle
  snapshot of this repository holds a fusion origin. `docs/records/` holds JSON and Markdown
  records that name no origin, the tests hold no snapshot file, and no source names `hostFace`
  origins or `originNamespace`. The word `hostFace` in `experiments/07-sound-match/` names a
  measured arm, not the compiler option.
- 0123, pull request #34: scalar `f64` module constants keep their precision, and the ask of issue
  #967 is answered. Experiment 3's emulated-double FFT (variant C, `experiments/03-fft/`) could
  write an `f64` constant where it now passes the value some other way. The experiment is not
  changed by this pull request. A later pull request retires the workaround after a GPU run.
- 0128, pull request #34: `explain` prints the plan's `webgpuScratch` for a plan on WebGPU, as
  allocations and reuses with their descriptor bytes. A report without the member prints
  `WebGPU scratch storage: not reported`, and `mergeReports` keeps that apart from zero.
  `test/explain.test.ts` holds both. Ask U of `docs/compiler-asks.md` reads this member.
- 0129, pull request #34: a call that reads a `Resident` whose producer failed now fails with that
  error, and independent calls still run (issue #998). Experiment 5's record
  (`docs/records/05-convolution-container.md`, candidate issue 2) and the row of #998 in section 3
  of `docs/compiler-asks.md` (the ledger's "ask 2" of the proposal) need rechecking against this
  behaviour. Neither the experiment nor the
  record is changed by this pull request.
