# Validation and performance policy

This policy includes the owner's 2026-11-06 correction about SwiftShader.
It applies to new claims and to the interpretation of historical receipts. Do not rewrite old measured numbers.

## Evidence classes

| Evidence | Can support | Cannot support |
| --- | --- | --- |
| TypeShade checker and generated-target validation | Language/type/lowering checks within the tested scope | Acoustic correctness, GPU speed or a live deadline. |
| CPU reference, impulse and deterministic unit tests | Numerical behavior, state transitions and defined tolerances | Human spatial perception or hardware output latency. |
| SwiftShader WebGPU | Software-backend functionality and approximate controlled relative changes | Hardware GPU performance or CPU-versus-GPU product speed. |
| Bun/Node host CPU benchmark | Component compute time on the named CPU/runtime | Real AudioWorklet scheduling, complete-game deadlines or GPU performance. |
| OfflineAudioContext with actual AudioWorklet | Module loading and offline PCM behavior | Physical-device deadlines or audible underrun-free playback. |
| Hardware-backed WebGPU run | Named adapter's measured workload, including stated transfer costs | Unmeasured devices, complete games or listener preference. |
| Foreground live browser/device workload | Observed deadlines/event latency under declared conditions | Browser/OS hard real-time guarantees under arbitrary conditions. |
| Physical input/output capture | Measured end-to-end latency and output defects for that setup | All headphone routes, Bluetooth devices or listening quality. |
| Structured listening review | Recorded perception and creative judgments under that setup | Universal HRTF fit or unobserved objective properties. |

The room Bun benchmark is CPU DSP timing. It is not a SwiftShader GPU benchmark.
Chromium software-GPU flags do not turn a CPU AudioWorklet comparison into a hardware GPU test.
Browser API availability alone is insufficient evidence of a hardware adapter.

## Required measurement metadata

Record repository and source SHA, base SHA, compiler pin, package versions, source/asset hashes and dirty state.
Record UTC date, OS, browser/runtime, CPU, GPU adapter/backend identity, power mode and device class where available.
Record sample rate, block frames, active voices/paths, IR/filter sizes, event load, duration and warmup.
Record what is included: source generation, geometry, dispatch, queue wait, transfers, rendering and device output.
Use an explicit `unknown` for unavailable fields. Do not invent hardware identity from a renderer label.

Keep cold compilation/setup separate from steady processing. Include source activation, voice reuse and reset in burst scenarios.
Record p50, p95, p99, p99.9 where sample count supports it, maximum and counts over budget.
Do not describe zero observed overruns as a proof of a hard deadline.
Use paired/repeated conditions for approximate improvement claims. State timer resolution and relevant environmental variation.

## Numerical and acoustic checks

- Analytical primitive hits, rectangular image paths, listener transforms and coordinate conversions.
- Delay arrival, fractional-delay behavior, gain/filter continuity and stable path identity.
- Finite samples, overload telemetry, alias/bounds rejection and atomic invalid-update rejection.
- State continuity across arbitrary block partitions, clear/reset, slot reuse and virtual voices.
- Energy accounting for absorption/transmission/scattering; stable late decay and no unintended duplicate routing.
- HRTF asset onset/ITD, orientation, interpolation, rate conversion and direct-convolution reference.
- Ambisonic channel order, normalization, rotation and output decoding.
- GPU/CPU absolute/relative errors with meaningful frequency/time-domain metrics; no blanket bit-identity expectation across hardware tiers.

## Real-time acceptance

Define each supported profile by hardware, browser, foreground/audio state, output route and workload limits.
Measure the complete source → spatial → HRTF/reverb → master chain with representative graphics load.
Stress event bursts, scene replacement, GPU loss, delayed GPU results, imports/compilation outside playback and long-running thermal behavior.
Measure source-event age, queue occupancy/overflow, stale-result age, quality changes and render scheduling observations separately.
Use physical output capture where browser telemetry cannot establish audible dropout or end-to-end latency.

The 128-frame interval at 48 kHz is 2.667 ms. It is not the latency of a game input reaching a speaker.
The proposed 1 ms engine budget is a design target, not a delivered claim.
Background suspension, OS preemption and output-device buffering remain platform boundaries.
Bluetooth and wired routes require separate measurements.

## Recorded room evidence

Source code `09947da`, reviewed head `86560f8`, compiler pin `87af4eb0`.
The [CI receipt](../records/room-acoustics-ci.json) records 82 tests and exact offline worklet PCM parity.
CI's AMD EPYC 7763 run measured moving 32-source room p99 about 0.542 ms, with 0/2000 observed overruns.
The [local optimized run](../records/room-prepared-address-cpu.json) measured 2/2000 moving and 3/2000 static 32-source overruns.
The [initial local run](../records/room-initial-cpu.json) is retained for the approximate before/after comparison.
These are room-component CPU measurements. They exclude full synthesis/HRTF cost and physical output.
No physical-device real-time profile is approved by these records.

## Human review

Keep `rendered`, `signal-checked`, `listening-reviewed` and `selected` distinct.
Match levels for A/B comparisons and record the procedure, passage, output route and reviewer.
Test front/back/elevation ambiguity, motion, masking, fatigue, mono compatibility and narrative focus.
The Frieren study and generated room WAVs have no recorded human listening approval.
