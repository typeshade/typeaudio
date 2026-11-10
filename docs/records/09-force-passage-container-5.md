# Record 09-5: the sixteenth plan of the force passage, and where experiment 9 ends

> **Reference numbers, not a device result.** The device of this run is the container of a
> coding-agent session: WebGPU on SwiftShader, which runs on the container's CPU. The times say what
> the harness measures. They do not stand for a GPU's time per block. The levels are facts about the
> render. What the render sounds like is the owner's review, and this record gives each review.

This is the fifth recorded run of experiment 9 (`docs/experiments.md`, section 9). It follows
`docs/records/09-force-passage-container-4.md`, which holds the fifth plan. The plans from the sixth
to the fifteenth have no record of their own: the owner reviewed each within minutes, and this record
gives them in one table. No file of `src/` changed after commit `586941b`, so record 09-2 still holds
WebGPU to the CPU tier for the engine of this run.

## The plans from the sixth to the sixteenth, and what the owner heard

All on 2026-11-10. Each plan is one commit of pull request #68; each review is the owner's, in
English, of the plan in its row.

| Plan       | Commit    | What the plan changed                                                                      | What the owner heard                                                                                                            |
| ---------- | --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Sixth      | `f1fbee4` | A landing with no tone: a large block with its edge, a body and a punch with no tone, grit | The frame of silence is the hint of the next attack. The hit on the wall is a hit on a plastic container: thin, with no density |
| Seventh    | `f295289` | The hit on the wall as one hard, dense hit on stone                                        | The first impact satisfies. The wall that breaks and the pieces that come out are plastic, or a steel bin that is kicked        |
| Eighth     | `a5aa0f3` | No block of a middle size after the hit                                                    | Something rings under the wind at the start. Still too much like plastic; it must be denser; look at the reference              |
| Ninth      | `282d017` | No `cloth`; a mass, a wide roar from the blast to the fog                                  | The stones that fall to the floor are a plastic bin that is kicked                                                              |
| Tenth      | `282d017` | No `boom` over 100 Hz after the hit; a landing as the hit on the wall, smaller             | The whole is as it was: not tons of a wall on a floor of stone, but a steel bin that is kicked hard and rolls                   |
| Eleventh   | `2cc61fb` | No `crack` and no `rubble` after the hit                                                   | The owner described the sound of a stone of tens of tons that lands, in four layers (`docs/sound-design-loop.md`, step 7)       |
| Twelfth    | `93c4a1a` | A landing from the four layers                                                             | It should land with more weight                                                                                                 |
| Thirteenth | `2e2b544` | The landing nearer, with the slam of the hit on the wall                                   | Near 11 s a high hiss grates                                                                                                    |
| Fourteenth | `4713a8d` | The tear and the crush of the landing darker                                               | Change the hiss into the hit of a block of stone on the floor                                                                   |
| Fifteenth  | `4713a8d` | A landing from the parts of the hit on the wall; no roar that hisses                       | It must weigh more and be denser; it looks hollow inside                                                                        |
| Sixteenth  | `b74bd5a` | A second block, a dark roar and a body at 95 Hz inside the landing                         | The owner asked why one remark, given many times, was not met, and whether the cause is in the structure                        |

The ninth and the tenth plan share one commit, and so do the fourteenth and the fifteenth: the owner
reviewed the earlier of each pair before it was committed.

## Three prototypes outside the engine

After the sixteenth plan the owner said that the landing would be right as the hit on the wall with
its pitch far lower. The engine cannot lower a whole sound. Three prototypes were made in Python in
the session's scratch, each on the sixteenth plan's mix with its landings taken out. They are not in
the repository, and they are not renders of the engine.

| Prototype | What it is                                                                                                                                   | What the owner heard               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1         | A landing from new materials: 50 irregular modes a block, thousands of fine breaks a second, a ground of 14 low modes, saturation on the mix | No review                          |
| 2         | The engine's own hit on the wall, rendered alone and read at half speed: one octave lower, twice as long                                     | Better. Three octaves lower still? |
| 3a        | The same, at a sixteenth of the speed: four octaves lower, 16 times as long                                                                  | No review of its own               |
| 3b        | The same, at a quarter of the speed: two octaves lower, four times as long                                                                   | The second one is plausible        |

The owner then asked why the hit on the wall and the break fit, though they sound alike.

## What experiment 9 answers

**The question** was whether the engine can make the force passage from a plan, with the weight and
the tension of the study's round 11, and which kinds and plan fields it must gain.

- **The structure of the passage was right early.** The order, the silences, the sound that leads in
  each moment and the hints were accepted by the fifth plan. The owner's rule for it is
  `docs/sound-design-loop.md`, "One sound leads".
- **One sound was accepted: the hit on the wall**, at the seventh plan.
- **A block of stone that lands was not reached in sixteen plans.** The owner heard things of a house,
  plastic, a steel bin, a hiss and a hollow thing. The synthesis of the kinds, bands of noise and one
  sine, did not make a mass of stone, whatever the plan laid on it.
- **What worked was not a plan.** It was the accepted sound, lowered by two octaves, outside the
  engine.
- **The measures of the session did not tell stone from a bin.** Band levels, the share of one tone
  and the flatness of the spectrum moved as intended in each plan, and the owner's review stayed.

