# Audio quality feedback loop

Owner approval: 2026-11-07. Build actual audio evaluation, bounded source revision,
and repeatable candidate comparison for one Frieren column impact.

## Baseline and scope

- Engine base: `d04aa0635501c495e95aa89926c764b6724b7a04`, function-engine PR #30.
- Published Web: `94bb1cf9f0176aa1fafa24eac3e88fba04a25972`; publication record merged in Web #48.
- Published engine: `5489ac494e69b5eb2dfae63546cc7643ecfea0f0`.
- Compiler remains `87af4eb0d9d15f02b66b8341b72cab0944290472`.
- First event: column contact at picture time 145.937 seconds, a three-second source study.

The owner rejected the six published passage studies' sound quality. Technical
verification did not establish material quality or listening acceptance. Preserve
those source revisions as rejected creative baselines, not approved examples.

Implement a host-side evaluation workflow. Keep it outside the audio callback.
Use actual rendered PCM as evaluator input. Keep model observations distinct from
measured signal facts and from human listening acceptance. Never promote signal
checks or text-only inference into a perceptual pass.

## Delivery contract

1. Describe the brief, bounded controls, reference provenance and acceptance criteria.
2. Render distinct procedural candidates through the existing TypeShade function engine.
3. Reject invalid, clipped or silent output before remote evaluation.
4. Prepare level-matched comparisons and hash every submitted audio file.
5. Calibrate the configured evaluator with known controls and blinded order swaps.
6. Ask it for timecoded observations, comparison preference and bounded control revisions.
7. Validate every response before changing a candidate. Preserve the previous best.
8. Re-render and compare within explicit call and iteration budgets.
9. Export source-only function documents accepted by the existing Web editor.
10. Record source, engine/compiler, audio hashes, model identity, calibration and every decision.

Calibration controls can establish basic audio discrimination and order stability.
They cannot establish professional aesthetic judgment. A separate reviewed preference
corpus is required before describing model-selected candidates as quality approved.
Unavailable credentials, malformed responses and failed calibration leave the run
blocked or inconclusive. They do not select a winner.

## Current dependency

The execution environment exposes Cloudflare and GitHub credentials only. No audio
evaluation API or local audio model is connected. A provider question is pending.
Build the adapter, source candidates and verification while awaiting that connection.
Do not claim a live evaluator run, autonomous improvement or listening approval until observed.

No engine merge, compiler pin move, replacement website or production deployment is
part of this implementation checkpoint. Use the existing Web project's import flow.
Update this record and recovery issue #26 with concrete checks and remaining work.
