# Room acoustics: early reflections and a diffuse stereo tail

Status: implementation in progress. The owner authorized this engine step on 2026-11-06.
Baseline: spatial PR #23, commit `7d33eb8c243e0bc6c066de348c6034c4ef42645a`.
Compiler pin remains `87af4eb0d9d15f02b66b8341b72cab0944290472`.

## Scope

Add a rectangular room model to the existing stereo spatial bus. Prepare six first-order
image-source reflection paths on the control thread. Each path carries its excess travel
time, arrival direction, distance gain and material damping. Delays are relative to the
existing undelayed direct path. There is no added delay on the direct source onset.

Render reflection paths using bounded per-source delay buffers. Crossfade changed delay taps
without allocating buffers or calling asynchronous work in the audio callback. Feed a shared
four-line feedback delay network for a diffuse stereo tail. Bound feedback below unity.
Use room dimensions and wall reflection coefficients to estimate decay; allow an explicit
artistic decay override. This is an approximation, not a measured acoustic simulation.

Validate exact impulse arrival, direction, material damping, deterministic block partitioning,
state reset, invalid-input recovery, moving-path transitions and decay stability. Verify host
and AudioWorklet output, record processing cost, and export dry/small-room/hall listening WAVs.

## Boundaries

The model is an axis-aligned rectangular room with interior sources and listener. It excludes
higher-order geometric paths, mesh ray tracing, diffraction, HRTF, Doppler and head tracking.
The late tail is an algorithmic approximation. Its audible decay varies with frequency.
Changing the room definition requires a new processor; source and listener poses can update
through prepared source targets. No device deadline or perceptual quality guarantee is made.
The CPU spatial renderer's shader/tier parity remains open as recorded in PR #23.
