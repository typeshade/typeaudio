# Record 09-3: the fourth plan of the force passage, on a container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: WebGPU on SwiftShader, which runs on the container's CPU. The times say what
> the harness measures. They do not stand for a GPU's time per block. The levels are facts about the
> render. Whether the render fits the picture is for the owner's ear. The owner received this render
> with the picture on 2026-11-10, and the review is pending.

This is the third recorded run of experiment 9 (`docs/experiments.md`, section 9). It follows
`docs/records/09-force-passage-container-2.md`, which holds the third plan, and it changes the plan
only: the engine is the engine of that record.

## What the owner said of the third plan

On 2026-11-10, in English:

- It holds together far better. But the hit on the wall and the break of the wall must be told apart.
- The past: the sound that led changes over by itself. Unless the picture goes to another scene, the
  sound goes on, and it ends by itself.
- The present: the future can be designed too, so the sound gives a hint of what comes. A sound of
  the past may still lead, while the viewer still attends to it. When the sound that leads changes,
  the sound of the past becomes the room: what the viewer attends to has changed.

## The measured cause

In the third plan the hit and the break were each an `impact` with a `crack`. Measured on the mix of
record 09-2, over 0.3 s from each onset (a probe in the session's scratch; observed results of
2026-11-10):

| Moment    | Plan   | Under 120 Hz | 120 to 500 Hz | 500 Hz to 6 kHz | Centroid | Fall of 10 dB |
| --------- | ------ | -----------: | ------------: | --------------: | -------: | ------------: |
| The hit   | third  |         86 % |           8 % |             5 % |   231 Hz |        0.04 s |
| The break | third  |         82 % |          13 % |             5 % |   221 Hz |        0.46 s |
| The hit   | fourth |         84 % |          10 % |             5 % |   167 Hz |        0.32 s |
| The break | fourth |         45 % |          42 % |            13 % |   372 Hz |        0.50 s |

The shares are of the energy of the mono sum. The fall is the time the level of 20 ms takes to stand
10 dB under its peak. In the third plan the two had one spectrum. In the fourth the break has half the
share under 120 Hz, more than twice the share from 500 Hz to 6 kHz, and a centroid 2.2 times as high.

## The run

