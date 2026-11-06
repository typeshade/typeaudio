# Spatial audio: listener-relative stereo foundation

Status: implementation in progress. The owner authorized engine work on 2026-11-06.
Baseline: `93d9a7c6086fe7f8b80a97aef3aa2198e077cae2`, stacked on graph feedback PR #22.
Compiler pin: `87af4eb0d9d15f02b66b8341b72cab0944290472` (unchanged).

## Scope

Add `typeaudio/spatial` as a compiler-free, synchronous spatial bus for mono sources.
A listener has position, forward and up vectors. A source has position, gain, spread,
distance rolloff, air absorption and optional authored occlusion.
Use metres in a right-handed coordinate system: +X right, +Y up, default forward -Z.

Prepare source coefficients outside the audio callback. Mix with fixed-capacity state,
caller-owned buffers and sample-by-sample smoothing. Compose existing GraphDsp output
with this bus without importing the graph compiler into an AudioWorklet.

Validate geometry, listener orientation, buffer ownership and coefficient ranges.
Test listener rotation, distance attenuation, spectral changes, movement continuity,
block partitioning, independent source state and invalid input recovery.
Verify actual AudioWorklet loading and deterministic stereo output in headless Chromium.
Record CPU timing separately from device deadlines and listening quality.

## Boundaries

This stage renders equal-power stereo pan. It does not resolve front/back or elevation
as binaural cues. Distance affects level and high-frequency content, not propagation time.
Occlusion is an authored scalar, not a raycast result. There is no room reflection model,
HRTF, Doppler, head tracking, voice stealing or output limiter in this stage.

The spatial bus is audio-domain CPU host DSP, with no GPU dispatch in the callback.
TypeShade still compiles procedural source graphs. Spatial shader/tier parity remains
open; this incremental host implementation does not establish the vision's full tier parity.
It does not modify compiler semantics or proposal 0122.

## Next stages

1. Add first-order room reflections with bounded delay storage and listener-relative paths.
2. Add a binaural renderer and a versioned HRTF asset contract.
3. Add scene scheduling, perceptual voice budgets and reference listening passages.
4. Connect the existing web editor, template data and agent review loop.
