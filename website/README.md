# TypeAudio website

The public target is <https://audio.typeshade.dev/>. The site uses the repository's
pinned TypeShade compiler and TypeAudio engine. The playground renders a short
clip with `bank`, `Voice`, `plan`, and `render`. Web Audio plays the rendered PCM.
It does not use a substitute oscillator or claim real-time GPU audio.

The implementation starts from `main` at
`649368d9511f98e4cb7217c6f19c93882c82e3e5`.

## Scope

- Overview and documentation from the repository.
- Explicit CPU and WebGPU rendering, with no silent backend fallback.
- Voice, pitch, filter, drive, and duration controls.
- Playback, stop, waveform, execution report, and WAV download.
- Cloudflare Workers Static Assets at `audio.typeshade.dev`.

## Development

1. Run `bun install --frozen-lockfile`.
2. Run `bun run build:website`.
3. Run `bun run dev:website`.

Playback requires a user action. All synthesis and audio data stay in the browser.
The CPU tier is the portable default. WebGPU requires browser and device support.
Changes apply to the next render. Playback uses a short edge fade to avoid clicks.