The findings and the theory behind them are `docs/sound-design-theory.md`. What the engine lacks is
its section 9: a pitch for an event, material, density in the master, recordings, and an ear.

## The run

| Item         | Value                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiment   | 9, the force passage of a study, as a plan on the engine                                                                                                                                                                                |
| Command 1    | `TYPESHADE_CHROMIUM=/opt/pw-browsers/chromium bun experiments/09-force-passage/run.ts --tier webgpu`                                                                                                                                    |
| Command 2    | `bun experiments/09-force-passage/measure.ts --tier webgpu`                                                                                                                                                                             |
| Date         | 2026-11-10 12:37 UTC                                                                                                                                                                                                                    |
| Commit       | `daa743a48093a2455e136197ab671d20fc969052` of `typeshade/typeaudio` (branch `claude/force-passage-engine`, pull request #68), clean tree. The plan is the plan of `b74bd5a`; the two commits after it change documents only             |
| Compiler pin | `typeshade` in `package.json`: the source tarball of `typeshade/typeshade` at `415b276a7408936cb483d05ca8bb39e797b05966` (`buildInfo.version` 0.1.0, `buildInfo.revision` null)                                                         |
| Tools        | Bun 1.4.4, Node v22.23.4, Google Chrome for Testing 153.0.8010.12                                                                                                                                                                       |
| Machine      | Intel Xeon at 2.10 GHz, 4 cores, Linux 6.18.44                                                                                                                                                                                          |
| Raw data     | `docs/records/09-force-passage-container-5.json` (command 1) and `docs/records/09-force-passage-container-5-measure.json` (command 2)                                                                                                   |
| Outputs      | The mix as 32-bit float WAV in `experiments/09-force-passage/out/`, which Git ignores. Its SHA-256 is `b2346dd35dc8738700348e8b9c2cfb3ef68d60f7305716eed49ff1dc230c48ef`; the owner's clip of the sixteenth plan holds the same samples |

The device is WebGPU: vendor `google`, architecture `swiftshader`, `fallback` true. All 47 groups of the
last block's fuse plan ran on `webgpu`. **Not run:** the CPU tier, WebGL2, a device.

The plan holds 77 events and two silences: 22 `boom`, 19 `roar`, 15 `crack`, 10 `impact`, 4 `wind`,
4 `whoosh`, 2 `rubble`, 1 `drone`.

| Tier   | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Host time (s) | Reverb prepare (ms) |
| ------ | -----: | ----------: | -------: | -------: | ---------: | ------------: | --------: | ------------: | ------------------: |
| WebGPU |    736 |       46.33 |    55.44 |    72.84 |       1357 |           735 |    0.438x |          37.3 |                 197 |

| Item                                  | The fifth plan | This run   |
| ------------------------------------- | -------------- | ---------- |
| The target                            | -13 LUFS       | -10 LUFS   |
| The loudness of the mix before        | -26.4 LUFS     | -17.7 LUFS |
| The gain to the target                | +13.4 dB       | +7.7 dB    |
| The deepest gain of the limiter       | -6.2 dB        | -8.7 dB    |
| The integrated loudness of the result | -15.1 LUFS     | -12.7 LUFS |
| The true peak of the result           | -1.1 dBTP      | -1.1 dBTP  |

Levels in dBFS, command 2:

| Phase (picture seconds)          | The fifth plan | This run | This run: 30-120 Hz | 120-500 Hz | 500-2k Hz | 2k-6k Hz | 6k-14k Hz |
| -------------------------------- | -------------: | -------: | ------------------: | ---------: | --------: | -------: | --------: |
| Stare (143.0 to 144.9)           |          -26.8 |    -32.5 |               -36.9 |      -42.4 |     -49.6 |    -59.8 |     -65.6 |
| Flight (145.27 to 145.85)        |          -12.5 |    -13.5 |               -19.1 |      -20.9 |     -19.8 |    -24.0 |     -33.7 |
| Wall hit (145.937 to 146.10)     |          -10.6 |    -10.5 |               -13.9 |      -17.5 |     -19.5 |    -22.4 |     -30.3 |
| Cracks spread (146.10 to 146.46) |          -13.4 |    -12.1 |               -17.6 |      -19.2 |     -19.1 |    -23.0 |     -33.5 |
| Breakout (146.48 to 146.70)      |          -11.2 |    -11.2 |               -15.3 |      -22.0 |     -18.8 |    -22.6 |     -32.3 |
| Fall (146.70 to 147.75)          |          -19.5 |    -14.9 |               -18.4 |      -24.3 |     -23.8 |    -27.8 |     -38.2 |
| Fog (147.77 to 148.45)           |          -17.3 |    -12.0 |               -15.6 |      -17.7 |     -23.6 |    -28.7 |     -36.5 |

The strike, the blast, the hit and the break are placed 0.00 ms from their picture times. The silence
from 145.04 to 145.18 s holds no sample that is not 0.

## Deviations and open items

- The plan in the repository is the sixteenth. Its landings are not accepted. The sound the owner
  called plausible is prototype 3b, which the engine cannot make. Open.
- The plans from the sixth to the fifteenth were not rendered at a clean commit and have no JSON.
  Their numbers are in their commit messages. Closed: this table is their record.
- Prototype 1 has no review. Open; next action: none, unless the owner asks.
- The next experiment asks how far a model gets with better tools. Its statement is a separate change.