| Item         | Value                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 9, the force passage of a study, as a plan on the engine                                                                                                                                                                     |
| Command 1    | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu`                                                                                                                         |
| Command 2    | `bun experiments/09-force-passage/measure.ts --tier webgpu`                                                                                                                                                                  |
| Date         | 2026-11-10 09:21 UTC                                                                                                                                                                                                         |
| Commit       | `fd8937faf341c8cd67708385a0300d2b7253b0bd` of `typeshade/typeaudio` (branch `claude/force-passage-engine`, pull request #68), clean tree (the JSON says `dirty` false)                                                       |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                              |
| Tools        | Bun 1.4.4, Node v22.23.4, Google Chrome for Testing 153.0.8010.12                                                                                                                                                            |
| Machine      | Intel Xeon at 2.10 GHz, 4 cores, Linux 6.18.44                                                                                                                                                                               |
| Raw data     | `docs/records/09-force-passage-container-3.json` (command 1) and `docs/records/09-force-passage-container-3-measure.json` (command 2)                                                                                        |
| Outputs      | The mix, the reverb's return and each layer's stem as 32-bit float WAV in `experiments/09-force-passage/out/`, which Git ignores. The mix has the SHA-256 `0068d9ff21ca82df1d22141edfc4d261e44756bd618a7a7b786bf45fccc1b6bc` |

The device is WebGPU, from the report of `createDevice`: vendor `google`, architecture `swiftshader`,
`fallback` true. All 48 groups of the last block's fuse plan ran on `webgpu`.

**Not run:** the CPU tier and `across.ts`. No file of `src/` changed after commit `586941b`, and record
09-2 holds the two tiers to each other on that commit.

## The plan against the owner's three times

`experiments/09-force-passage/plan.json` holds 42 events and two silences: 15 `crack`, 8 `rubble`,
4 `impact`, 4 `wind`, 3 `roar`, 3 `boom`, 2 `cloth`, 2 `whoosh`, 1 `drone`. The third plan held 37.
The table of record 09-2 ("one sound leads in each moment") stands, with these rows changed.

| The sound that leads                | The hint before it (the future)                                    | What it is                                                                                                                  | How it goes on and ends (the past)                                                                               |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The blast, 145.270 s                | The silence of 0.167 s                                             | An `impact` with its air (two `roar`)                                                                                       | The air goes on for 0.6 s under the rush, to 25 ms before the frame of silence                                   |
| The hit on the wall, 145.937 s      | The blast that falls by 12.6 dB, the rush, one frame of silence    | A body on stone: an `impact` with little click (its macro `crack` is 0.1) and a dull thud (`crack` of 0.3 m), at one point  | Its sub falls under the crack that runs; the hall holds its tail                                                 |
| The crack that runs, from 145.997 s | It starts 60 ms after the hit, at a tenth of its rate, and grows   | Small stone that splits (`rubble` of 0.08 m, `swell` 1) and three cracks, each larger: 0.3, 0.45 and 0.65 m                 | It ends on the frame of the break, where the wall that crumbles starts: one line of small stone                  |
| The break, 146.480 s                | The crack that runs: it is the hint, and the largest crack is last | Stone that tears: no `impact`. Two cracks of 1.3 and 1.2 m, shards, grit and loose blocks over 50 ms and five places across | It becomes the wall that crumbles (`rubble` of 0.09 m, 75 a second, thinning), which leads while the blocks turn |
| Nothing, from the fog at 147.773 s  | The crumble thins while the blocks leave the picture               | Two landings far away, far stone                                                                                            | The crumble goes on 0.7 s past the cut and ends by itself; a little stone that runs down starts before it ends   |

The two silences stand as in the third plan. The frame of silence before the hit cuts the tail of the
blast for 0.0417 s; the reverb's return comes back after it. That is a cut inside one scene, so it is a
deviation from "the sound goes on", made for the hint. It is open: the owner has not said whether it
reads as a hint or as a break in the sound.

## The time of a block and the master

| Tier   | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Host time (s) | Reverb prepare (ms) |
| ------ | -----: | ----------: | -------: | -------: | ---------: | ------------: | --------: | ------------: | ------------------: |
| WebGPU |    736 |       34.07 |    41.39 |    48.93 |       1407 |           735 |    0.585x |          28.3 |                 174 |

| Item                                  | The third plan | This run   |
| ------------------------------------- | -------------- | ---------- |
| The target                            | -13 LUFS       | -13 LUFS   |
| The loudness of the mix before        | -26.2 LUFS     | -26.0 LUFS |
| The gain to the target                | +13.2 dB       | +13.0 dB   |
| The deepest gain of the limiter       | -6.6 dB        | -5.8 dB    |
| The integrated loudness of the result | -14.9 LUFS     | -15.3 LUFS |
| The true peak of the result           | -1.1 dBTP      | -1.1 dBTP  |

## The render against the third plan

Command 2. Levels in dBFS.

| Phase (picture seconds)          | The third plan | This run | This run: 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |
| -------------------------------- | -------------: | -------: | ------------------: | ---------: | --------: | -------: | --------: |
| Stare (143.0 to 144.9)           |          -26.9 |    -27.1 |               -31.6 |      -37.1 |     -40.9 |    -53.9 |     -59.9 |
| Flight (145.27 to 145.85)        |          -12.9 |    -12.6 |               -17.8 |      -19.9 |     -19.2 |    -23.5 |     -32.7 |
| Wall hit (145.937 to 146.10)     |          -10.2 |    -10.7 |               -13.0 |      -17.2 |     -24.5 |    -30.7 |     -38.5 |
| Cracks spread (146.10 to 146.46) |          -11.9 |    -13.7 |               -16.3 |      -23.0 |     -26.1 |    -31.6 |     -38.8 |
| Breakout (146.48 to 146.70)      |          -10.5 |    -11.7 |               -16.6 |      -15.7 |     -21.8 |    -25.9 |     -31.3 |
| Fall (146.70 to 147.75)          |          -16.1 |    -17.8 |               -21.7 |      -23.8 |     -27.0 |    -33.2 |     -40.3 |
| Fog (147.77 to 148.45)           |          -18.3 |    -19.0 |               -20.6 |      -31.1 |     -31.6 |    -38.5 |     -44.9 |

Observed:

- The hit is still the loudest phase, 1.0 dB over the break and 1.9 dB over the flight.
- Against the hit, the break has 3.6 dB less from 30 to 120 Hz and more in every band over it: 1.5, 2.7,
  4.8 and 7.2 dB. In the third plan the same differences were +0.3 dB, then -1.9, -1.5, -2.3 and -2.3 dB.
- The level each two frames from the blast to the hit: -10.7, -10.7, -10.8, -12.7, -14.1, -17.2, -18.1,
  -23.3 dBFS. The blast falls by 12.6 dB before the hit.
- The strike, the blast, the hit and the break are placed 0.00 ms from their picture times. The silence
  from 145.04 to 145.18 s holds no sample that is not 0.

## Deviations and open items

The deviations of record 09-2 stand. This run adds one: the frame of silence inside one scene, above.

- The owner's listening review of the fourth plan, with the picture. Next action: the owner.
- Whether the owner's rule of the three times goes into `docs/sound-design-loop.md` as a part of the
  design. It is a change to the design, so it needs the owner's go-ahead. Next action: the owner.
- The device runs, WebGL2, and the red and the finale passage: as in record 09-2.
