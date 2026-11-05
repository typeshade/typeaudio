# TypeAudio sound designer

The public site is <https://audio.typeshade.dev/>. The sound designer composes
TypeAudio units in a website-owned voice. It uses the repository's pinned
TypeShade compiler. The engine's public APIs and compiler pin are unchanged.

## Sound design

- Two oscillators: sine, saw, square, or triangle; blend, transpose, and detune.
- One to eight unison voices, a resonant lowpass with bypass, and ADSR.
- Soft-clipping drive, feedback delay, and a damped Schroeder room reverb.
- Six presets, bounded randomization, undo, and reset.
- Continuous Live mode, plus offline automatic audition, loop playback, and stop.
- Aligned before/after effects comparison, waveform, spectrum, and WAV export.
- Named local patches and validated JSON import/export.

`designer.shade.ts` composes the engine's `Sine`, `Saw`, and `Lowpass` units.
`designer-render.ts` uses `bank`, `mixdown`, `drive`, and `gain` in one fuse plan
per block. The selected CPU or WebGPU backend runs these synthesis kernels.
Delay, reverb, output gain, spectrum analysis, and WAV encoding run on the CPU.
The execution report states this boundary. The square and triangle shapes use
the oscillator phase directly; these simple oscillators are not band-limited.

The clip contains the note hold and release. Each enabled time effect adds up to
two seconds of tail. The final tail is faded. Before FX bypasses delay and reverb;
it retains filter, envelope, drive, and output gain. The dry and wet buffers have
the same length. WAV export uses the currently selected monitor signal.

Auto audition renders after a 400 ms editing pause, then replaces playback.
It does not generate audio in a live GPU callback. Changes invalidate an older
render. Playback requires a user gesture. Audio and saved patches stay in the
browser. Saved patches use versioned local storage; JSON export provides a copy.

In Render mode, the spectrum is a 2,048-frame Hann-windowed FFT near the start
of the clip. In Live mode, an AnalyserNode shows the running waveform and spectrum.
Render time includes device setup and compilation. It is not a benchmark.

## Development

1. Run `bun install --frozen-lockfile`.
2. Run `bun run dev:website`.

The development server serves the interactive page. Build the site to generate
its four documentation routes from the repository Markdown.

## Checks

1. Run `bun run check`.
2. Run `bun run check:website`.
3. Run `bun run test`.
4. Run `bun run build:website`.
5. Run `TYPESHADE_CHROMIUM=/path/to/chromium bun run test:website`.

Without `TYPESHADE_CHROMIUM`, the browser check uses Playwright's installed
Chromium. CI installs that browser and its dependencies. Tests verify effects
against impulses, ADSR boundaries, actual oscillator/filter output, CPU/WebGPU
PCM parity, playback, patches, comparison, and responsive layout. SwiftShader
verifies GPU execution but does not measure physical GPU performance.
Screenshots are written to ignored `artifacts/`.

The worker is one module. Its executor cannot back-import an unversioned entry
and create a second resident registry. A query-bearing worker regression checks
both CPU and WebGPU. This retains the fix from pull request #19.

## Deployment

The `Deploy website` workflow builds pushes to `main`. It deploys `website/dist`
with Wrangler 4.151.0 and the existing organization `CLOUDFLARE_API_TOKEN` secret.
`wrangler.jsonc` connects `audio.typeshade.dev` as a custom domain. Unknown paths
return `404.html` with HTTP 404. No application server or storage binding is used.

For an authorized deployment from a branch:

1. Run `bun run build:website`.
2. Run `bunx wrangler@4.151.0 deploy`.

The token is never included in the site. Font files retain the IBM Plex license
in `public/fonts/`. Relative documentation source links retain their GitHub
destination unless the corresponding document is hosted here.

The first website baseline was `649368d9511f98e4cb7217c6f19c93882c82e3e5`.
The sound designer starts from `f869f0e41a24dfa2e8cef8cb7947a6828345e0a4`.

## Live mode

A separate Live mode runs synchronous TypeAudio unit blocks in an AudioWorklet.
Parameter updates preserve oscillator, filter, delay, and reverb state. Live mode
uses the CPU; offline CPU/WebGPU rendering and WAV export remain available.
No promise, worker round trip, or buffer replacement fills an audio callback.

Live is the initial mode. Press Start live to enable audio. Parameter changes go
through the worklet port without stopping playback. Continuous parameters and
bypasses settle over approximately 12 ms; shape and transpose choices are discrete.
Repeat envelope cycles the note hold and release. With repeat off, the note
sustains until stopped. Retrigger restarts the envelope, retaining oscillator and
effect state. Stop fades the output before disconnecting the processor.

`live-voice.shade.ts` extends the website voice with a synchronous block method.
One CPU host call produces up to 128 samples per voice, using the compiled
TypeAudio oscillator and filter units. `live-dsp.ts` mixes voices and runs
stateful drive, delay, and reverb. `live.worklet.ts` writes output before returning
from `process()`. It never calls an asynchronous engine kernel or offline render.
`live-audio.ts` loads one self-contained worklet module and manages its lifetime.

Live mode uses a 48 kHz AudioContext and requires AudioWorklet support. Actual
latency and CPU headroom depend on the device and browser. Render mode remains
available when live processing is unavailable, and is the path for GPU synthesis
and WAV export. Exported PCM is a separate render, not a recording of live edits.

Live tests verify synchronous output against the TypeAudio offline render,
continued sample clocks and changed pitch after updates, retained effect tails,
and actual browser processing with eight voices. The browser check also verifies
that edits reuse one AudioWorkletNode and issue no offline-render worker request.
