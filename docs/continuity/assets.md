# Recovery asset inventory

The plan and source recipes are stored in Git. Generated WAVs and CI artifact URLs are not the only recovery path.
No credentials, supplied reference video or extracted picture/audio are included in the source archive.

## Durable authored source

[authored-source.tar.gz](archive/authored-source.tar.gz) contains 69 hashed source/metadata files.
The [external manifest](archive/authored-source.manifest.json) records every path, byte count and SHA-256.
The archive also holds an embedded manifest. The restoration tool verifies both before writing any recovered file.

| Archive content | Purpose | State |
| --- | --- | --- |
| `frieren-sound-design/source/` | v1 synthesis, session, mix and export recipes | Historical comparison, superseded creative direction. |
| `frieren-sound-design-v2/source/` | 51 events, 179 layers, 14 deterministic TypeShade families and rendering/mix scripts | Review study; no human listening approval. |
| Study READMEs, cue sheets, manifests and signal receipts | Timing, seeds, authored range, generation context and known limitations | Historical data; do not treat render status as selection. |
| `web/typeaudio-sound-design-workflow.original.md` | Previously untracked production workflow | Original preserved; current owner-aligned plan is [production-workflow.md](production-workflow.md). |
| `legacy-spatial/` | Interrupted local spatial source, package diff and base commit | Archival only; remote PR #23 is the newer implementation. |
| `environment.json` | Capture-time Python, NumPy, SciPy and FFmpeg versions | Reproduction context, not a dependency installer. |

The archive preserves original source bytes, including obsolete absolute workspace paths.
`scripts/recovery/restore-study.py` adapts copies to the chosen checkout and leaves the archive unchanged.
It refuses an existing destination and verifies file hashes before extraction.
V1 requires the Web source checkout for its old imports. V2 event rendering requires the engine and Bun.

## Regenerable media

| Output | Recipe | Limit |
| --- | --- | --- |
| Spatial demo WAV | `bun run demo:spatial` | Stereo foundation, not HRTF. |
| Dry/small-room/hall WAVs | `bun run demo:room` | Numerically checked room examples, no listening approval. |
| V2 dry cues | Restored `source/render.ts` | Use all cues for a full mix; smoke mode renders one event only. |
| V2 master and 11 stems | Restored `source/mix.py` | Offline Python host processing; not current editor parity. |
| Mobile AAC candidate | Restored `source/mobile.py` | Prior measured loudness is not a new creative approval. |
| Previous/revised listening pairs | Restored `source/review.py` plus v1 master | Both revision renders must exist. |
| Compact review package | Restored `source/package.py` | Draft template data; no upload or deployment. |

The original local v2 range is 0–188 seconds. The uploader end card is excluded.
The original full mix, stems and review ZIP remain local until explicitly published through the existing application's storage workflow.
This recovery change preserves their sources; it does not publish those media files as a new template.
Byte-identical compressed audio is not promised across FFmpeg builds. Compare recorded signals and tolerances with tool versions identified.

## External reference

The newer [audible sound-design study](../studies/frieren/sound-design/README.md) is stored directly in Git, outside the historical archive.
Its recipes live in `scripts/frieren/` and `docs/studies/frieren/sound-design/`.
It contains 47 layers, 13 programs and three A/B passages. Render source is `87295117341448ddf56e0352903f0baf6051ce85`.
Its six masters, six AAC files and 34 stems are regenerable. Listening review remains pending.
Publication receipts, when present, identify versioned authored R2 objects. Signed links are intentionally excluded from Git.
The original 69-file recovery archive remains unchanged.

Public reference: https://www.youtube.com/watch?v=YHCqcyX9N3s.
[reference-metadata.json](archive/reference-metadata.json) records the supplied local reference hash and the owner's object locator.
The locator was provided as `typesound/videos/YTDown.com_YouTube_Media_YHCqcyX9N3s_Frieren-and-Fern-vs-Frieren-s-Clone-Part-2-Frieren-Beyond-Journey-s-End-Ep-26-En_005_480p.mp4`.
R2 availability was not rechecked in this recovery task. Reacquire access through the owner's existing account if analysis requires the video.
Do not persist signed download URLs or credentials. Public playback uses the YouTube reference.
The offset against the live YouTube player is still unverified.

## Future assets

No HRTF dataset is selected or bundled. Select a redistributable dataset and version its coordinate/rate/delay conversion in R3a.
No baked acoustic probes or FDTD results exist for this program.
No R2 publication or production template ID is claimed for the v2 study.
Preserve future manifests with source hashes, deterministic seeds, renderer/compiler revisions, licenses and review status.

## Durability boundary

Git and the remote recovery PR preserve the plan and authored source independently of the chat and execution workspace.
The GitHub recovery index provides discovery when the PR is no longer visible in the recent list.
An optional portable Git bundle can serve as another copy; keep it outside the workspace for an independent backup.
GitHub and the external reference account remain external dependencies unless their data is separately mirrored.
