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

The first pin is `145666068ca5d6ecfba32aa0ea4289cf0fc3b762`, set by pull request #5. No proposal at
that commit names `typeaudio` under `downstream`, so no proposal is recorded yet.
