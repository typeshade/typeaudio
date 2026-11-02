// Experiment 1, the round trip per block size (docs/experiments.md, section 1).
//
//   bun run exp:01 [--tier cpu|webgpu|webgl2|all] [--blocks 1000] [--warmup 10] [--budget 20]
//                  [--voices 64] [--out <file.json>]
//
// It bundles the harness twice with Vite and the compiler's plugin: for Node, which it runs with
// the Node on PATH (the CPU tier; `NODE_BINARY` names another), and for a page, which it opens in
// headless Chromium with WebGPU and WebGL2 on SwiftShader (`TYPESHADE_CHROMIUM` names the binary),
// a fresh browser for each of the two tiers. It writes
// the result as JSON, with the commit, the compiler pin and each device, and prints a table for
// each tier. A number without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { SIZES, VARIANTS, type Options, type Row, type Variant } from './options.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(`run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`);
  }
  args.set(key.slice(2), value);
}
const whole = (name: string, fallback: number): number => {
  const v = Number(args.get(name) ?? fallback);
  if (!Number.isInteger(v) || v < 1) throw new Error(`run.ts: --${name} takes a whole number of 1 or more.`);
  return v;
};
const tiers = (args.get('tier') ?? 'all') === 'all' ? ['cpu', 'webgpu', 'webgl2'] : [args.get('tier')!];
for (const tier of tiers) {
  if (!['cpu', 'webgpu', 'webgl2'].includes(tier)) throw new Error(`run.ts: --tier takes cpu, webgpu, webgl2 or all; got "${tier}".`);
}
const options: Omit<Options, 'tier'> = {
  blocks: whole('blocks', 1000),
  warmup: whole('warmup', 10),
  sizes: (args.get('sizes') ?? SIZES.join(',')).split(',').map(Number),
  variants: (args.get('variants') ?? VARIANTS.join(',')).split(',') as Variant[],
  budgetMs: whole('budget', 20),
  voices: whole('voices', 64),
};
const outFile = args.get('out') ?? join(ROOT, 'experiments/01-round-trip/out/result.json');

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const record: Record<string, unknown> = {
  experiment: '01-round-trip',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  options,
};

// The machine's load average over 1, 5 and 15 minutes, before and after each arm: another
// process that shares the machine shows here, and its load is in the numbers.
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

if (tiers.includes('cpu')) {
  const main = await bundle({ entry: 'experiments/01-round-trip/node.ts', outDir: 'experiments/01-round-trip/out/node', target: 'node' });
  const before = loadavg();
  record['cpu'] = JSON.parse(await runNode(await nodeBinary(), [main, JSON.stringify(options)]));
  loads['cpu'] = { before, after: loadavg() };
}
const pageTiers = tiers.filter((t): t is 'webgpu' | 'webgl2' => t !== 'cpu');
if (pageTiers.length > 0) {
  const page = await bundle({ entry: 'experiments/01-round-trip/browser.ts', outDir: 'experiments/01-round-trip/out/web', target: 'web' });
  // `browser.ts` sets `runExperiment` on the page's global object.
  type Page = { runExperiment(o: Options): Promise<unknown> };
  for (const tier of pageTiers) {
    const before = loadavg();
    record[tier] = await inPage(dirname(page), (p) =>
      p.evaluate((o) => (globalThis as unknown as Page).runExperiment(o), { ...options, tier }),
    );
    loads[tier] = { before, after: loadavg() };
  }
}

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
for (const tier of tiers) {
  const result = record[tier] as { rows: Row[] };
  const load = loads[tier]!;
  console.log(`\n${tier} (load average before ${load.before.map((x) => x.toFixed(2)).join(', ')}; after ${load.after.map((x) => x.toFixed(2)).join(', ')})\n\n${table(result.rows)}`);
}
console.log(`\nwrote ${outFile}`);

/** The rows as a Markdown table. */
function table(rows: readonly Row[]): string {
  const ms = (v: number | undefined): string => (v === undefined ? '' : v.toFixed(3));
  const lines = [
    '| Variant | Tier | Frames | Block (ms at 48 kHz) | Median (ms) | p99 (ms) | First (ms) | Min (ms) | Max (ms) | Fenced chunk (ms) | GPU (ms) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.variant} | ${r.tier} | ${r.frames} | ${((r.frames / 48000) * 1000).toFixed(2)} | ${ms(r.medianMs)} | ${ms(r.p99Ms)} | ${ms(r.firstMs)} | ${ms(r.minMs)} | ${ms(r.maxMs)} | ${ms(r.chunkMs)} | ${ms(r.gpuMs)} |`,
    );
  }
  return lines.join('\n');
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
  throw new Error('run.ts: found no Node on PATH, only Bun. Install Node 22, or name it with NODE_BINARY.');
}

/** Runs Node on `argv` and resolves to its stdout; its stderr is this process's. */
function runNode(node: string, argv: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(node, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(`node exited with ${code}`))));
  });
}
