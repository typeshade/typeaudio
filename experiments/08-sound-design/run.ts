// Experiment 8, a layered, spatial render of a hand-written plan (docs/experiments.md, section 8).
//
//   bun run exp:08 [--tier all|cpu,webgpu,webgl2] [--blocks cpu=0,webgpu=0,webgl2=40]
//                  [--repeat-blocks cpu=150,webgpu=150,webgl2=20]
//                  [--variant-seconds cpu=2,webgpu=15,webgl2=0.5] [--out <file.json>]
//
// It renders `plan.json` (30 seconds, 25 events, five layers) through the kinds, the spatial chain,
// the reverb and the guards (`src/render-plan.ts`), on three tiers: the CPU tier in Node, and WebGPU
// and WebGL2 in headless Chromium on SwiftShader (`TYPESHADE_CHROMIUM` names the binary). Each tier
// times every block against the 21.33 ms budget, renders the same blocks twice to count the values
// that differ, and renders two 15-second variants that differ in one correction (every whoosh a
// little darker), cold and warm. A tier that renders the whole clip (`--blocks 0`) also renders the
// one-layer version of the plan and scores both renders on the eight dimensions of the checklist
// (`score.ts`); a tier that renders fewer blocks writes no checklist, and its JSON says why. The CPU
// tier writes the stems and the mix as WAV into `experiments/08-sound-design/out/` (not committed).
// `--blocks` is the blocks each tier renders for the timed run, 0 for the whole clip;
// `--variant-seconds` the length of each variant. The runner
// holds each page tier's mix to the CPU tier's when both rendered the same blocks (`across.ts`),
// writes the result as JSON and prints the tables. A number without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { buildInfo } from 'typeshade';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { fromBase64 } from '../03-fft/signals.ts';
import { DEFAULTS, type Options, type Tier } from './options.ts';
import { compareMixes, type AcrossEntry } from './across.ts';
import type { Result } from './harness.ts';

const TIERS: Tier[] = ['cpu', 'webgpu', 'webgl2'];
const HERE = 'experiments/08-sound-design';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(
      `run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`,
    );
  }
  args.set(key.slice(2), value);
}
const tiers =
  (args.get('tier') ?? 'all') === 'all' ? TIERS : (args.get('tier')!.split(',') as Tier[]);
for (const t of tiers)
  if (!TIERS.includes(t))
    throw new Error(`run.ts: --tier takes cpu, webgpu, webgl2 or all; got "${t}".`);

/** An option of `tier=n` pairs, or one number for every tier. */
function perTier(name: string, fallback: Record<Tier, number>): Record<Tier, number> {
  const text = args.get(name);
  if (text === undefined) return fallback;
  const out = { ...fallback };
  for (const part of text.split(',')) {
    const [k, v] = part.includes('=') ? part.split('=') : ['all', part];
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0)
      throw new Error(`run.ts: --${name} takes numbers of 0 or more; got "${part}".`);
    for (const t of k === 'all' ? TIERS : [k as Tier]) out[t] = n;
  }
  return out;
}
const blocks = perTier('blocks', { cpu: 0, webgpu: 0, webgl2: 40 });
const repeatBlocks = perTier('repeat-blocks', { cpu: 150, webgpu: 150, webgl2: 20 });
const variantSeconds = perTier('variant-seconds', { cpu: 2, webgpu: 15, webgl2: 0.5 });
const outFile = args.get('out') ?? join(ROOT, HERE, 'out/result.json');
const outDir = join(ROOT, HERE, 'out');

const git = (...a: string[]): string =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const cpu = cpus();
const record: Record<string, unknown> = {
  experiment: '08-sound-design',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  buildInfo,
  machine: {
    cpu: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    os: `${platform()} ${release()}`,
    bun: process.versions['bun'] ?? null,
  },
  options: { blocks, repeatBlocks, variantSeconds },
};
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

const optionsFor = (tier: Tier): Options => ({
  ...DEFAULTS,
  tier,
  blocks: blocks[tier],
  repeatBlocks: repeatBlocks[tier],
  variantSeconds: variantSeconds[tier],
});

const results: Record<string, Result & Record<string, unknown>> = {};
await mkdir(outDir, { recursive: true });
if (tiers.includes('cpu')) {
  const main = await bundle({
    entry: `${HERE}/node.ts`,
    outDir: `${HERE}/out/node`,
    target: 'node',
  });
  const before = loadavg();
  results['cpu'] = JSON.parse(
    await runNode(await nodeBinary(), [main, JSON.stringify({ ...optionsFor('cpu'), outDir })]),
  ) as Result & Record<string, unknown>;
  loads['cpu'] = { before, after: loadavg() };
}
const pageTiers = tiers.filter((t): t is 'webgpu' | 'webgl2' => t !== 'cpu');
if (pageTiers.length > 0) {
  const page = await bundle({
    entry: `${HERE}/browser.ts`,
    outDir: `${HERE}/out/web`,
    target: 'web',
  });
  type Page = { runSoundDesign(o: Options): Promise<unknown> };
  for (const tier of pageTiers) {
    const before = loadavg();
    results[tier] = (await inPage(dirname(page), (p) =>
      p.evaluate((o) => (globalThis as unknown as Page).runSoundDesign(o), optionsFor(tier)),
    )) as Result & Record<string, unknown>;
    loads[tier] = { before, after: loadavg() };
  }
}

