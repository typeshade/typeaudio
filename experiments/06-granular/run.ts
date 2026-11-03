// Experiment 6, a granular scheduler on `push` and device-resident counts (docs/experiments.md,
// section 6).
//
//   bun run exp:06 [--tier cpu|webgpu|webgl2|all] [--blocks 1000] [--warmup 10] [--density 10000]
//                  [--capacity 2048] [--seed 1] [--arms fenced,again,stream,stamped] [--out <file.json>]
//
// It bundles the harness twice with Vite and the compiler's plugin: for Node, which it runs with
// the Node on PATH (the CPU tier; `NODE_BINARY` names another), and for a page, which it opens in
// headless Chromium with WebGPU and WebGL2 on SwiftShader (`TYPESHADE_CHROMIUM` names the binary),
// a fresh browser for each of the two tiers, one at a time. Each tier renders the same seed in
// each arm (`options.ts`). The runner holds the tiers' renders to one another, writes the result
// as JSON with the commit, the compiler pin and each device, keeps each tier's tape as raw `f32` in
// `experiments/06-granular/out/` (not committed), and prints a table for each tier. A number
// without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { ARMS, DEFAULTS, type Arm, type Options, type Row } from './options.ts';
import { diff, digest, fromBase64, listDiff, logDiff, type GrainFields } from './compare.ts';

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
const arms = (args.get('arms') ?? ARMS.join(',')).split(',') as Arm[];
for (const arm of arms) {
  if (!ARMS.includes(arm)) throw new Error(`run.ts: --arms takes ${ARMS.join(', ')}; got "${arm}".`);
}
const options: Omit<Options, 'tier'> = {
  blocks: whole('blocks', DEFAULTS.blocks),
  warmup: whole('warmup', DEFAULTS.warmup),
  block: whole('block', DEFAULTS.block),
  density: whole('density', DEFAULTS.density),
  capacity: whole('capacity', DEFAULTS.capacity),
  seed: whole('seed', DEFAULTS.seed),
  sr: whole('sr', DEFAULTS.sr),
  arms,
};
const outFile = args.get('out') ?? join(ROOT, 'experiments/06-granular/out/result.json');

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const cpu = cpus();
const record: Record<string, unknown> = {
  experiment: '06-granular',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  machine: {
    cpu: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    os: `${platform()} ${release()}`,
    bun: process.versions['bun'] ?? null,
  },
  options,
};

// The machine's load average over 1, 5 and 15 minutes, before and after each tier: another
// process that shares the machine shows here, and its load is in the numbers.
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

/** What a tier gives, as `harness.ts` (`Result`) and its entry write it. */
interface TierResult {
  readonly rows: Row[];
  readonly same: Record<string, { tape: { values: number; differ: number; largest: number }; log: number; list: number }>;
  tape?: string;
  readonly log: number[];
  list?: readonly GrainFields[];
  tapeDigest?: string;
  lastList?: { readonly grains: number; readonly digest: string };
}

const results: Record<string, TierResult> = {};
if (tiers.includes('cpu')) {
  const main = await bundle({ entry: 'experiments/06-granular/node.ts', outDir: 'experiments/06-granular/out/node', target: 'node' });
  const before = loadavg();
  results['cpu'] = JSON.parse(await runNode(await nodeBinary(), [main, JSON.stringify(options)])) as TierResult;
  loads['cpu'] = { before, after: loadavg() };
}
const pageTiers = tiers.filter((t): t is 'webgpu' | 'webgl2' => t !== 'cpu');
if (pageTiers.length > 0) {
  const page = await bundle({ entry: 'experiments/06-granular/browser.ts', outDir: 'experiments/06-granular/out/web', target: 'web' });
  // `browser.ts` sets `runGranular` on the page's global object.
  type Page = { runGranular(o: Options): Promise<unknown> };
  for (const tier of pageTiers) {
    const before = loadavg();
    results[tier] = (await inPage(dirname(page), (p) =>
      p.evaluate((o) => (globalThis as unknown as Page).runGranular(o), { ...options, tier }),
    )) as TierResult;
    loads[tier] = { before, after: loadavg() };
  }
}

// The tiers held to one another: the first arm's tape, log and last list of each.
const tapes = new Map<string, Float32Array>();
const lists = new Map<string, readonly GrainFields[]>();
const tapeDir = join(ROOT, 'experiments/06-granular/out');
await mkdir(tapeDir, { recursive: true });
await mkdir(dirname(outFile), { recursive: true });
for (const [tier, result] of Object.entries(results)) {
  const tape = fromBase64(result.tape!);
  tapes.set(tier, tape);
  lists.set(tier, result.list!);
  await writeFile(join(tapeDir, `${basename(outFile, '.json')}.${tier}.f32`), new Uint8Array(tape.buffer));
  result.tapeDigest = await digest(tape);
  result.lastList = {
    grains: result.list!.length,
    digest: await digest(new TextEncoder().encode(JSON.stringify(result.list))),
  };
  delete result.tape;
  delete result.list;
  record[tier] = result;
}
const across: Record<string, unknown> = {};
const names = Object.keys(results);
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const [a, b] = [names[i]!, names[j]!];
    across[`${a}-${b}`] = {
      tape: diff(tapes.get(a)!, tapes.get(b)!),
      log: logDiff(results[a]!.log, results[b]!.log),
      list: listDiff(lists.get(a)!, lists.get(b)!),
    };
  }
}
record['across'] = across;

await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
for (const tier of names) {
  const result = results[tier]!;
  const load = loads[tier]!;
  console.log(
    `\n${tier} (load average before ${load.before.map((x) => x.toFixed(2)).join(', ')}; after ${load.after.map((x) => x.toFixed(2)).join(', ')})\n\n${table(result.rows)}`,
  );
  for (const [arm, same] of Object.entries(result.same)) {
    console.log(
      `${arm} against ${result.rows[0]!.arm}: ${same.tape.differ} of ${same.tape.values} values differ (largest ${same.tape.largest}); log ${same.log} differ; list ${same.list} differ`,
    );
  }
}
for (const [pair, d] of Object.entries(across) as [string, { tape: { values: number; differ: number; largest: number }; log: number; list: number }][]) {
  console.log(`${pair}: ${d.tape.differ} of ${d.tape.values} values differ (largest ${d.tape.largest}); log ${d.log} differ; list ${d.list} differ`);
}
console.log(`\nwrote ${outFile}`);

/** The rows as a Markdown table. */
function table(rows: readonly Row[]): string {
  const ms = (v: number | undefined): string => (v === undefined ? '' : v.toFixed(3));
  const lines = [
    '| Arm | Tier | Blocks | Median (ms) | p99 (ms) | First (ms) | Max (ms) | Stream (ms/block) | GPU median (ms) | Alive (median) | Grains/s | Ordered | Dispatches | Submissions | Device reads |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | ---: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.arm} | ${r.tier} | ${r.blocks} | ${ms(r.ms.median)} | ${ms(r.ms.p99)} | ${ms(r.firstMs)} | ${ms(r.ms.max)} | ${ms(r.streamMs)} | ${ms(r.gpuMs?.median)} | ${r.alive.median} | ${r.grainsPerSecond.toFixed(0)} | ${r.ordered ? 'yes' : 'no'} | ${r.dispatches.join(', ')} | ${r.submissions.join(', ')} | ${r.deviceReads ?? ''} |`,
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
