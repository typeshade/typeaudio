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

## Parts, the cache and the workers

The layers are built from parts (`Mix.part`, `src/study/build.ts`). A part is a group of statements
that adds layers and reads only its own code, the module's constants and functions, and the mix's
settings. Each part has a key: the hash of its code, of the module-level code it reaches, of
`src/study/`, of the runtime and of the mix's settings (`src/study/part-keys.ts`).

- A part whose key is in `.cache/scene-parts/` is read from it. The others are made on one worker
  thread for each core, the longest first.
- The layers go in the order the scene adds them, so the samples are those of the plain code, bit
  for bit, with any number of workers.
- `carve` is a layer step (`Mix.eachLayer`) and `levelCore` a finish step (`Mix.finish`). They run
  after the parts and touch disjoint layers.
- The build refuses a part that reads a binding of the function around it, changes a module binding
  or reads the mix's layers. Put shared signals and random streams inside one part.
- A change to `src/study/` changes every key. A change to a helper changes the keys of the parts
  that reach it.

`--workers N` sets the threads, `--no-cache` reads and writes no cache, and `--plain` runs the code
as written, with no builder.

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
