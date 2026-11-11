# Experiment 12: scene 1, the red seal

Scene 1 of the reference video (0:00 to 0:29.5): the red seal as a black hole that draws in the air
and the stones around it. The owner's decision of 2026-11-11: the sound models and the processing of
the perceptual study (`docs/studies/frieren-perceptual/`, commit `07670c9`) are ported into the
engine (`src/study/`), and the scene is made with them. `docs/experiments.md`, section 12, is the
record.

## Run

1. Render the scene: `bun experiments/12-scene1-red-seal/run.ts scene --out <dir>`.
2. Render the study's red passage: `bun experiments/12-scene1-red-seal/run.ts red --out <dir>`.
3. Measure it against round 11: add `--against <frieren-red-r11.wav>` to step 2.

## Parity with the study

The study's scripts are on pull request #67 at commit `07670c9`. Extract `scripts/` of
`docs/studies/frieren-perceptual/` from that commit into a directory first.

1. Render the study's red passage with the shared generator:
   `python3 parity/render_shared.py <scripts> red <study-red.f64>`.
2. Compare: `bun experiments/12-scene1-red-seal/run.ts red --parity <study-red.f64>`.
3. Write the model fixture again: `python3 parity/fixtures.py <scripts> test/fixtures/study-parity.json`.
4. Write the function fixture again:
   `python3 parity/function_fixtures.py <scripts> test/fixtures/study-functions.json`.

The reference video, its frames, its audio and every render stay outside the repository.
