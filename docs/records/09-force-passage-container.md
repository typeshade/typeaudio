# Record 09: the force passage of the study as a plan on the engine, on a container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: WebGPU on SwiftShader, which runs on the container's CPU. The times say what
> the harness measures. They do not stand for a GPU's time per block. The levels are facts about the
> render. Whether the render sounds as the study's render does is for the owner's ear: nobody has
> listened to it at the time of this record.

This is the first run of experiment 9 (`docs/experiments.md`, section 9). The owner said on 2026-11-10
to move the force passage of the study to the engine first. The study is
`docs/studies/frieren-perceptual/` on pull request #67, at commit `07670c9`; its round 11 is the
render that this run is held to.

## The run

| Item         | Value                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 9, the force passage of a study, as a plan on the engine                                                                                                                                                                                                                                                                                                              |
| Command 1    | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu`                                                                                                                                                                                                                                                                  |
| Command 2    | `bun experiments/09-force-passage/measure.ts --tier webgpu`                                                                                                                                                                                                                                                                                                           |
| Commands 3   | `bun experiments/09-force-passage/run.ts --tier cpu --blocks 470 --out <a>`, `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu --blocks 470 --out <b>`, `bun experiments/09-force-passage/across.ts <b> <a>`                                                                                                        |
| Date         | Command 1: 2026-11-10 07:33 UTC. Commands 3: WebGPU at 07:34 UTC, the CPU tier from 07:33 to 07:45 UTC on 2026-11-10                                                                                                                                                                                                                                                  |
| Commit       | `77125bd1947cbbf1796150ff52574302f1e0f2ba` of `typeshade/typeaudio` (branch `claude/force-passage-engine`, pull request #68), clean tree (the JSON says `dirty` false)                                                                                                                                                                                                |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                                                                                                                                                       |
| Tools        | Bun 1.4.4, Node v22.23.4, Google Chrome for Testing 153.0.8010.12                                                                                                                                                                                                                                                                                                     |
| Machine      | Intel Xeon at 2.10 GHz, 4 cores, Linux 6.18.44                                                                                                                                                                                                                                                                                                                        |
| Raw data     | `docs/records/09-force-passage-container.json` (command 1: the options, the block timing, the fuse groups, the device, the master, where each event was placed) and `docs/records/09-force-passage-container-measure.json` (command 2); `docs/records/09-force-passage-container-cpu.json` and `docs/records/09-force-passage-container-webgpu-470.json` (commands 3) |
| Outputs      | The mix, the reverb's return and each layer's stem as 32-bit float WAV in `experiments/09-force-passage/out/`, which Git ignores                                                                                                                                                                                                                                      |

## The device

WebGPU, from the report of `createDevice`: vendor `google`, architecture `swiftshader`, `fallback` true.
All 46 groups of the last block's fuse plan ran on `webgpu`.

## The plan

`experiments/09-force-passage/plan.json` holds 59 events over 15.7 seconds. Clip time is picture time
minus 136.5 s.

| Kind     | Events | What they are in the passage                                                                                                                                                                                      |
| -------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crack`  |     21 | The strike, the blast's front, the hit on the wall and its thud, the first of the breakout, three late cracks at the hole, seven landings, small stone far away and near                                          |
| `rubble` |     13 | The run of cracks that grows (two), loose stone, the volley of the breakout, the blocks that fall (three), the grit, the cascade of landings, the heap that settles (two), the trickle, the residue of the shield |
| `boom`   |      9 | The body of the blast, of the wall, of the breakout and of four landings; two thumps far away                                                                                                                     |
| `roar`   |      7 | The blast in the hall, left and right; the dust at both sides; the jet of dust; the low roll of the wall and of the heap                                                                                          |
| `wind`   |      3 | The air of the hall before and after the silence; the dust                                                                                                                                                        |
| `whoosh` |      3 | The ring, her rush through the air, the whip of the camera                                                                                                                                                        |
| `cloth`  |      2 | Cloth under the spoken lines                                                                                                                                                                                      |
| `drone`  |      1 | The dark tone under the stare                                                                                                                                                                                     |

The plan has one silence: from 8.52 s for 0.166708 s. It ends on the frame of the strike. The room is
stone, 18 by 24 by 14 metres. The master is -10 LUFS and -2 dBTP. Each macro of a `crack`, a `boom`
or a `rubble` comes from a size, a rate or a decay of the study's round 11, through the maps of
`src/kinds/make.ts`. The intensities and the distances were set in four renders on 2026-11-10, each
held to the study's levels with `measure.ts`.

