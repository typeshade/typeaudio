# Room acoustics: early reflections and a diffuse stereo tail

Status: implemented on the review branch in PR #24. The owner authorized this engine step on 2026-11-06.
Baseline: spatial PR #23, commit `7d33eb8c243e0bc6c066de348c6034c4ef42645a`.
Compiler pin remains `87af4eb0d9d15f02b66b8341b72cab0944290472`.

## Scope

`typeaudio/spatial/room` adds a rectangular room model to the existing stereo spatial bus.
Six first-order image-source paths carry excess travel time, arrival direction, distance gain and material damping.
The control thread prepares these paths. The direct path keeps its immediate onset.

Each source uses one bounded history buffer for all reflection taps and its late send.
A shared four-line feedback delay network produces a diffuse stereo tail.
The processor is synchronous. Its valid `process()` path allocates no buffers and performs no asynchronous work.

## Public API

```ts
import { prepareRoom, prepareRoomSource, RoomMixer } from 'typeaudio/spatial/room';

// Control thread: create one immutable room and prepare changing source/listener poses.
const room = prepareRoom({
  min: { x: -3, y: -1.5, z: -4 },
  max: { x: 3, y: 1.5, z: 4 },
  walls: {
    yMin: { reflection: 0.8, damping: 0.2 },
    zMin: { reflection: 0.3, damping: 0.8 },
  },
  earlyGain: 0.7,
  lateGain: 0.25,
}, 48000);
const target = prepareRoomSource(room,
  { position: { x: 0, y: 0, z: 0 } },
  { position: { x: -1, y: 0, z: -1 }, gain: 0.4 },
);

// Audio thread: construct once, before processing starts.
// Transfer the room and targets as structured data, without browser or compiler objects.
const mixer = new RoomMixer(room, { capacity: 8, maxFrames: 128 });
mixer.setSource(0, target);
const mono = new Float32Array(128);
const left = new Float32Array(128);
const right = new Float32Array(128);
const inputs = [mono];

// Each block: fill mono with an existing GraphDsp or another mono source.
// graph.process(mono);
mixer.process(inputs, left, right);
```

Use metres and the [spatial coordinate convention](spatial-audio.md).
Sources and listeners must stay strictly inside the room bounds. Each dimension is 0.1–200 metres.
World coordinates are limited to ±100,000 metres. Room walls are `xMin`, `xMax`, `yMin`, `yMax`, `zMin`, `zMax`.
`roomWalls` exports their wire order. The prepared room key detects stale or mismatched control messages.
The receiver validates all used path coefficients before changing any source target.

| Setting | Range | Default |
| --- | --- | --- |
| Sample rate | 8–192 kHz | 48 kHz |
| Wall pressure reflection | 0–0.98 | 0.6 |
| Wall high-frequency damping | 0–1 | 0.35 |
| Early / late gain | 0–1 | 0.7 / 0.2 |
| Decay override | 0.05–8 seconds | Estimated from room absorption |
| Source capacity | 1–64 | 8 |
| Maximum block frames | 1–4096 | 128 |
| Gain/filter smoothing time constant | 1–1000 ms | 10 ms |
| Delay crossfade duration | 1–100 ms | 10 ms |

Existing GraphDsp sources run at 48 kHz. This bus does not resample them.
Prepare geometry on the control thread after a pose changes. Apply copied targets on the audio thread with `setSource`.
The host owns message scheduling; this API has no sample-accurate event queue.
Preallocate the input list and channel buffers. Output channels and input ranges must not overlap.
Processing replaces the requested output range. Invalid buffers fail before DSP state changes.

## Early path model

Each wall mirrors the source. The listener-to-image distance determines gain and arrival direction.
Excess delay is `(imageDistance - directDistance) / 343` seconds.
It is relative to the immediate direct path, not an absolute propagation delay.
Linear interpolation splits a fractional impulse across its two adjacent samples.
The earliest nonzero sample is the floor of its fractional delay.

Path level uses inverse-distance attenuation, authored occlusion, wall reflection and `earlyGain`.
Air absorption and material damping select the stronger of two one-pole lowpass coefficients.
Material cutoff is `min(20000, 0.45 * sampleRate) * 0.025^damping`. Zero damping bypasses this material filter.
Occlusion applies to every path; the model does not infer a clear reflected route around an obstacle.

The first source target applies immediately. Later gains and filters use sample-by-sample smoothing.
Delay changes crossfade two fixed reads. An active crossfade finishes before applying the newest queued delay.
Intermediate delay updates coalesce. This avoids discontinuous read jumps; it does not model Doppler.
Fractional addresses are prepared on target updates, rather than recomputed for every sample.

## Late tail model

Each source sends a mono signal delayed by the mean excess delay of its six reflections.
Send gain uses the direct path level and mean wall reflection. The FDN adds its own delay before emitting audio.
The tail uses four unequal delay lines and an orthogonal Hadamard feedback matrix.
Each line has lowpass damping and feedback `10^(-3 * delaySeconds / decaySeconds)`, strictly below unity.
Room volume scales line lengths. Two output combinations produce stereo decorrelation.

