# Record 09-4: the fifth plan of the force passage, on a container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: WebGPU on SwiftShader, which runs on the container's CPU. The times say what
> the harness measures. They do not stand for a GPU's time per block. The levels are facts about the
> render. Whether the render fits the picture is for the owner's ear. The owner received this render
> with the picture on 2026-11-10, and the review is pending.

This is the fourth recorded run of experiment 9 (`docs/experiments.md`, section 9). It follows
`docs/records/09-force-passage-container-3.md`, which holds the fourth plan, and it changes the plan
only: the engine is the engine of record 09-2.

## What the owner said of the fourth plan

On 2026-11-10, in English: the stones are still in the air, and time is slow too, but the sound says
that the stones have fallen already.

## The measured cause

The picture, read frame by frame: the blocks come out of the wall from 146.48 s to 146.56 s. From
146.6 s to the cut at 147.77 s they hang and turn in the air, in slow motion. The next shot is fog. No
block lands in the picture.

The fourth plan held, in that time: four `crack` events of blocks of 0.6 to 0.9 m that knock (146.66,
146.86, 147.12 and 147.44 s), and a `rubble` of small stone at 75 impacts a second that thins out, from
the break to 0.7 s past the cut. Its two landings stood 10 m away at intensities 0.79 and 0.50.