## The time of a block

| Tier   | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Host time (s) | Reverb prepare (ms) |
| ------ | -----: | ----------: | -------: | -------: | ---------: | ------------: | --------: | ------------: | ------------------: |
| WebGPU |    736 |       36.76 |    45.32 |    62.15 |       1243 |           735 |    0.541x |          30.4 |                 179 |

The plan has 59 lanes in eight banks. Experiment 8's fixture has 25 lanes; record 08-4 gives 18.79 ms at
the median for its first 40 blocks on the same container. The time per block of this plan is 1.7 times
the budget. That is a fact of SwiftShader on this CPU, and it decides nothing about a GPU.

## The master

| Item                                  | Value      |
| ------------------------------------- | ---------- |
| The loudness of the mix before        | -16.1 LUFS |
| The gain to the target                | +6.1 dB    |
| The deepest gain of the limiter       | -9.3 dB    |
| The integrated loudness of the result | -12.6 LUFS |
| The true peak of the result           | -2.1 dBTP  |

The master scales the mix to the target and then limits it. The limiter takes 9.3 dB off the highest
peaks, so the result lies 2.6 LU under the target of -10 LUFS. The study's master does the other thing:
it drives the mix into a limiter and a soft clip and then raises the result to the ceiling, which gave
-8.8 LUFS at the same true peak.

## The render against the study's render

Command 2. Levels in dBFS: the engine's mix on WebGPU, and round 11 of the study.

| Phase (picture seconds)          | Render | Level | 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |
| -------------------------------- | ------ | ----: | --------: | ---------: | --------: | -------: | --------: |
| Stare (143.0 to 144.9)           | engine | -30.8 |     -35.6 |      -40.6 |     -41.9 |    -54.9 |     -60.8 |
|                                  | study  | -28.6 |     -29.8 |      -37.3 |     -48.2 |    -55.8 |     -59.4 |
| Flight (145.27 to 145.85)        | engine | -12.1 |     -16.0 |      -20.6 |     -19.1 |    -23.7 |     -34.5 |
|                                  | study  |  -8.3 |     -11.7 |      -15.2 |     -18.0 |    -24.7 |     -38.5 |
| Wall hit (145.937 to 146.10)     | engine | -12.4 |     -15.9 |      -18.4 |     -21.8 |    -26.6 |     -37.2 |
|                                  | study  |  -7.8 |     -11.6 |      -12.5 |     -20.8 |    -32.8 |     -43.4 |
| Cracks spread (146.10 to 146.46) | engine | -13.3 |     -15.8 |      -19.4 |     -26.6 |    -33.2 |     -42.2 |
|                                  | study  |  -8.3 |     -13.4 |      -13.1 |     -19.5 |    -27.2 |     -37.2 |
| Breakout (146.48 to 146.70)      | engine | -10.1 |     -12.0 |      -16.0 |     -26.6 |    -34.1 |     -40.4 |
|                                  | study  |  -7.9 |     -11.8 |      -12.9 |     -21.2 |    -29.9 |     -39.2 |
| Fall (146.70 to 147.75)          | engine | -11.2 |     -13.4 |      -17.4 |     -27.4 |    -36.1 |     -42.0 |
|                                  | study  |  -9.6 |     -14.4 |      -14.4 |     -22.6 |    -32.3 |     -43.1 |
| Fog (147.77 to 148.45)           | engine | -12.8 |     -15.3 |      -18.1 |     -28.7 |    -36.3 |     -43.8 |
|                                  | study  |  -9.9 |     -14.4 |      -14.2 |     -24.7 |    -34.5 |     -44.7 |

| Measure                                              | Engine                                                 | Study                                          |
| ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| The level each two frames while she flies (dBFS)     | -10.7, -11.6, -12.0, -12.5, -13.4, -12.3, -13.0, -13.4 | -7.2, -7.9, -8.2, -8.2, -8.8, -9.1, -9.0, -9.1 |
| The silence, 145.04 to 145.18 s                      | under -117 dBFS (every sample is 0)                    | -119.2 dBFS                                    |
| The strike, the blast, the hit, the breakout, placed | 0.00 ms from their picture times                       | 0.06, 0.00, 0.17 and 0.02 ms (first sound)     |
| Integrated loudness                                  | -12.6 LUFS                                             | -8.8 LUFS                                      |

