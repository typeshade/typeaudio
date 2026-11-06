# Spatial audio: listener-relative stereo foundation

Status: implemented on the review branch; CI verification in progress. The owner authorized engine work on 2026-11-06.
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

## Public API

`typeaudio/spatial` exports `prepareSpatialSource`, `SpatialMixer` and their input types.
It has no compiler, browser, Web Audio or GPU imports. Positions use metres.
The supported spatial sample rate is 8–192 kHz; a target and its mixer must use the same rate.
Existing GraphDsp sources currently run at 48 kHz. The spatial bus does not resample them.

```ts
import { prepareSpatialSource, SpatialMixer } from 'typeaudio/spatial';

// Control thread: prepare after a source or listener pose changes.
const target = prepareSpatialSource(
  { position: { x: 0, y: 0, z: 0 } },
  { position: { x: -2, y: 0, z: -1 }, gain: 0.5 },
  48000,
);

// Audio thread: construct once, outside process().
const spatial = new SpatialMixer({ capacity: 1, sampleRate: 48000 });
spatial.setSource(0, target);
const mono = new Float32Array(128);
const left = new Float32Array(128);
const right = new Float32Array(128);
const sources = [mono];

// Each block: fill mono from a prepared GraphDsp or another mono source.
// graph.process(mono);
spatial.process(sources, left, right);
```

Send only prepared numeric targets across the thread boundary. The receiving thread calls
`setSource`; the main thread must not mutate the audio thread's mixer. Preallocate and reuse
the input list and channel buffers. Process calls replace the requested output range.
Shorter and overlapping buffers are rejected before state or output changes.
Input buffers may be shared between voices, but must not overlap the output channels.

A source slot owns its filter and gain history. Null or absent inputs feed silence.
`removeSource` ramps gains down; keep feeding its input until that fade has finished.
`clearSource` discards a slot's history immediately before reuse. `reset` preserves targets
and clears all DSP history and counters.

The default 10 ms value is a one-pole smoothing time constant, not a scheduled onset delay.
A new voice ramps from silence. After one time constant it reaches about 63% of its target.
Use a smaller smoothing constant for sharp transients, or establish the source pose before
its onset by processing silent blocks. Large pose changes interpolate channel gains;
constant-power panning describes settled targets, not the intermediate crossfade.

## Models and telemetry

Distance gain is `reference / (reference + rolloff * max(0, distance - reference))`.
Coincident sources are centred and never receive distance amplification.
Authored occlusion scales level from 1 to 0.25 and lowers the lowpass cutoff.
Air absorption uses a one-pole lowpass whose cutoff falls with distance.
These are controllable approximations, not a measured acoustic material model.

Only the listener's right axis contributes to stereo pan. Front/back and height remain
ambiguous. Source spread narrows the pan displacement; it is not a multi-emitter width model.
There is no propagation delay, room energy or output normalization.

The mixer exposes `invalidSamples`, `invalidOutputSamples`, `overloadFrames` and `peak`.
Invalid input samples become zero. Non-finite output channel samples become zero.
Finite overloads remain unclipped, so the host can meter and control its master bus.

## Verification and listening artifact

- `bun run check`: shader/host-view checks and both TypeScript projects.
- `bun run test`: geometry, spectral response, smoothing, arbitrary block partitioning,
  source isolation, bad-data recovery, buffer aliasing and compiled GraphDsp integration.
- `bun run test:spatial-worklet`: actual Chromium OfflineAudioContext/AudioWorklet loading,
  a mid-render target change and host/worklet stereo PCM parity.
- `bun run bench:spatial`: 1, 8, 32 and 64 sources, 128 frames at 48 kHz. Reports p50/p95/p99,
  maximum processing time and blocks exceeding the nominal block duration.
- `bun run demo:spatial`: a six-second stereo WAV and cue JSON. Three impacts identify left,
  centre and right. A moving tone then approaches the centre and passes to the right.

CI uploads the WAV, cue description and benchmark receipt as `spatial-runtime`.
The WAV demonstrates routing and level movement. It is not an approved cinematic sound design.
CPU timings exclude source synthesis, geometry preparation and physical-device scheduling.
The offline worklet check does not establish live-device deadline guarantees or perceived spatial quality.
