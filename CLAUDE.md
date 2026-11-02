# Repository operating rules

Read `AGENTS.md` first: it is the map of this repository and of the design. This file is the
shared source of operating rules for every agent working here. They follow the rules of the
compiler repository, `typeshade/typeshade` (`CLAUDE.md` there), where this file says nothing.

## The language of the conversation

Answer the owner in Korean, every reply, from the first to the last of a session. What goes into
the repository stays in English as it is: code, comments, commit messages, pull request titles
and bodies, and every document in the tree.

## Writing and configuration management

Every reply to the owner and every task follows two disciplines. The writing follows the
principles of ASD-STE100, Simplified Technical English. The work follows the configuration
management functions of SAE EIA-649 and ISO 10007. Both are local conventions and claim no
compliance or certification.

**Writing.**

- Keep descriptive text and procedures apart. Write a procedure as numbered steps in the
  imperative, with one action in each step.
- Give each sentence one topic. Keep a step to 20 words and a descriptive sentence to 25. Give
  each paragraph one topic.
- Use one term for one thing. Use the exact identifier of each file, symbol, check and command.
- Use the active voice when the actor is known. Do not invent an actor.
- Keep facts, inferences, proposals, decisions and observed results apart. Label each one when
  the difference matters.

**Configuration management.**

- Identification. Name each configuration item by its identifier: a repository, a branch, a
  commit, a pull request, a compiler proposal, the compiler pin, an issue. "The latest" is no
  identifier. A commit hash is one.
- Baselines. `main` at a commit is this repository's baseline. The compiler pin is this
  repository's baseline of the compiler. `docs/vision.md` at a commit is the design baseline.
- Change control. Change a baseline only through a pull request. A change to the design (the
  principles, the bar, the architecture, what is not promised) needs the owner's go-ahead in the
  conversation before it is merged. A change this engine needs from the compiler is a change
  proposal in the compiler's `changes/` directory, with `downstream: typeaudio` in its front
  matter; `docs/compiler-asks.md` records each one with its status. One record carries one
  change, so two unrelated changes are two pull requests.
- Status accounting. A status report names each request and each change with its identifiers:
  not started, in progress or done. List each open item with its reason and its next action.
- Verification and audit. Support a claim of completion with the checks that ran: the command,
  the date, the configuration (commit, tool versions, device) and the result. Report a check that
  did not run as not run. Functional verification and the document audit are separate.
- Deviations. Record each difference between the design and the delivered work, on the pull
  request, with its disposition: closed, made part of the design by an amendment, or open.

## The two rules that decide a design question

- **DX first.** When the developer's experience and the engine's throughput conflict, the
  experience wins. Throughput is the engine's business, and `explain` reports it.
  `docs/vision.md` states the principles and the reviewer's question for each.
- **The compiler owns the general part.** A workaround is written in this repository first and
  measured on devices. The general part is then asked of the compiler as a proposal, and this
  repository retires its workaround when the proposal is implemented and the pin moves. Nothing
  domain-shaped is asked of the language (compiler `docs/dx.md`, principle 7).

## The compiler pin

The compiler is pinned at a commit. The site, the editor and Radiance pin it as a git submodule.
TypeNN and TypeCV install it from a source tarball (compiler proposal 0071, decision D6). This
repository installs it from a source tarball too, as TypeNN and TypeCV do. The pin is the
`typeshade` entry of `devDependencies` in `package.json`:
`https://github.com/typeshade/typeshade/archive/<commit>.tar.gz`, and `bun.lock` holds its hash.

The tarball holds the compiler's TypeScript sources. Node does not load TypeScript from
`node_modules`, so the scripts run on Bun's runtime: `bunfig.toml` sets `[run] bun = true`, and
the `prepare` script is `bun --bun tshc sync`.

To move the pin:

1. Change the commit in the `typeshade` URL in `package.json`.
2. Run `bun install`.
3. Run `bun run check` and `bun run test`.
4. Run the compiler's `scripts/downstream-impact.ts` over the old and the new commit
   (`compiler-changes.md` gives the command).
5. Commit `package.json`, `bun.lock` and `compiler-changes.md` in one pull request.

A pull request that moves the pin past a compiler proposal that names `typeaudio` in its
`downstream` entry records the proposal's id in `compiler-changes.md`, with the pull request that
did the work, and the compiler's `scripts/downstream-impact.ts` fails the pull request until it
does.

## Running sub-agents

The owner's rules, given on 2026-10-13, for every session:

- Run at most three sub-agents at the same time. Start the next one only when one has finished.
- Stop a sub-agent as soon as its report is in. A sub-agent stops every server and background
  process that it started before it reports.
- Give every task its pull request first. Push the first commit early and open a draft pull
  request at once. Push each later commit to the same branch, so that no work stays only in the
  container.
- Each sub-agent writes its working files under a directory of its own; a scratch directory
  shared between sub-agents loses files.

## Merging

This repository has no ruleset yet. The rule is written here:

- Never push to `main` directly after the initial commit, and never force-push it.
- Merge a pull request only when the owner has said in the conversation to merge it, or when it
  changes documentation only and the owner approved the design it records.
- Mark a draft pull request ready for review as soon as its checks are green, not at merge time.
- Waiting on a check is not work: end the turn, and let the pull request's events wake the
  session. A pull request that is green and waits only on the owner needs no check-in.
- After a merge, report it to the owner.