Observed:

- The mix is 3.8 LU quieter than the study's as a whole. Each phase lies 1.6 to 5.0 dB under the study's
  level. Against that mean of 3.8 dB, the phases stand within 2.2 dB of the study's shape: the stare +1.6,
  the flight 0.0, the wall hit -0.8, the cracks -1.2, the breakout +1.6, the fall +2.2, the fog +0.9.
- The level while she flies falls by 2.7 dB over its eight steps. The study's falls by 1.9 dB.
- From 120 to 500 Hz the engine lies 3.0 to 6.3 dB under the study in every phase. This band holds the
  thud of a body and the lower part of a block's knock.
- From 500 Hz to 2 kHz, where the cracks of stone lie, the engine is 4.0 to 7.1 dB under the study from the
  cracks to the fog, and within 1.1 dB of it in the flight and at the hit.
- From 2 to 6 kHz the engine is 6.2 dB over the study at the wall hit, and 1.8 to 6.0 dB under it from the
  cracks to the fog.
- The dark tone under the stare is a `drone`: saws through a lowpass. It has 6.3 dB more from 500 Hz to
  2 kHz than the study's breath of narrow noise, and 5.8 dB less under 120 Hz.

`measure.ts` filters with biquads and the study filters in the frequency domain. For the same sound a band
level differs by up to 1 dB between the two.

## WebGPU against the CPU tier

Commands 3: the first 470 blocks (10.03 s, to the breakout) on both tiers.

| Tier     | Blocks | Median (ms) | p95 (ms) | Real time | Host time (s) | Loudness before (LUFS) | Deepest gain of the limiter (dB) |
| -------- | -----: | ----------: | -------: | --------: | ------------: | ---------------------: | -------------------------------: |
| CPU tier |    470 |    1,409.98 | 1,691.12 |   0.0149x |         687.2 |               -15.1638 |                           -3.984 |
| WebGPU   |    470 |       40.33 |    50.99 |    0.489x |          21.5 |               -15.1639 |                           -3.983 |

`across.ts`: of the 962,560 values of the two mixes (481,280 frames, two channels), 946,524 differ. The
largest difference is 2.11e-4 of a peak of 0.785, and the relative RMS of the difference is 4.26e-4. The two
tiers render the same sound to within the device's own `sin` and `exp`, as experiment 8's records found for
the nine kinds.

The CPU render ran from 07:33 to 07:45 UTC. Its JSON names commit `8912a81`, the head when the run ended;
its bundle was built at `77125bd`. The two commits between them change no file of `src/` and not `plan.json`.

## What the port does not do

Each is a difference between the study's render and this one. All are open.

1. The engine places an event at one point. The study moves her rush and the cloth along a path, and it
   moves the blocks down the wall.
2. The engine sets the reverb send of an event from its distance. The study sets it for each layer, and it
   sends little of the collapse to the hall so that the hits stay apart.
3. The study's master is a drive, a limiter and a soft clip. The engine's is a loudness target and a
   limiter. The result is 3.8 LU quieter, and the limiter goes 9.3 dB deep on its own.
4. No kind is the strain of masonry under load (the study's `grind` and `groan`), the Friedlander front of
   a blast, or a puff of dust with a fast rise and a slow fall. The plan uses a `roar` or a `wind` for dust
   and leaves the strain out.
5. The dark tone under the stare is the `drone` of experiment 8. Its fade is 1.5 s; the study's tone grows
   for 2.5 s.
6. The study's cracks are a modal fracture with a noise knock. The engine's `crack` is five bands of noise
   under envelopes. A band's decay is fixed, so a large block is long because it is low, not by its own
   decay.
7. The level of a `rubble` follows its `density`. The peak of one take of the four kinds differs from the
   median of the kind.
8. The message of commit `77125bd` says 26.9 s of block time for its render. The number is wrong: at 0.547
   times real time that render took 28.7 s. The run of this record took 29.0 s of block time, the first block
   included, and 30.4 s of host time.

## Open items

- The owner's listening review of the engine's render, with the picture. Next action: the owner.
- The device runs: one record a device, `docs/records/09-force-passage-<device>.md`. Next action: the owner,
  after the review.
- WebGL2 was not run.
- The red and the finale passage of the study are not moved.
