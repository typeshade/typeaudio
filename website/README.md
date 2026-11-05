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

## Checks

1. Run `bun run check`.
2. Run `bun run check:website`.
3. Run `bun run test`.
4. Run `bun run build:website`.
5. Run `TYPESHADE_CHROMIUM=/path/to/chromium bun run test:website`.

The browser check also renders with a query-bearing worker URL on both backends.
The worker is one module, so its executor cannot load a second resident registry
through an import back to an unversioned entry.

The browser check uses SwiftShader. It verifies GPU execution, but does not
measure physical GPU performance. Screenshots are written to ignored `artifacts/`.
The build includes four repository documents. Relative source links retain their
GitHub destination unless the corresponding document is hosted here.

## Deployment

The `Deploy website` workflow builds pushes to `main`. It deploys `website/dist`
with Wrangler 4.151.0 and the existing organization `CLOUDFLARE_API_TOKEN` secret.
`wrangler.jsonc` connects `audio.typeshade.dev` as a custom domain. Unknown paths
return `404.html` with HTTP 404. No application server or storage binding is used.

For an authorized deployment from a branch:

1. Run `bun run build:website`.
2. Run `bunx wrangler@4.151.0 deploy`.

The token remains a deployment credential. It is never included in the site.
The font files retain their IBM Plex license in `public/fonts/`.

## Sound designer scope

The next playground revision adds two oscillator shapes and a blend, detune,
filter resonance and bypass, ADSR, and a drive stage. A website-owned voice
composes TypeAudio oscillator and filter units. Existing bank, mixing, gain, and
meter kernels run on the explicitly selected backend.

Delay and reverb process rendered PCM in the worker on the CPU. Their placement
is reported. The playground adds dry/wet comparison, waveform and spectrum views,
automatic preview after an explicit user gesture, presets, and local patch storage.
It renders finite clips before playback; it does not promise a live GPU callback.