// Each page tier's mix against the CPU tier's. The two must be renders of the same blocks: the
// master's gain is the loudness of the render's own length (`across.ts`).
const across: Record<string, AcrossEntry> = {};
const cpuMix = tiers.includes('cpu')
  ? new Float32Array(Uint8Array.from(await readFile(join(outDir, 'cpu.mix.f32'))).buffer)
  : undefined;
for (const tier of pageTiers) {
  const r = results[tier]!;
  if (r.full?.mix === undefined) continue;
  if (cpuMix !== undefined)
    across[`${tier}-cpu`] = compareMixes(
      fromBase64(r.full.mix),
      r.full.frames,
      cpuMix,
      cpuMix.length / 2,
    );
  delete (r.full as { mix?: string }).mix;
}
record['across'] = across;
for (const [tier, r] of Object.entries(results)) record[tier] = r;
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);

// The tables.
const num = (v: number | null | undefined, d = 2): string =>
  v === null || v === undefined ? 'n/a' : v.toFixed(d);
console.log(
  '\n| Tier | Device tier | Blocks | Median (ms) | p95 (ms) | Max (ms) | First (ms) | Over 21.33 ms | Real time | Reverb prepare (s) | Dispatches | Submissions |',
);
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
for (const [tier, r] of Object.entries(results)) {
  const f = r.full;
  if (f === undefined) {
    console.log(
      `| ${tier} | ${r.tier} | not run: ${r.failed
        .map((x) => x.message)
        .join('; ')
        .slice(0, 120)} |`,
    );
    continue;
  }
  const t = f.timing;
  console.log(
    `| ${tier} | ${f.reportTier} | ${f.blocks} | ${num(t.ms.median)} | ${num(t.ms.p95)} | ${num(t.ms.max)} | ${num(t.firstMs)} | ${t.over} | ${num(t.realTime, 3)}x | ${num(f.reverbPrepareMs / 1000, 1)} | ${f.dispatches.last} | ${f.submissions} |`,
  );
}
for (const [tier, r] of Object.entries(results)) {
  if (r.repeat)
    console.log(
      `${tier}: the same ${r.repeat.blocks} blocks twice: ${r.repeat.differ} of ${r.repeat.values} values differ`,
    );
  if (r.variants)
    console.log(
      `${tier}: two ${r.variants.cold.seconds} s variants: cold ${num(r.variants.cold.pairMs / 1000)} s, warm ${num(r.variants.warm.pairMs / 1000)} s`,
    );
  for (const f of r.failed) console.log(`${tier}: ${f.step} stopped: ${f.message}`);
}
for (const [pair, d] of Object.entries(across)) {
  if ('skipped' in d) console.log(`${pair}: not compared. ${d.skipped}`);
  else
    console.log(
      `${pair}: ${d.differ} of ${d.values} values differ (largest ${d.largest.toExponential(2)} of a peak ${d.peak.toFixed(3)}, relative RMS ${d.relativeRms.toExponential(2)})`,
    );
}
type Rule = {
  measure: string;
  min: number | null;
  max: number | null;
  unit: string;
  met: boolean | null;
};
type Dim = { measures: Record<string, number | null>; rules: Rule[] };
// The checklist of each tier that rendered the whole clip, the same table for each (`score.ts`).
for (const [tier, r] of Object.entries(results)) {
  const scored = r as unknown as {
    checklist?:
      | { skipped: string }
      | { oneLayer: Record<string, Dim>; layered: Record<string, Dim> };
    events?: { oneLayer: number; layered: number };
  };
  if (scored.checklist === undefined) continue;
  if ('skipped' in scored.checklist) {
    console.log(`\n${tier}: no checklist. ${scored.checklist.skipped}`);
    continue;
  }
  const { oneLayer, layered } = scored.checklist;
  console.log(
    `\n${tier}: the eight dimensions: one-layer render (${scored.events!.oneLayer} events) | layered render (${scored.events!.layered} events)\n`,
  );
  console.log('| Dimension | Measure | One layer | Layered | Rule | One layer | Layered |');
  console.log('| --- | --- | ---: | ---: | --- | --- | --- |');
  for (const d of Object.keys(layered)) {
    const rules = new Map(layered[d]!.rules.map((r) => [r.measure, r]));
    for (const [m, v] of Object.entries(layered[d]!.measures)) {
      const o = oneLayer[d]!.measures[m];
      const rule = rules.get(m);
      const bound = rule ? `${rule.min ?? ''}..${rule.max ?? ''} ${rule.unit}` : '';
      const mark = (met: boolean | null | undefined): string =>
        met === undefined ? '' : met === null ? 'n/a' : met ? 'met' : 'fails';
      const other = oneLayer[d]!.rules.find((r) => r.measure === m);
      console.log(
        `| ${d} | ${m} | ${num(o, 3)} | ${num(v, 3)} | ${bound} | ${mark(other?.met)} | ${mark(rule?.met)} |`,
      );
    }
  }
}
console.log(`\nwrote ${outFile}`);

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
