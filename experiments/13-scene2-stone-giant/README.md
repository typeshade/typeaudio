# Experiment 13: scene 2, the stone giant

Scene 2 of the reference video (0:29.5 to 0:45.67): blocks of stone fly at Frieren, gather into a
giant, and its fist strikes the hall. It is made with the study's models in the engine
(`src/study/`), as scene 1 (experiment 12) is. The mix starts at 28.5 s from scene 1's tail and is
mastered at scene 1's gain. `docs/experiments.md`, section 13, is the record.

## The owner's rule (review 1, 2026-11-11)

A sound earns its place by its part in the moment (the answer "why"). Small detail of little weight
that nobody would miss is cut: settling stones, settling ticks, small pebbles that trickle.

## Run

1. Render scene 1 with experiment 12: `bun experiments/12-scene1-red-seal/run.ts scene --out <dir>`.
2. Render scene 2 and the join: `bun experiments/13-scene2-stone-giant/run.ts --out <dir> --join <dir>/scene.wav`.

The reference video, its frames, its audio and every render stay outside the repository.