The default decay estimate is `0.161 * volume / sum(wallArea * (1 - reflection^2))`.
The result is bounded to 0.05–8 seconds. `decaySeconds` supplies an artistic override.
Wall reflection denotes pressure, so its squared value determines energy absorption.
This Sabine estimate and the FDN are approximations. Broadband measured decay can differ from the configured value.
All-absorbing walls produce no reflected or late energy. `earlyGain` and `lateGain` independently control the two returns.

## State, memory and telemetry

Null or absent inputs feed zero while reflections and the shared tail drain.
`removeSource` fades direct, early and future late sends. Keep supplying input during the fade.
`clearSource` discards one source's filter and delay history. Energy already in the shared tail continues.
`reset` clears all histories and counters while preserving prepared targets.
These operations have distinct meanings; slot reuse does not erase another source's room energy.

Maximum excess delay is bounded by twice the longest room dimension divided by 343 m/s.
Each source allocates `4 * (ceil(maximumDelay * sampleRate) + 2)` bytes for its Float32 history.
The shared tail adds four delay buffers. `delayBufferBytes` reports their total, excluding small control objects and caller buffers.
At 48 kHz, a 12 × 6 × 16 metre room with 32 slots uses 624,424 delay-buffer bytes.
Construction, first activation, clear and reset can touch the full source history. Prepare the room before live playback.

`invalidSamples` counts non-finite input samples per configured source, once per source.
`invalidOutputSamples` counts recovered non-finite direct or final channel samples.
`invalidTailSamples` counts non-finite send samples or Float32 feedback writes recovered inside the FDN.
Invalid samples become zero. `overloadFrames` and `peak` describe the final finite output.
Finite overloads remain unclipped. The host must reserve headroom and manage its master bus.

## Verification and listening exports

- `bun run check`: compiler host views, shader checks and both TypeScript projects.
- `bun run test`: room geometry, impulse arrivals, damping, moving taps, block partitioning, state isolation, validation and decay stability.
- `bun run test:room-worklet`: actual Chromium AudioWorklet output against host PCM, including queued movement and a draining tail.
- `bun run bench:room`: direct path, six reflections per source and one shared tail at 1, 8 and 32 sources.
- `bun run demo:room`: dry, small-room and hall WAVs from the same compiled procedural GraphDsp sources.

The listening files use identical source levels without per-file normalization or limiting.
Each file contains left/right impacts, a short centre tone and five seconds for the room to decay.
CI uploads the WAVs, room/cue data, worklet result and benchmark as `room-runtime`.
Generated audio has numerical checks, but no listening approval.

Timing records include all observed deadline overruns. A faster median does not establish a hard real-time guarantee.
The benchmark excludes synthesis, geometry preparation, physical-device scheduling, initial activation and measured output underruns.
It measures 2,000 blocks after warmup. The nominal 128-frame budget at 48 kHz is 2.667 ms.

Recorded checks: [2026-11-06 receipt](records/room-acoustics-ci.json).
The receipt identifies source commit `09947da` and the CI merge checkout `0be9fd4`.
CI passed 82 tests, including 19 room tests. Chromium matched 65,536 host PCM frames exactly.

| 32-source timing, 128 frames | Median ms | p99 ms | Maximum ms | Over-budget blocks |
| --- | ---: | ---: | ---: | ---: |
| Local, initial moving taps | 0.439 | 1.335 | 5.389 | 2 / 2000 |
| Local, prepared moving taps | 0.378 | 0.798 | 3.001 | 2 / 2000 |
| Local, prepared static taps | 0.361 | 0.707 | 5.717 | 3 / 2000 |
| CI, prepared moving taps | 0.483 | 0.542 | 0.662 | 0 / 2000 |

Local runs used an AMD EPYC 9V74. CI used an AMD EPYC 7763. Both used Bun 1.4.4.
The local [initial](records/room-initial-cpu.json) and [prepared-address](records/room-prepared-address-cpu.json) measurements retain every scenario.
These runs show lower median processing cost after address preparation. Occasional local overruns remain unresolved.
Do not infer a hardware deadline guarantee from the CI run's zero overruns.

## Boundaries

The model is an axis-aligned rectangular room with interior sources and listener. It excludes
higher-order geometric paths, mesh ray tracing, diffraction, HRTF, Doppler and head tracking.
The late tail is an algorithmic approximation. Its audible decay varies with frequency.
Changing the room definition requires a new processor; source and listener poses can update
through prepared source targets. No device deadline or perceptual quality guarantee is made.
The CPU spatial renderer's shader/tier parity remains open as recorded in PR #23.
The room tail follows the listener as a diffuse stereo field. It has no directional late-field representation.
Four delay lines can produce coloration. Higher diffusion, binaural rendering and device listening trials remain separate work.
This change does not integrate the Web editor or move any compiler pin.