Measured on the two mixes from 146.8 s to 147.75 s, in the band from 300 Hz to 3 kHz (a probe in the
session's scratch; observed results of 2026-11-10):

| Plan   | Rises of 6 dB in 10 ms | Level of the band |
| ------ | ---------------------: | ----------------: |
| Fourth |                      3 |        -25.7 dBFS |
| Fifth  |                      0 |        -29.1 dBFS |

## The run

| Item         | Value                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 9, the force passage of a study, as a plan on the engine                                                                                                                                                                     |
| Command 1    | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu`                                                                                                                         |
| Command 2    | `bun experiments/09-force-passage/measure.ts --tier webgpu`                                                                                                                                                                  |
| Date         | 2026-11-10 10:48 UTC                                                                                                                                                                                                         |
| Commit       | `bd8e250aabe7c995ed6f3b2d8d3a803376e4918b` of `typeshade/typeaudio` (branch `claude/force-passage-engine`, pull request #68), clean tree (the JSON says `dirty` false)                                                       |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                              |
| Tools        | Bun 1.4.4, Node v22.23.4, Google Chrome for Testing 153.0.8010.12                                                                                                                                                            |
| Machine      | Intel Xeon at 2.10 GHz, 4 cores, Linux 6.18.44                                                                                                                                                                               |
| Raw data     | `docs/records/09-force-passage-container-4.json` (command 1) and `docs/records/09-force-passage-container-4-measure.json` (command 2)                                                                                        |
| Outputs      | The mix, the reverb's return and each layer's stem as 32-bit float WAV in `experiments/09-force-passage/out/`, which Git ignores. The mix has the SHA-256 `f705d27f9a5827e34c87eeac0f6fe38b72087c14f06a352da4f500dfcbddaa62` |

The device is WebGPU, from the report of `createDevice`: vendor `google`, architecture `swiftshader`,
`fallback` true. All 47 groups of the last block's fuse plan ran on `webgpu`.

**Not run:** the CPU tier and `across.ts`. No file of `src/` changed after commit `586941b`, and record
09-2 holds the two tiers to each other on that commit.

## What changed in the plan

`experiments/09-force-passage/plan.json` holds 41 events and two silences: 13 `crack`, 7 `rubble`,
4 `impact`, 4 `wind`, 4 `whoosh`, 3 `boom`, 3 `roar`, 2 `cloth`, 1 `drone`. The fourth plan held 42. The
plan is the fourth plan to the break. From the break on:

| Picture (seconds) | The picture                                   | The fourth plan                                        | The fifth plan                                                                                                                            |
| ----------------- | --------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 146.480 to 146.78 | The wall gives; blocks come out at full speed | Stone that tears, to 0.45 s after the break            | Stone that tears, shorter: its last impact comes within 0.3 s of the break                                                                |
| 146.6 to 147.77   | The blocks hang and turn in the air, slow     | Small stone that falls, 75 a second; four blocks knock | Nothing strikes. The mass of the break goes on as a low rumble with no tone (`boom` at 90 Hz, 0.9 s). Two slow whooshes. The dust is air  |
| 147.77 to 148.5   | Fog                                           | The small stone thins out; two landings 10 m away      | The blocks land, 7 and 8 m away, at 147.90 and 148.24 s: each an `impact` and its stone (`crack`) on one frame. Small stone settles after |
| 148.5 to 149.7    | She is in the wall, still                     | A little stone runs down, one tick                     | The same                                                                                                                                  |

Against the owner's three times: the sound of the break goes on under the hang and ends by itself (the
past). While the blocks hang, the level falls for 1.2 s; that fall is the hint that they will land (the
future). The landing leads in the fog, where the picture shows no thing that leads (the present).

## The time of a block and the master

| Tier   | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Host time (s) | Reverb prepare (ms) |
| ------ | -----: | ----------: | -------: | -------: | ---------: | ------------: | --------: | ------------: | ------------------: |
| WebGPU |    736 |       33.44 |    40.33 |    58.49 |       1202 |           735 |    0.598x |          27.8 |                 172 |

| Item                                  | The fourth plan | This run   |
| ------------------------------------- | --------------- | ---------- |
| The target                            | -13 LUFS        | -13 LUFS   |
| The loudness of the mix before        | -26.0 LUFS      | -26.4 LUFS |
| The gain to the target                | +13.0 dB        | +13.4 dB   |
| The deepest gain of the limiter       | -5.8 dB         | -6.2 dB    |
| The integrated loudness of the result | -15.3 LUFS      | -15.1 LUFS |
| The true peak of the result           | -1.1 dBTP       | -1.1 dBTP  |

## The render against the fourth plan

Command 2. Levels in dBFS.

| Phase (picture seconds)          | The fourth plan | This run | This run: 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |
| -------------------------------- | --------------: | -------: | ------------------: | ---------: | --------: | -------: | --------: |
| Stare (143.0 to 144.9)           |           -27.1 |    -26.8 |               -31.3 |      -36.7 |     -40.5 |    -53.6 |     -59.5 |
| Flight (145.27 to 145.85)        |           -12.6 |    -12.5 |               -17.7 |      -19.8 |     -19.1 |    -23.4 |     -32.6 |
| Wall hit (145.937 to 146.10)     |           -10.7 |    -10.6 |               -12.9 |      -17.1 |     -24.4 |    -30.6 |     -38.4 |
| Cracks spread (146.10 to 146.46) |           -13.7 |    -13.4 |               -16.0 |      -22.6 |     -25.8 |    -31.2 |     -38.5 |
| Breakout (146.48 to 146.70)      |           -11.7 |    -11.2 |               -15.4 |      -15.6 |     -22.2 |    -26.0 |     -31.3 |
| Fall (146.70 to 147.75)          |           -17.8 |    -19.5 |               -23.1 |      -25.5 |     -30.5 |    -38.1 |     -45.0 |
| Fog (147.77 to 148.45)           |           -19.0 |    -17.3 |               -19.7 |      -24.4 |     -31.1 |    -39.4 |     -45.4 |

Observed:

- While the blocks hang, the mix falls without a step up. Its level each 0.1 s from 146.5 s: -10.6,
  -13.3, -15.3, -17.9, -19.3, -20.8, -21.6, -22.5, -24.1, -24.5, -26.4, -28.0, -27.8, -28.0 dBFS. It then
  rises by 14.1 dB on the first landing: -13.9 dBFS at 147.9 s.
- In the fall the bands over 500 Hz lie 3.5 to 4.9 dB under the fourth plan's. In the fog the band from
  120 to 500 Hz lies 6.7 dB over the fourth plan's: the stone of the landings.
- The hit and the break stay apart. Over 0.3 s from each onset, as shares of the energy of the mono sum
  (the probe of record 09-3): the hit has 84 % under 120 Hz and a centroid of 167 Hz, the break 55 %
  and 329 Hz. In the fourth plan the break had 45 % and 372 Hz: the rumble that goes on under the hang
  starts on the frame of the break.
- The strike, the blast, the hit and the break are placed 0.00 ms from their picture times. The silence
  from 145.04 to 145.18 s holds no sample that is not 0.

## Deviations and open items

The deviations of records 09-2 and 09-3 stand, with one change: the landings are no longer 10 m away
and low. They lead in the fog, 7 and 8 m away.

- The owner's listening review of the fifth plan, with the picture. Next action: the owner.
- The frame of silence before the hit on the wall: the owner has not said whether it reads as a hint or
  as a break in the sound. Next action: the owner.
- The device runs, WebGL2, and the red and the finale passage: as in record 09-2.
