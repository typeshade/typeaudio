# Record 09-2: the third plan of the force passage, on a container

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: WebGPU on SwiftShader, which runs on the container's CPU. The times say what
> the harness measures. They do not stand for a GPU's time per block. The levels are facts about the
> render. Whether the render fits the picture is for the owner's ear. The owner received this render
> with the picture on 2026-11-10, and the review is pending.

This is the second recorded run of experiment 9 (`docs/experiments.md`, section 9). The first is
`docs/records/09-force-passage-container.md`. Between the two the owner listened twice, on 2026-11-10,
and the plan was written three times.

## What the owner heard

| Render                                         | The owner's words, in English                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The first plan (record 09, commit `77125bd`)   | A clatter. She hits the wall so hard that the wall breaks, and the hit feels as if somebody threw the things of a house.                                                                    |
| The second plan (not recorded, not committed)  | A roll of dull thumps. It does not fit the picture; it feels foreign. Take down what must go down, take out what must go out, and show what is to be shown.                                 |
| The rule the owner gave with the second review | First, who leads the sound in the picture. Then what explains it: the room and the rest. Then how the sound says that a larger hit comes: a silence belongs here. These must come together. |

## The measured causes

For the first plan, measured on the mix of record 09 (the commands are in the session's scratch, not
in the repository; the numbers are observed results of 2026-11-10):

- The limiter took 4.0 dB at the hit and up to 7.9 dB through the collapse, 9.3 dB at the most. The
  hit stood 1.8 dB over the 80 ms before it. The hit could not be larger than the flight.
- A `rubble` made new impacts for one second after its `duration` (fixed in commit `d57d576`). The
  volley of the breakout is 0.19 s long, and its blocks struck on.
- From the breakout to the landings the plan held three `rubble` of blocks of 0.87 m at 13.5 impacts
  a second each, and grit at 56 a second. The picture has the blocks in the air.

For the second plan (its mix has the SHA-256 `2e056d01341abe604ba6901c3926c8c9ee9c7c62dcd5790274c5e19ac8d553cb`):

- It scaled the fall of the five bands of `Stones` by the size of the block, up to 3 times, and held
  large blocks at a high density under the hit, the fall and the landings. Stone does not ring: a low
  band of noise with a long fall is a drum. That change is not in the repository.
- It set three landings that weigh at 147.84, 148.05 and 148.34 s. The picture from 147.80 s is fog,
  and from 148.6 s she is still, in the wall. No block lands in the picture.
- It took the top out to make the stone heavy: from 2 to 8 kHz the fall stood at -41 dBFS. A crack of
  stone lies there.

## The run

