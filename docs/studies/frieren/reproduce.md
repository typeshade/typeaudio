# Reproduce the picture study

Use the supplied reference identified in [reference metadata](../../continuity/archive/reference-metadata.json).
Public playback remains the YouTube link. These scripts do not publish media.
The hash check rejects a different edit instead of silently reusing its timestamps.

## Environment

The recorded run used Python 3.12.14, FFmpeg/FFprobe 7.1.5, NumPy 2.3.5, Pillow 12.3.0 and Matplotlib 3.10.8.
Use a separate Python environment if those packages are absent.
The analysis scripts do not require a GPU, Bun or the TypeShade compiler.
The original synthesis recipes remain in the separate continuity recovery archive.

Create an environment outside the checkout when needed:

```sh
python3 -m venv ../frieren-analysis-env
../frieren-analysis-env/bin/python -m pip install numpy==2.3.5 Pillow==12.3.0 matplotlib==3.10.8
```

Use that environment's Python for the commands below. Install an identified FFmpeg/FFprobe build through the host's package manager.

## Procedure

1. Recover the analysis branch from [PR #27](https://github.com/typeshade/typeaudio/pull/27).
2. Read the repository rules and [study README](README.md).
3. Obtain the supplied reference and verify its SHA-256.
4. Choose new output directories for each command.
5. Extract the overview and detail frames.
6. Extract the adjacent-frame anchor ranges.
7. Measure the original mixed soundtrack over the proposed scene range.
8. Compare the resulting inventories and measurements with the preserved evidence.

Run from the TypeAudio checkout:

```sh
python3 docs/studies/frieren/scripts/extract_frames.py \
  --input /path/to/reference.mp4 --output /path/to/new-visual

python3 docs/studies/frieren/scripts/extract_frames.py \
  --input /path/to/reference.mp4 --output /path/to/new-anchors \
  --plan docs/studies/frieren/anchor-sampling.json

python3 docs/studies/frieren/scripts/measure_mix.py \
  --input /path/to/reference.mp4 --output /path/to/new-audio-measurements \
  --end 189.314625
```

The first extraction contains 372 unique source frames in 30 sheets.
The second contains 175 frames in 14 sheets. Their union contains 514 distinct frames.
The extractor uses decoded presentation timestamps and preserves frame numbers and hashes.
It does not use the labels from the previous contact sheets as timing evidence.
Explicit frame numbers refer to zero-based decoded presentation order for this identified source.

The source is constant-rate throughout the study range.
The extractor records the late timestamp gap and partial-file warning instead of declaring the entire file healthy.
The observed gap lies outside the studied scene.

## Outputs and interpretation

The extraction directories contain frame JPEGs, contact sheets and `extraction.json`.
These media outputs are local review aids. Git preserves their metadata and authored observations.
Different FFmpeg or JPEG library builds can change image bytes; check source identity, selected PTS and tool version first.

The mixed-track directory contains `mix-measurements.json`, `mix-windows.csv`, a numerical plot and a loudness log.
The decoded audio remains in memory; the tool saves no replacement audio.
The loudness pass explicitly applies `atrim` before measuring its input.
Only its input loudness fields become measurement results. Normalization settings are not creative or delivery decisions.

The CSV uses non-overlapping 250 ms windows.
RMS uses both channels' sample power. Side/mid uses `(L-R)/2` and `(L+R)/2`.
Spectral fractions use Hann-window power averaged across channels, normalized within 20 Hz–20 kHz.
The final incomplete window is omitted from the CSV; whole-range statistics still include the requested duration.
Segment summaries include only full windows contained within each named region.

## Verification scope

The production source hash was verified against the continuity inventory.
All overview/detail and anchor sheets were inspected.
Anchor re-extraction with the corrected `clone-landing` label preserved all 175 inspected frame hashes.
Decoded audio was finite, stereo and within one sample of the requested duration.
The document audit checks JSON, relative links, anchor references, PTS mapping and source identities.

No auditory review, separated-stem analysis, HRTF test, metric scene reconstruction or physical-device performance test ran.
No v2 remix, editor import, production deployment or R2 upload occurred.
The existing 0–188 second render remains unchanged by the proposed longer endpoint.
