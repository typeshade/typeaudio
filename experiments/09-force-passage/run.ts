// Experiment 9, the force passage of the study as a plan on the engine (docs/experiments.md, section 9).
//
//   bun experiments/09-force-passage/run.ts [--tier webgpu|webgl2|cpu] [--blocks 0] [--out <directory>]
//
// It renders `plan.json` (15.7 seconds, the picture from 136.5 to 152.2 s of the study's scene)
// through the kinds, the spatial chain, the reverb and the guards (`src/render-plan.ts`), on WebGPU
// or WebGL2 in headless Chromium on SwiftShader (`TYPESHADE_CHROMIUM` names the binary), or on the
// CPU tier in Node. `--blocks` is the blocks to render from the first, 0 for the whole clip. It writes
// the mix, the reverb's return and each layer's stem as 32-bit float WAV, and the result as JSON,
// into `experiments/09-force-passage/out/` (not committed), and prints the block times and the master.
// `measure.ts` reads the mix. A number without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { buildInfo } from 'typeshade';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { fromBase64 } from '../03-fft/signals.ts';
import { wavBytes } from '../08-sound-design/wav.ts';
import type { Tier } from '../08-sound-design/options.ts';
import type { Options, Result } from './harness.ts';

const HERE = 'experiments/09-force-passage';
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined)
    throw new Error(
      `run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`,
    );
  args.set(key.slice(2), value);
}
const tier = (args.get('tier') ?? 'webgpu') as Tier;
if (!['webgpu', 'webgl2', 'cpu'].includes(tier))
  throw new Error(`run.ts: --tier takes webgpu, webgl2 or cpu; got "${tier}".`);
const blocks = Number(args.get('blocks') ?? 0);
if (!Number.isInteger(blocks) || blocks < 0)
  throw new Error(
    `run.ts: --blocks takes a whole number of 0 or more; got "${args.get('blocks')}".`,
  );
const outDir = args.get('out') ?? join(ROOT, HERE, 'out');
const options: Options = { tier, blocks, stems: true };

const git = (...a: string[]): string =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
await mkdir(outDir, { recursive: true });

let result: Result & Record<string, unknown>;
if (tier === 'cpu') {
  const main = await bundle({
    entry: `${HERE}/node.ts`,
    outDir: `${HERE}/out/node`,
    target: 'node',
  });
  result = JSON.parse(
    await runNode(await nodeBinary(), [main, JSON.stringify(options)]),
  ) as Result & Record<string, unknown>;
} else {
  const page = await bundle({ entry: `${HERE}/page.ts`, outDir: `${HERE}/out/web`, target: 'web' });
  type Page = { renderForce(o: Options): Promise<unknown> };
  result = (await inPage(dirname(page), (p) =>
    p.evaluate((o) => (globalThis as unknown as Page).renderForce(o), options),
  )) as Result & Record<string, unknown>;
}

// The files: the mix, the reverb's return and each layer's stem.
const files: string[] = [];
const write = async (name: string, packed: string | undefined): Promise<void> => {
  if (packed === undefined) return;
  const both = fromBase64(packed);
  const n = both.length / 2;
  await writeFile(
    join(outDir, name),
    wavBytes([both.subarray(0, n), both.subarray(n)], result.sampleRate ?? 48000),
  );
  files.push(name);
};
await write(`mix-${tier}.wav`, result.mix);
await write(`wet-${tier}.wav`, result.wet);
for (const [layer, packed] of Object.entries(result.layers ?? {}))
  await write(`stem-${layer}-${tier}.wav`, packed);
if (result.mix !== undefined)
  await writeFile(join(outDir, `mix-${tier}.f32`), new Uint8Array(fromBase64(result.mix).buffer));

const cpu = cpus();
const { mix: _mix, wet: _wet, layers: _layers, ...rest } = result;
const record = {
  experiment: '09-force-passage',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  buildInfo,
  machine: {
    cpu: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    os: `${platform()} ${release()}`,
    bun: process.versions['bun'] ?? null,
  },
  options,
  files,
  ...rest,
};
await writeFile(join(outDir, `result-${tier}.json`), `${JSON.stringify(record, null, 2)}\n`);

if (result.failed !== undefined) {
  console.log(`${tier}: not rendered: ${result.failed}`);
  process.exitCode = 1;
} else {
  const t = result.timing!;
  const m = result.master!;
  console.log(
    `${tier} (${result.tier}): ${t.blocks} blocks, median ${t.ms.median.toFixed(2)} ms, p95 ${t.ms.p95.toFixed(2)} ms, first ${t.firstMs.toFixed(0)} ms, ${t.over} over ${t.budgetMs.toFixed(2)} ms, ${t.realTime.toFixed(3)}x real time`,
  );
  console.log(
    `master: ${m.lufsBefore.toFixed(1)} LUFS before, ${m.normalizeDb.toFixed(1)} dB to the target, the limiter's deepest gain ${m.limiterMinDb.toFixed(1)} dB`,
  );
  console.log(`wrote ${files.length} files and result-${tier}.json into ${outDir}`);
}

/** The Node binary on PATH: the first `node` that is not Bun's alias of itself. */
async function nodeBinary(): Promise<string> {
  const named = process.env['NODE_BINARY'];
  if (named) return named;
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    const real = await realpath(candidate).catch(() => undefined);
    if (real !== undefined && !/(^|[/\\])bun(\.exe)?$/.test(real)) return candidate;
  }
  throw new Error(
    'run.ts: found no Node on PATH, only Bun. Install Node 22, or name it with NODE_BINARY.',
  );
}

/** Runs Node on `argv` and resolves to its stdout; its stderr is this process's. */
function runNode(node: string, argv: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(node, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done(out) : fail(new Error(`node exited with ${code}`)),
    );
  });
}