| Item         | Value                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Experiment   | 9, the force passage of a study, as a plan on the engine                                                                                                                                                                                                                 |
| Command 1    | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu`                                                                                                                                                                     |
| Command 2    | `bun experiments/09-force-passage/measure.ts --tier webgpu`                                                                                                                                                                                                              |
| Commands 3   | `bun experiments/09-force-passage/run.ts --tier cpu --blocks 470 --out <a>`, `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu --blocks 470 --out <b>`, `bun experiments/09-force-passage/across.ts <b> <a>`           |
| Date         | Command 1: 2026-11-10 09:05 UTC. Commands 3: see "WebGPU against the CPU tier"                                                                                                                                                                                           |
| Commit       | `586941b9118cad5dc5ec288a4622d663209c770f` of `typeshade/typeaudio` (branch `claude/force-passage-engine`, pull request #68), clean tree (the JSON says `dirty` false)                                                                                                   |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                                                          |
| Tools        | Bun 1.4.4, Node v22.23.4, Google Chrome for Testing 153.0.8010.12                                                                                                                                                                                                        |
| Machine      | Intel Xeon at 2.10 GHz, 4 cores, Linux 6.18.44                                                                                                                                                                                                                           |
| Raw data     | `docs/records/09-force-passage-container-2.json` (command 1) and `docs/records/09-force-passage-container-2-measure.json` (command 2); `docs/records/09-force-passage-container-2-cpu.json` and `docs/records/09-force-passage-container-2-webgpu-470.json` (commands 3) |
| Outputs      | The mix, the reverb's return and each layer's stem as 32-bit float WAV in `experiments/09-force-passage/out/`, which Git ignores. The mix has the SHA-256 `32298a2f5183dff74a6e815b0325506885ec528e857bfab76422c6470509bdc9`                                             |

The device is WebGPU, from the report of `createDevice`: vendor `google`, architecture `swiftshader`,
`fallback` true. All 49 groups of the last block's fuse plan ran on `webgpu`.

## The plan: one sound leads in each moment

`experiments/09-force-passage/plan.json` holds 37 events and two silences over 15.7 seconds. The
first plan held 59 events and one silence. Clip time is picture time minus 136.5 s. The picture was
read frame by frame from 144.95 s to 151.7 s.

| Picture (seconds)   | The picture                                              | The sound that leads                                        | What explains it                                       | Out, against the first plan                                    |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| 142.5 to 145.02     | Her eyes, close                                          | A low tone (`drone`)                                        | The air of the hall                                    |                                                                |
| 145.02 to 145.187   | Her eyes, still                                          | The silence: it says that something comes                   | Nothing                                                |                                                                |
| 145.187, two frames | Her hair snaps up                                        | The strike, dry and near (`crack` of 0.12 m)                | Nothing                                                |                                                                |
| 145.270 to 145.78   | The whole hall: the ring grows, dust rises, she is small | The blast (`impact`); it falls while she flies away         | Its air (two `roar`), the ring (`whoosh`)              | The front and the body of the blast, two dust surges, her rush |
| 145.81 to 145.937   | The camera whips to the wall                             | A rush that arrives (`whoosh`), then one frame of silence   | Nothing                                                | The whip that ended on the hit                                 |
| 145.937             | She hits the wall; dust bursts                           | The hit (`impact`, intensity 1): the largest event          | One crack of stone (`crack` of 1 m), the dust (`roar`) | The thud, the body, the jet of dust                            |
| 146.10 to 146.47    | A crack runs up the wall                                 | Small stone that splits, more and more (`rubble` of 0.08 m) | Two cracks that stand out                              | Two runs of blocks of 0.77 m, loose stone                      |
| 146.480             | The wall gives; blocks come out                          | The break (`impact`), lower and wider than the hit          | A crack that crumbles (`crack` of 1.6 m)               | The volley, the body                                           |
| 146.56 to 147.73    | The blocks turn in the air, in dust                      | The wall crumbles (`rubble` of 0.09 m, dense, thinning)     | Four blocks that knock                                 | Three falls of blocks, the grit, three cracks, the roll        |
| 147.77 to 148.5     | Fog                                                      | Nothing leads                                               | Two landings far away (`impact` at 10 m), far stone    | Seven landings at the camera, four bodies, two heaps, a roll   |
| 148.5 to 149.7      | She is in the wall, still                                | Nothing leads                                               | A little stone that runs down, one tick                | Three ticks                                                    |

How the sound says that a larger hit comes:

1. The silence before the strike is whole, 0.167 s long (as in the first plan).
2. The blast falls while she flies: the level each two frames goes from -10.6 to -23.7 dBFS.
3. One frame of silence, 0.0417 s, stands before the hit on the wall. The rush ends where it starts.
4. The hit is a hero impact (`docs/sound-design-loop.md`, "The guards"): the guard takes 6 dB from
   the other layers before it.

The wall stands 3 m from the camera, as the shot has it. The master is -13 LUFS and -1 dBTP.

## What changed in the engine

- `Stones.tick` makes no impact after its length (commit `d57d576`): a `rubble` ends with its
  `duration`, and its bands ring out. The reference in `test/reference-kinds.ts` follows, and two tests
  hold it.
- Nothing else. The third plan uses the `impact` of experiment 8 for the three hits that lead. The
  first plan had none.

## The time of a block

| Tier   | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Host time (s) | Reverb prepare (ms) |
| ------ | -----: | ----------: | -------: | -------: | ---------: | ------------: | --------: | ------------: | ------------------: |
| WebGPU |    736 |       34.15 |    40.73 |    55.40 |       1350 |           735 |    0.589x |          28.1 |                 171 |

The plan has 37 lanes in nine banks; the first plan had 59 lanes in eight banks and a median of 36.76 ms.
The time per block is 1.6 times the budget. That is a fact of SwiftShader on this CPU, and it decides
nothing about a GPU.

## The master

| Item                                  | The first run | This run   |
| ------------------------------------- | ------------- | ---------- |
| The target                            | -10 LUFS      | -13 LUFS   |
| The loudness of the mix before        | -16.1 LUFS    | -26.2 LUFS |
| The gain to the target                | +6.1 dB       | +13.2 dB   |
| The deepest gain of the limiter       | -9.3 dB       | -6.6 dB    |
| The integrated loudness of the result | -12.6 LUFS    | -14.9 LUFS |
| The true peak of the result           | -2.1 dBTP     | -1.1 dBTP  |

The target is lower so that the limiter leaves the hits their front. At -11 LUFS the limiter took 8.6 dB
and brought the blast and the hit to one level; at -13 LUFS it takes 6.6 dB at the most. The result is
2.3 LU quieter than the first run's.

## The render against the first run and the study's render

Command 2. Levels in dBFS. The study is round 11 of `docs/studies/frieren-perceptual/` (pull request #67
at `07670c9`). The third plan does not aim at the study's levels: the study holds one level from the
flight to the fog, and the owner's rule asks for a shape.

| Phase (picture seconds)          | The first run | This run | The study | This run: 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |
| -------------------------------- | ------------: | -------: | --------: | ------------------: | ---------: | --------: | -------: | --------: |
| Stare (143.0 to 144.9)           |         -30.8 |    -26.9 |     -28.6 |               -31.5 |      -36.9 |     -40.7 |    -53.8 |     -59.7 |
| Flight (145.27 to 145.85)        |         -12.1 |    -12.9 |      -8.3 |               -17.9 |      -20.2 |     -19.6 |    -23.9 |     -33.0 |
| Wall hit (145.937 to 146.10)     |         -12.4 |    -10.2 |      -7.8 |               -12.6 |      -17.1 |     -24.6 |    -26.8 |     -31.0 |
| Cracks spread (146.10 to 146.46) |         -13.3 |    -11.9 |      -8.3 |               -13.5 |      -22.6 |     -25.9 |    -30.3 |     -37.0 |
| Breakout (146.48 to 146.70)      |         -10.1 |    -10.5 |      -7.9 |               -12.3 |      -19.0 |     -26.1 |    -29.1 |     -33.3 |
| Fall (146.70 to 147.75)          |         -11.2 |    -16.1 |      -9.6 |               -18.6 |      -25.1 |     -25.0 |    -31.1 |     -38.2 |
| Fog (147.77 to 148.45)           |         -12.8 |    -18.3 |      -9.9 |               -20.4 |      -29.0 |     -29.3 |    -38.6 |     -46.4 |

| Measure                                           | The first run                                          | This run                                               |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| The level each two frames while she flies (dBFS)  | -10.7, -11.6, -12.0, -12.5, -13.4, -12.3, -13.0, -13.4 | -10.6, -10.6, -10.8, -12.7, -16.6, -19.9, -18.4, -23.7 |
| The silence, 145.04 to 145.18 s                   | under -117 dBFS (every sample is 0)                    | under -117 dBFS (every sample is 0)                    |
| The strike, the blast, the hit, the break, placed | 0.00 ms from their picture times                       | 0.00 ms from their picture times                       |
| Integrated loudness                               | -12.6 LUFS                                             | -14.9 LUFS                                             |

Observed:

- The hit on the wall is the loudest phase, 2.7 dB over the flight. In the first run the flight was 0.3 dB
  over the hit.
- The hit starts from silence. In the first run it stood 1.8 dB over the 80 ms before it.
- The level falls from the break on: -10.5, -16.1 and -18.3 dBFS for the breakout, the fall and the fog.
  In the first run it held: -10.1, -11.2 and -12.8 dBFS.
- From 120 to 500 Hz this run lies 1.3 dB over the first run at the hit and 3.0 to 10.9 dB under it from
  the cracks to the fog. The body of the hits is the sub of an `impact`, under 120 Hz.
- From 6 to 14 kHz the hit stands 6.2 dB over the first run's: the click of the `impact`.

`measure.ts` filters with biquads and the study filters in the frequency domain. For the same sound a band
level differs by up to 1 dB between the two.

## WebGPU against the CPU tier

Commands 3: the first 470 blocks (10.03 s, to the break) on both tiers.

| Tier     | Blocks | Median (ms) | p95 (ms) | Real time | Host time (s) | Loudness before (LUFS) | Deepest gain of the limiter (dB) |
| -------- | -----: | ----------: | -------: | --------: | ------------: | ---------------------: | -------------------------------: |
| CPU tier |    470 | in progress |          |           |               |                        |                                  |
| WebGPU   |    470 |       34.60 |    46.61 |    0.550x |          19.4 |               -23.4988 |                           -3.929 |

The WebGPU part ran at 09:06 UTC. The CPU tier started at 09:05 UTC and had not ended when this record
was written: its row, its JSON (`docs/records/09-force-passage-container-2-cpu.json`) and the result of
`across.ts` are **not run to the end** at this commit. A later commit of this pull request adds them.

## Deviations and what this run does not do

The eight items of record 09 ("What the port does not do") stand, with these changes. All are open.

1. Item 3: the limiter now goes 6.6 dB deep, and the result is 6.1 LU quieter than the study's.
2. Item 6: a fall of the bands that follows the size was tried in the second plan and taken out. The
   weight of a hit now comes from an `impact`, not from the stone.
3. The third plan leaves the study's levels on purpose. `study.json` and `measure.ts` still print the
   study's numbers beside the engine's; they are a reference, not a target.
4. The landings of the blocks are two events far away. The owner said after an earlier round of the study
   that the landings in the dust had no sound and that the passage ended at once. This plan keeps the
   landings low because the picture shows fog. From 148.5 s the level falls from -20.2 dBFS to -51.4 dBFS
   at 151.75 s, by 4.8 dB a quarter second at the most. Whether that is enough is for the owner's ear.
5. The message of commit `586941b` says "37 events (the first held 59)". The second plan, which was not
   committed, held 60.

## Open items

- The owner's listening review of the third plan, with the picture. Next action: the owner.
- Whether the owner's rule (one sound leads in each moment; a silence says that a larger hit comes) goes
  into `docs/sound-design-loop.md` as a part of the design. It is a change to the design, so it needs the
  owner's go-ahead. Next action: the owner.
- The device runs: one record a device, `docs/records/09-force-passage-<device>.md`. Next action: the
  owner, after the review.
- WebGL2 was not run.
- The red and the finale passage of the study are not moved.
