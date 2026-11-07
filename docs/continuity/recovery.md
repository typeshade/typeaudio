# Fresh workspace recovery procedure

Use this procedure when the previous chat and `/workspace` tree are unavailable.
The current plan is `typeshade/typeaudio`, branch `feat/typed-function-graphs`, starting at `docs/continuity/README.md`.
The continuation PR is [TypeAudio #30](https://github.com/typeshade/typeaudio/pull/30).
It retains the recovery foundation from [PR #25](https://github.com/typeshade/typeaudio/pull/25) and later design/study checkpoints.
Use [recovery index #26](https://github.com/typeshade/typeaudio/issues/26) if the branch was renamed or removed after merging.
Never assume an absolute path from an old receipt still exists.

## Verified recovery checkpoint

The [verification receipt](recovery-verification.json) identifies the tested source commit and CI recovery job.
A fresh GitHub clone installed the pinned compiler and regenerated event `air-0` without the original source directories.
All 69 archived files passed SHA-256 verification. Invalid and clipped sample counts were zero.
The tool also rejected a corrupted archive and an existing output directory.
This verifies source recovery and one procedural event. Full remix, Web integration and physical-device listening were not repeated.

Give a replacement agent this instruction:

> Resume TypeAudio from https://github.com/typeshade/typeaudio/issues/26 and `docs/continuity/README.md`.
> Read the repository rules, owner decisions, snapshot and roadmap before editing.
> Reconcile remote PR status. Continue E2b Web adoption after E2a; preserve E1 drafts and source projects.
> R1 remains the separate bounded real-time contract and full-chain measurement track.
> SwiftShader supports correctness and rough controlled comparisons; it does not establish hardware GPU performance or game deadlines.

## Recover the plan and source

1. Install Git, Python 3.12 or newer, Bun 1.4.4 and Node compatible with the Web repository's `engines` field.
2. Clone TypeAudio into a new directory.
3. Fetch the recovery PR and check out its head.
4. Read `AGENTS.md`, `CLAUDE.md` and `docs/continuity/README.md`.

```sh
git clone https://github.com/typeshade/typeaudio.git typeaudio
cd typeaudio
git fetch origin refs/pull/30/head:recovery/continuity
git switch recovery/continuity
bun install --frozen-lockfile
```

If the recovery work is merged, read its successor on main and inspect the index before selecting a historical head.
`snapshot.json` identifies the engine source, compiler pin, Web head and compiler proposal heads.
The recovery branch contains the room implementation and E2a's typed function CPU profile.
Do not replace the compiler pin with compiler main.

## Recover the Web and compiler context

Run these commands from the directory containing the recovered TypeAudio checkout:

```sh
git clone https://github.com/typeshade/web.git web
git -C web fetch origin refs/pull/47/head:recovery/typeaudio-editable-studies
git -C web switch recovery/typeaudio-editable-studies
git -C web submodule update --init sources/typeaudio
git clone https://github.com/typeshade/typeshade.git typeshade
git -C typeshade fetch origin refs/pull/1037/head:recovery/audio-cpu-proposal
```

Re-query PR status before editing. A later merge can supersede the historical work branches.
For an exact snapshot, use the full commits from `snapshot.json`, rather than assuming PR heads never change.
The TypeAudio Web application is `web/apps/typeaudio`.
The unrelated TypeShade site's compiler submodule is `apps/typeshade/vendor/shader-dsl`, not `sources/typeshade`.
Use pnpm 10.28.2 from the Web package-manager declaration. Follow the repository's setup instructions and submodule preparation.

## Restore authored study source

Run from the recovered TypeAudio checkout. The output directory must not exist.

```sh
python3 scripts/recovery/restore-study.py --output ../recovered-audio --web ../web --smoke-render
```

The tool verifies the archive and all 69 authored files before extraction.
It maps old engine/Web paths in restored copies and compiles/renders the first v2 event when `--smoke-render` is set.
It writes `restoration-report.json`, including archive hash, mapped files, source commit and the smoke-render result.
Without a Web checkout, omit `--web`; v2 still restores, but the old v1 imports require mapping before use.
The archived `legacy-spatial/` state is historical. Do not copy it over the recovered room branch.

For complete study regeneration, install NumPy 2.3.5, SciPy 1.17.0 and an identified FFmpeg build.
Capture-time FFmpeg was 7.1.5 and Python was 3.12.14. Source and signal receipts remain the comparison references.
Use a separate Python environment; do not replace unrelated system dependencies.

Run the following from `recovered-audio/frieren-sound-design-v2`:

```sh
python3 source/design.py
bun source/render.ts
python3 source/mix.py
python3 source/mobile.py
```

Do not leave `EVENT_ONLY` set when rendering the complete study.
To regenerate historical A/B pairs, first render v1 using its `design.py`, `render.ts` and `mix.py` in the sibling directory.
Then run v2 `source/review.py` and `source/package.py`.
Do not run v1 video-preview packaging as part of public template publication. The public reference remains YouTube.
These scripts do not upload to R2 or deploy a site.

## Re-establish the engine baseline

```sh
bun run check
bun run test
bun run feedback --out .feedback/recovered.json
bun x playwright-core install --with-deps chromium
bun run test:room-worklet
bun run demo:room
bun run bench:room --out artifacts/room/recovered-cpu.json
```

At the recorded code baseline, the suite had 82 tests. Future changes can legitimately change the count.
Compare the executed commit and scope before treating a count difference as a regression.
The worklet check is offline PCM parity; the benchmark is room-component CPU timing.
Software WebGPU results must follow [the validation policy](validation.md).
Do not rerun costly unrelated experiments unless the next change needs them.

## Start the next implementation safely

1. Compare remote PR heads with `snapshot.json` and identify merged or superseded work.
2. Preserve any dirty files in the recovered workspace before switching branches.
3. Select E2b from [the roadmap](roadmap.md), preserving E1 projects and E2a's verified engine contract.
4. Create a focused branch from the reconciled implementation base.
5. Push an early checkpoint and open a draft PR.
6. Record the base, compiler pin, acceptance criteria and unmeasured hardware profiles.
7. Keep unrelated deployment, compiler pin and creative-publication work separate.

The next authoring action is Web function-node adoption, with project migration and saved-draft preservation gates.
The next runtime action is R1's bounded real-time contract and full source-plus-room measurement.
HRTF, 3D paths and TypeShade propagation follow the dependency graph in the roadmap.
Do not restart by creating another website or rewriting the existing editor wholesale.

## Common recovery problems

| Symptom | Resolution |
| --- | --- |
| `tshc` host views missing | Run `bun install` or `bun --bun tshc sync` in the recovered checkout. |
| `.shade.ts` source package fails under Node | Use the pinned Bun runtime for compiler-source scripts. |
| GitHub CLI PR edit fails on deprecated project fields | Use the pull-request REST endpoint with a body file. |
| CI artifact download returns 403 or expires | Regenerate from Git recipes; use retained JSON receipts for historical measurements. |
| Web import path fails | Restore the Web PR head and its `sources/typeaudio` submodule; supply `--web`. |
| Live callback receives async kernel output | Use the verified synchronous path; proposal 0122 is not implemented by this plan. |
| WebGPU works only through SwiftShader | Record software correctness/relative changes; do not report hardware GPU performance. |
| Reference video unavailable | Use the YouTube reference or the owner's supplied object; do not publish credentials or a rehosted copy. |
| No listening-capable reviewer available | Keep the output `rendered`/`signal-checked`; do not mark it `selected`. |

## Ongoing checkpoint procedure

Update roadmap status, snapshot, exact source/asset versions and evidence after each accepted change.
Keep a short next-action entry here or in the README. Push source before ending a task.
Retain recipes and manifests when CI artifacts expire. Refresh the recovery issue after branch deletion or migration.
Create an optional independent copy with `git bundle create <path> <branch>` and keep that bundle outside the execution workspace.
Never include tokens, signed URLs, environment dumps or reference-video media in a public recovery bundle.
