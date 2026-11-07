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

The owner selected a local audio LLM experiment on 2026-11-07. The required evaluator
accepts actual audio, explains audible issues and proposes source revisions. A semantic
similarity scorer does not satisfy this request. Use a pinned Qwen2.5-Omni Thinker
in a separate CPU environment and verify actual audio inference before claiming support.
The actual-audio API adapter remains available but no remote provider is configured.
Do not claim a live instruction-model evaluator run or listening approval until observed.

No engine merge, compiler pin move, replacement website or production deployment is
part of this implementation checkpoint. Use the existing Web project's import flow.
Update this record and recovery issue #26 with concrete checks and remaining work.

## Implementation checkpoint

[Engine PR #31](https://github.com/typeshade/typeaudio/pull/31) contains the protocol,
actual-audio OpenAI/local-Qwen adapters, calibration, A/B level matching, order checks,
bounded revision controller and append-only evidence. Initial implementation commit:
`8a18523`. [The operator guide](../audio-quality-loop.md) records commands and limits.

[Web PR #49](https://github.com/typeshade/web/pull/49), implementation `3c388ba`, exports
an evaluated source into the existing project format. It preserves duration, controls,
room and YouTube reference. Source volume 0.7 with compensating master gain matches
the engine's unity source profile within one PCM16 unit in the observed browser check.
Desktop and 390px touch-emulation import, playback, room edit, save, reopen and reload
passed. These are browser checks, not physical-phone or picture-sync verification.

The first Qwen structured request exceeded its ten-minute budget. A shorter actual-audio
probe returned in approximately 9–10 seconds per request. It described an audible
candidate as an electronic beep but falsely called the reversed audible/silent pair silent.
A subsequent structured request returned a prose refusal instead of the required JSON.
The workflow retained the original candidate and did not declare a quality pass.
These are observed model limitations under this prompt/input configuration, not proof
that audio LLMs cannot evaluate sound. Preserve the raw replies in the verification receipt.

The automatic revision path currently changes declared controls. General TypeShade
module/algorithm rewriting and a reliable professional listening critic remain open.
The next step is to validate a suitable audio-LLM/input protocol against the control
corpus before allowing autonomous source promotion. Do not treat these prototypes as
replacement public sound-design examples.

[The verification receipt](audio-quality-verification.json) preserves actual LLM replies,
input hashes, source manifests, 133 passing engine tests, 110 Web tests and browser results.
[The local environment record](audio-llm-environment.json) pins installed Python packages
and model identity. Timings vary with concurrent development work; they are observations,
not an inference SLA or an engine real-time measurement.
