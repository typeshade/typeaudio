# Frieren picture and sound-design study

The recommended direction preserves distinct magical materials, a surprise attack, sustained final scale and a complete recovery at the end.
This analysis corrects the previous cue plan and defines concrete procedural-sound review passages.

Status: visual and mixed-signal analysis completed on 2026-11-06. Auditory review and candidate selection are not performed.
The package contains 41 editorial design units, 15 timing/visibility anchors, 514 distinct inspected frames and mixed-track measurements.
The frames were inspected in 44 contact sheets, with selected contacts also checked at source resolution.
This is sampled-frame analysis with selected adjacent-frame checks; every decoded frame was not individually reviewed.

## Read the study

| Document | Purpose |
| --- | --- |
| [Analysis](analysis.md) | Dramatic structure, visual causality, spatial reading and original mixed-track measurements. |
| [Findings and corrections](findings.md) | Verified changes to the previous timing and event interpretation. |
| [Procedural sound-design brief](sound-design-brief.md) | Material families, event behaviour, spatial routing, review passages and engine/editor requirements. |
| [Spotting JSON](spotting.json) / [CSV](spotting.csv) | Source regions, observations, proposals, priorities and supporting frames. |
| [Evidence inventory](evidence.json) | Reference identity, frame PTS/hashes, sampling plans, review scope and source-file limitations. |
| [Reproduction procedure](reproduce.md) | Commands, dependencies, outputs and verification scope for a fresh workspace. |
| [Verification receipt](verification.json) | Helper source identity, complete-scene decode and document/data audit results. |
| [Mix measurements](mix-measurements.json) / [segment summaries](segment-measurements.json) | Numerical receipts for the original composite soundtrack. |

## Important corrections

- Red formation begins at 3.878875 seconds, seven frames before the old event.
- Violet sparks begin at 44.044 seconds, six frames before the old charge event.
- The force response and column contact are distinct, separated by 18 frames or 0.75075 seconds.
- The clone's grounded emergence around 132 seconds and dissolution around 184 seconds need explicit treatment.
- The closing shot fades beyond 188 seconds. The proposed study endpoint is 189.314625 seconds.
- Existing major release anchors remain correct. Timing alone does not validate their synthesized material or mix.

## Reference and scope

Reference: https://www.youtube.com/watch?v=YHCqcyX9N3s.
The supplied file has SHA-256 `6f1856eb09d5522f05dfbb5e813df208e99b94fe391c346139e62bb5b0fba87c` and 19,896,114 bytes.
Its header declares 5,095 frames at 24000/1001 fps, 854 × 480 pixels, and stereo AAC at 44,100 Hz.
Its container duration is 212.578685 seconds. FFmpeg decodes 5,088 frames and reports a partial file near the uploader outro's end.
The only observed timestamp gap follows 212.128583 seconds, outside the study range.

All timings use source presentation timestamps. The live YouTube offset remains unverified.
The proposed endpoint preserves the closing fade before the unrelated uploader imagery.
It is an editorial endpoint, not a claimed exact hard cut between programs.
The previous v2 render remains a historical 0–188 second study; this analysis does not silently retime it.

The original soundtrack contains dialogue, music and effects together.
Its measured −4.23 LUFS and +3.54 dBTP describe this downloaded composite, not a master-level target or quality score.
There was no source separation or auditory review. Sound treatments are proposals for subsequent listening evaluation.

The reference video, extracted frames and decoded audio remain local.
Git preserves authored analysis, numerical measurements and reproduction scripts, following [the production workflow](../../continuity/production-workflow.md).
No new soundtrack, website deployment, R2 upload or engine performance claim is part of this task.

The implementation base is continuity checkpoint `838fcd0e21e82e7fbb8d1d38d78a05dffbaba194`.
The extraction and measurement scripts are preserved at checkpoint `316a08f`; later commits add the completed analysis package.
The engine roadmap still starts with R1. This picture study supplies requirements and review passages for later production.
