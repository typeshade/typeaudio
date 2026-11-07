# Audio LLM feedback for procedural sound

The host workflow renders actual TypeShade sources, sends their PCM to an audio-input
LLM and checks its structured feedback before applying a bounded revision. It runs
outside the audio callback. It does not establish real-time inference or professional
sound-design quality.

The first fixture is a three-second column impact. Contact noise drives six damped
body modes. Eight irregular fragment contacts provide a separate fracture layer.
The room bus supplies early reflections and a diffuse tail. All source functions,
controls and random seeds remain available in the candidate directory.

## Offline source preparation

1. Install the pinned repository dependencies with `bun install --frozen-lockfile`.
2. Install FFmpeg for BS.1770 loudness and true-peak measurements.
3. Run `bun run quality prepare artifacts/quality/column-study`.
4. Inspect `run.json`, the three candidate directories and their stems.

Preparation has no network requests and selects no winner. A candidate contains
`source.function-graph.json`, `candidate.json`, `mix.wav`, `dry.wav` and three layer WAVs.
The WAV input is PCM16. Nonfinite, overloaded or silent sources fail before evaluation.
The source profile includes the studio onset and end tapers. Room output includes
the studio's master taper, with highpass disabled.

## Local audio LLM

The local adapter uses the Thinker component of `Qwen/Qwen2.5-Omni-3B` at revision
`f75b40e3da2003cdd6e1829b1f420ca70797c34e`. Transformers loads its built-in implementation;
the workflow does not enable remote repository code. The model receives both audio
arrays and the brief. It produces text feedback. It is not a semantic similarity scorer.

1. Create an isolated Python 3.12 environment with `python3 -m venv .audio-llm`.
2. Install `torch==2.8.0 torchvision==0.23.0` from `https://download.pytorch.org/whl/cpu` into that environment.
3. Install `scripts/quality/local/requirements.txt` into the same environment.
4. Run `.audio-llm/bin/python scripts/quality/local/omni.py --download </dev/null` once.
5. Set `TYPEAUDIO_AUDIO_PYTHON` to the environment's absolute Python executable path.
6. Run `bun run quality evaluate artifacts/quality/column-study --max-calls 13 --max-revisions 2`.

The model needs several gigabytes of RAM and checkpoint storage. Startup loads the
cached pin without network access. The local adapter converts stereo to mono and
resamples to 16 kHz. It cannot establish stereo localization or immersive listening quality.
Each inference has a ten-minute timeout and a 1,600-token output limit. Failed or
incomplete outputs cannot promote a candidate. Local raw replies are retained for diagnosis.

Use `bun run quality:probe CANDIDATE_DIRECTORY OUTPUT_DIRECTORY` for a shorter
audibility and order diagnostic. It retains all three raw LLM replies and PCM hashes.
Passing this diagnostic does not replace the full calibration or establish quality.

An optional OpenAI adapter sends actual WAVs through `input_audio`. Configure
`OPENAI_API_KEY` and `TYPEAUDIO_AUDIO_MODEL` only when using that provider.
The local Python setting takes precedence. No API key enters the browser or receipts.

## Evaluation and revision

1. Check clean versus silent audio in both presentation orders.
2. Check identical audio and a deliberately distorted derivative in both orders.
3. Require every calibration preference to match its known control.
4. Match candidate loudness with static gain, retaining at least 3 dB true-peak headroom.
5. Compare anonymous A/B audio, then swap presentation order.
6. Require a consistent preference and no required-criterion regression.
7. Accept only declared control revisions corroborated by both orders.
8. Recompile, render and compare the proposed revision within the remaining budget.
9. Keep the last accepted candidate after a failure, regression, tie or uncertain response.

The default limit is thirteen calls and two revisions. Five calls belong to calibration.
The maximum is twenty-five calls and four revisions. Failed requests count against
the budget. There are no hidden retries. A comparison needs two remaining calls.

The first automatic edit path changes up to four bounded source controls. The LLM
cannot inject JavaScript or shell commands through its response. Broader TypeShade
function rewrites require a separate authoring step and the same compile/render/review
gates. This checkpoint does not claim autonomous topology or algorithm redesign.

## Evidence and interpretation

`evaluation/requests/` records the brief, input hashes, evaluator identity and response.
`evaluation/calibration/` retains the actual control audio. Each comparison retains
its level-matched WAVs, gains, both model responses and the promotion decision.
Revision receipts name the parent, changed controls and reasons. `evaluation/result.json`
records the last retained candidate and any incomplete phase.

`model-selected` means a consistent model preference. `modelCriteriaMet` means the
model marked every required criterion as met in both orders. Neither means human
acceptance. `humanAccepted` remains false. Basic calibration verifies discrimination
and order stability; it does not validate professional aesthetic judgment. A separately
reviewed preference corpus and human listening tests are still required.

Run directories are append-only. Use a new directory for another evaluation. If a
process stops abruptly, inspect the recorded comparison decisions before restarting.
The workflow supports source recovery, not automatic continuation of an interrupted run.

## Existing Web editor

Web PR #49 provides `export:quality`. It imports the same source into the existing
version-3 project format, with duration, room and YouTube reference preserved.
The site caps source volume at 0.7; the exporter compensates on the linear scene bus.
Raw function-document import alone uses different default duration and volume.
No new website or public template is required for this flow.

The reference is <https://youtu.be/YHCqcyX9N3s>. Contact is authored at 145.937 seconds;
the source starts 50 ms earlier. This timing still needs visual synchronization review.
No original video or reference soundtrack is included in the generated candidate.
