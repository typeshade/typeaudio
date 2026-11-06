# Reproduce the audible studies

Use a checkout of `feat/frieren-sound-design-studies` in `typeshade/typeaudio`.
The TypeShade pin is `87af4eb0d9d15f02b66b8341b72cab0944290472`.
The existing private CPU generator adapter remains unchanged. Compiler proposal 0122 is not implemented by this study.

## Dependencies

- Bun 1.4.4 for the checked render.
- Python 3.12, NumPy 2.3.5 and SciPy 1.17.0 for delivery processing.
- FFmpeg 7.1.5 for loudness measurement, PCM encoding and AAC encoding.
- The repository dependencies from `bun.lock`.

No reference video or external sound library is needed to regenerate these original procedural effects.
The picture remains an external YouTube reference. No reference soundtrack is sampled.

## Procedure

1. Run `bun install --frozen-lockfile`.
2. Create a Python virtual environment with NumPy and SciPy.
3. Run `python3 scripts/frieren/author/build.py`.
4. Confirm that `docs/studies/frieren/sound-design/session.json` has no diff.
5. Run `bun scripts/frieren/render.ts /absolute/path/to/new-output`.
6. Run `python3 scripts/frieren/finish.py /absolute/path/to/new-output`.
7. Inspect `delivery/manifest.json` and listen to the six candidate mixes against their reference passages.

Both render and delivery directories must be new. The scripts refuse to overwrite existing outputs.
An optional third render argument selects `red`, `force` or `finale`.
Full reproduction checks all three studies. Partial renders are labelled by their exported variant list.

## Output contract

Every WAV is stereo, 48 kHz, 24-bit PCM. Every mobile file uses AAC in an M4A container.
Each file starts at its study's `range[0]` on the local picture clock.
Each file includes 2.5 seconds of room tail after `range[1]`; that tail is an audition handle.
It does not extend the authored picture region or establish synchronization with YouTube.

The renderer simulates at least one second before the audible crop.
It uses `round(absoluteSeconds * 48000)` for each event boundary.
The intact source frame cadence maps to 2002 audio samples per frame at 48 kHz.
Control trajectories update every 512 samples; source onsets and gain envelopes remain sample-indexed.
GraphDsp applies its existing 5 ms onset fade. The source wrapper adds a 5 ms end taper.
The mix crop adds a 10 ms opening fade and a 50 ms fade at the tail handle's end.

Six bus names separate space, energy, movement, impact, detail and debris.
Each bus uses the same linear room configuration. Its aligned WAV includes that bus's room return.
The full mix is the sum of those stems, subject to independent 24-bit quantization error.
Do not normalize stems individually before summing them.

`render-receipt.json` records source revision, dirty state, compiler pin, room parameters and raw stem hashes.
`graphs/` stores portable source graphs. `generated/` stores the actual TypeShade source produced by compilation.
`delivery/manifest.json` records artifact hashes, measured levels, gain moves, A/B changes and review status.

Peak and loudness measurements cannot establish material quality, masking, externalization or dramatic success.
Short-passage LRA is diagnostic only. Do not rank candidates by that value.
This offline renderer is not an allocation-free callback or a game performance test.

## Publication boundary

Keep generated media outside Git. Preserve source recipes and verification receipts in Git.
Use new versioned object keys if the review media is stored in the owner's `typesound` R2 bucket.
The bucket's public endpoint was disabled during inspection. Do not change its access settings for this study.
Temporary signed links can expose specific authored review assets without publishing the source video or the entire bucket.
The existing website still needs its planned template asset route and playback integration.
