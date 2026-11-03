// Experiment 4, a 10,000-partial additive render with the fuse report read (docs/experiments.md,
// section 4).
//
//   bun run exp:04 [--tier cpu|webgpu|webgl2|all] [--partials 10000] [--frames 1024]
//                  [--blocks 1000] [--warmup 10] [--variants gather,tree,scatter,host,f64,resident]
//                  [--sums yes|no] [--out <file.json>]
//
// It bundles the harness twice with Vite and the compiler's plugin, as experiment 1 does: for Node,
// which runs the CPU tier (when the tiers include it) and then the plain-JavaScript reference over
// the same blocks, and for a page, which it opens in headless Chromium with WebGPU and WebGL2 on
// SwiftShader (`TYPESHADE_CHROMIUM` names the binary), a fresh browser for each tier, one at a
// time. It holds every tier's blocks and bank to the reference, writes the result as JSON with the
// commit, the compiler pin and each device, and prints a table for each tier. A number without its
// record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import type { FuseReport } from 'typeshade/runtime';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { compare, fromBase64, type Comparison } from './compare.ts';
import { lanesInput, spec, sweepAt, VARIANTS, type Options, type Row, type Variant } from './options.ts';
import { coefficientErrors, type CoefficientErrors } from './design.ts';
import { designOf, keyOf, refSums } from './reference.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(`run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`);
  }
  args.set(key.slice(2), value);
}
const whole = (name: string, fallback: number, least = 1): number => {
  const v = Number(args.get(name) ?? fallback);
  if (!Number.isInteger(v) || v < least) throw new Error(`run.ts: --${name} takes a whole number of ${least} or more.`);
  return v;
};
const tiers = (args.get('tier') ?? 'all') === 'all' ? ['cpu', 'webgpu', 'webgl2'] : [args.get('tier')!];
for (const tier of tiers) {
  if (!['cpu', 'webgpu', 'webgl2'].includes(tier)) throw new Error(`run.ts: --tier takes cpu, webgpu, webgl2 or all; got "${tier}".`);
}
const variants = (args.get('variants') ?? VARIANTS.join(',')).split(',') as Variant[];
for (const v of variants) {
  if (!VARIANTS.includes(v)) throw new Error(`run.ts: --variants takes ${VARIANTS.join(', ')}; got "${v}".`);
}
const options: Omit<Options, 'tier'> = {
  partials: whole('partials', 10000),
  frames: whole('frames', 1024),
  blocks: whole('blocks', 1000),
  warmup: whole('warmup', 10),
  variants,
  sums: (args.get('sums') ?? 'yes') === 'yes',
};
const outFile = args.get('out') ?? join(ROOT, 'experiments/04-additive/out/result.json');
const dir = join(ROOT, 'experiments/04-additive/out');
await mkdir(dir, { recursive: true });

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const record: Record<string, unknown> = {
  experiment: '04-additive',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  tools: { bun: process.versions['bun'], vite: pkg.devDependencies['vite'], playwright: pkg.devDependencies['playwright-core'] },
  options,
};

// The machine's load average over 1, 5 and 15 minutes, before and after each arm: another process
// that shares the machine shows here, and its load is in the numbers.
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

// Node first: the CPU tier, when asked, and the reference that every tier is held to. A run of the
// GPU tiers alone reuses the reference blocks an earlier run wrote for the same sources of the
// reference, the same bank and as many blocks (`reference.json` says which), and has Node compute
// only the ones it lacks. A run with the CPU tier computes every one, in the process that runs it.
interface Stamp {
  readonly sources: string;
  readonly partials: number;
  readonly frames: number;
  readonly total: number;
  readonly keys: readonly string[];
}
const hash = createHash('sha256');
for (const f of ['experiments/04-additive/reference.ts', 'experiments/04-additive/design.ts', 'experiments/04-additive/options.ts', 'test/reference.ts']) {
  hash.update(await readFile(join(ROOT, f)));
}
const sources = hash.digest('hex');
const earlier = (await readFile(join(dir, 'reference.json'), 'utf8').then(JSON.parse, () => undefined)) as Stamp | undefined;
const valid =
  earlier !== undefined &&
  earlier.sources === sources &&
  earlier.partials === options.partials &&
  earlier.frames === options.frames &&
  earlier.total === options.warmup + options.blocks;
const missing = tiers.includes('cpu') || !valid ? variants : variants.filter((v) => !earlier!.keys.includes(keyOf(v)));
record['reference'] = { sources, reused: variants.filter((v) => !missing.includes(v)), computed: missing };
if (tiers.includes('cpu') || missing.length > 0) {
  const main = await bundle({ entry: 'experiments/04-additive/node.ts', outDir: 'experiments/04-additive/out/node', target: 'node' });
  const before = loadavg();
  const cpu = JSON.parse(
    await runNode(await nodeBinary(), [main, JSON.stringify(options), dir, tiers.includes('cpu') ? 'cpu' : 'none', JSON.stringify(missing)]),
  );
  loads['node'] = { before, after: loadavg() };
  (record['reference'] as Record<string, unknown>)['ms'] = cpu.referenceMs;
  if (tiers.includes('cpu')) record['cpu'] = cpu;
  const keys = [...new Set([...(valid ? earlier!.keys : []), ...missing.map(keyOf)])];
  const stamp: Stamp = { sources, partials: options.partials, frames: options.frames, total: options.warmup + options.blocks, keys };
  await writeFile(join(dir, 'reference.json'), `${JSON.stringify(stamp, null, 2)}\n`);
}
// The coefficients each bank holds at the end are the last block's: held to the design in doubles.
const specs = spec(options.partials);
const lastSweep = sweepAt(options.warmup + options.blocks - 1);
const refOut = new Map<Variant, Float32Array>();
const refState = new Map<Variant, Float32Array>();
for (const v of variants) {
  refOut.set(v, await readF32(join(dir, `reference-${keyOf(v)}.f32`)));
  refState.set(v, await readF32(join(dir, `reference-state-${designOf(v)}.f32`)));
}
if (record['cpu'] !== undefined) {
  const cpu = record['cpu'] as { variants: Record<string, Record<string, unknown>> };
  for (const [variant, held] of Object.entries(cpu.variants)) {
    if ('error' in held) continue;
    held['coefficients'] = coefficientErrors(await readF32(join(dir, `cpu-${variant}-state.f32`)), specs, lastSweep);
  }
}
// The reference's own banks, the floor each tier's coefficients are measured against.
record['referenceCoefficients'] = Object.fromEntries(
  [...new Set(variants.map(designOf))].map((d) => [d, coefficientErrors(refState.get(variants.find((v) => designOf(v) === d)!)!, specs, lastSweep)]),
);

const pageTiers = tiers.filter((t): t is 'webgpu' | 'webgl2' => t !== 'cpu');
if (pageTiers.length > 0) {
  const page = await bundle({ entry: 'experiments/04-additive/browser.ts', outDir: 'experiments/04-additive/out/web', target: 'web' });
  // `browser.ts` sets `runAdditive` on the page's global object.
  type Page = { runAdditive(o: Options): Promise<PageResult> };
  for (const tier of pageTiers) {
    const before = loadavg();
    const got = await inPage(dirname(page), (p) =>
      p.evaluate((o) => (globalThis as unknown as Page).runAdditive(o), { ...options, tier }),
    );
    loads[tier] = { before, after: loadavg() };
    const held: Record<string, unknown> = {};
    for (const [variant, r] of Object.entries(got.variants) as [Variant, PageVariant][]) {
      if (r.error !== undefined) {
        held[variant] = { error: r.error };
        continue;
      }
      const out = fromBase64(r.out);
      const state = fromBase64(r.state);
      // The tier's blocks and bank beside the reference's, for a closer look than the record's.
      await writeFile(join(dir, `${tier}-${variant}.f32`), new Uint8Array(out.buffer));
      await writeFile(join(dir, `${tier}-${variant}-state.f32`), new Uint8Array(state.buffer));
      const ref = refOut.get(variant)!;
      held[variant] = {
        row: r.row,
        report: r.report,
        out: compare(out, ref),
        state: compare(state, refState.get(variant)!),
        coefficients: coefficientErrors(state, specs, lastSweep),
        peaksSame: r.peaks.filter((p, b) => p === blockPeak(ref, b, options.frames)).length,
      };
    }
    let sums: unknown;
    if (got.sums !== undefined) {
      const want = refSums(lanesInput(options.partials, options.frames), options.partials, options.frames);
      sums = {
        gather: compare(fromBase64(got.sums.gather), want.gather),
        tree: compare(fromBase64(got.sums.tree), want.tree),
        scatter: compare(fromBase64(got.sums.scatter), want.tree),
        reports: got.sums.reports,
      };
    }
    record[tier] = {
      environment: got.environment,
      info: got.info,
      skipped: got.skipped,
      variants: held,
      ...(sums === undefined ? {} : { sums }),
      ...(got.tiers === undefined ? {} : { tiers: got.tiers }),
    };
  }
}

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
for (const tier of tiers) {
  const result = record[tier] as { variants: Record<string, Held | { error: string }> };
  const load = loads[tier === 'cpu' ? 'node' : tier]!;
  console.log(`\n${tier} (load average before ${load.before.map((x) => x.toFixed(2)).join(', ')}; after ${load.after.map((x) => x.toFixed(2)).join(', ')})\n`);
  const ran = Object.values(result.variants).filter((h): h is Held => !('error' in h));
  console.log(table(ran));
  for (const [variant, held] of Object.entries(result.variants)) {
    console.log(`\n${variant}: ${'error' in held ? `failed: ${held.error}` : groups(held.report)}`);
    if (!('error' in held) && held.coefficients !== undefined) console.log(`  ${coefficients(held.coefficients)}`);
    if (!('error' in held) && held.row.groupGpuMs !== undefined) {
      console.log(`  GPU time per group, mean of the timed blocks: ${held.row.groupGpuMs.map((x) => `${x.toFixed(3)} ms`).join(', ')}`);
    }
  }
  const probe = (record[tier] as { tiers?: Record<string, string> }).tiers;
  if (probe !== undefined) {
    console.log(`\neach kernel alone, the tier its scope's report names: ${Object.entries(probe).map(([k, t]) => `${k} ${t}`).join(', ')}`);
  }
  const sums = (record[tier] as { sums?: Record<'gather' | 'tree' | 'scatter', Comparison> }).sums;
  if (sums !== undefined) {
    console.log('\nthe sums alone, on fixed lanes, against the plain-JavaScript sum of the same order:');
    for (const k of ['gather', 'tree', 'scatter'] as const) {
      console.log(`  ${k}: ${sums[k].same} of ${sums[k].count} the same bits, largest difference ${sums[k].maxAbs.toExponential(3)}, ${sums[k].maxUlp} ULP`);
    }
  }
}
for (const [design, c] of Object.entries(record['referenceCoefficients'] as Record<string, CoefficientErrors>)) {
  console.log(`\nthe reference's ${design} design: ${coefficients(c)}`);
}
console.log(`\nwrote ${outFile}`);

interface PageVariant {
  readonly error?: string;
  readonly row: Row;
  readonly report: FuseReport;
  readonly out: string;
  readonly state: string;
  readonly peaks: number[];
}
interface PageResult {
  readonly environment: unknown;
  readonly info: unknown;
  readonly skipped: unknown;
  readonly variants: Record<string, PageVariant>;
  readonly sums?: { gather: string; tree: string; scatter: string; reports: unknown };
  readonly tiers?: Record<string, string>;
}
interface Held {
  readonly row: Row;
  readonly report: FuseReport;
  readonly out: Comparison;
  readonly state: Comparison;
  readonly peaksSame: number;
  readonly coefficients?: CoefficientErrors;
}

/** A bank's coefficients against the design in doubles, in one line. */
function coefficients(c: CoefficientErrors): string {
  const names = ['b0', 'b1', 'b2', 'a1', 'a2'];
  return `coefficients at the last sweep (${c.sweep.toFixed(4)}), against the design in doubles: largest relative error ${c.maxRel.map((x, k) => `${names[k]} ${x.toExponential(2)}`).join(', ')}; largest absolute error ${c.maxAbs.map((x, k) => `${names[k]} ${x.toExponential(2)}`).join(', ')}; worst b0 at partial ${c.worst.partial}, cutoff ${c.worst.cutoff.toFixed(2)} Hz; ${c.closeB0} b0 within 2^-20; cutoff off by up to ${(c.maxCutoffError * 100).toPrecision(3)} %; gain at 0 Hz off by up to ${c.maxDcError.toExponential(2)}`;
}

function blockPeak(ref: Float32Array, b: number, frames: number): number {
  let m = 0;
  for (let n = 0; n < frames; n++) m = Math.max(m, Math.abs(ref[b * frames + n]!));
  return m;
}

async function readF32(file: string): Promise<Float32Array> {
  const bytes = await readFile(file);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

/** The rows as a Markdown table, with how close each variant's blocks are to the reference. */
function table(held: readonly Held[]): string {
  const ms = (v: number | undefined): string => (v === undefined ? '' : v.toFixed(3));
  const lines = [
    '| Variant | Tier | Partials | Frames | Blocks | Median (ms) | p99 (ms) | First (ms) | Min (ms) | Max (ms) | GPU (ms) | Dispatches | Submissions | Same bits | Max abs diff | Max ULP |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const { row: r, out } of held) {
    const span = (s: readonly [number, number]): string => (s[0] === s[1] ? `${s[0]}` : `${s[0]} to ${s[1]}`);
    lines.push(
      `| ${r.variant} | ${r.tier} | ${r.partials} | ${r.frames} | ${r.blocks} | ${ms(r.medianMs)} | ${ms(r.p99Ms)} | ${ms(r.firstMs)} | ${ms(r.minMs)} | ${ms(r.maxMs)} | ${ms(r.gpuMs)} | ${span(r.dispatches)} | ${span(r.submissions)} | ${out.same} of ${out.count} | ${out.maxAbs.toExponential(3)} | ${out.maxUlp} |`,
    );
  }
  return lines.join('\n');
}

/** The groups of a report in one line each: the calls, fused or not, the dispatch shapes, the why. */
function groups(report: FuseReport): string {
  const calls = (c: readonly string[]): string => {
    // A run of one name, `sumFrame` once per frame, is shown once with its count.
    const out: string[] = [];
    for (let i = 0; i < c.length; ) {
      let j = i;
      while (j < c.length && c[j] === c[i]) j++;
      out.push(j - i > 1 ? `${c[i]} x${j - i}` : c[i]!);
      i = j;
    }
    return out.join(' + ');
  };
  const lines = [`${report.tier}, ${report.dispatches} dispatches, ${report.submissions} submissions, ${report.groups.length} groups`];
  let i = 0;
  while (i < report.groups.length) {
    const g = report.groups[i]!;
    let j = i + 1;
    while (j < report.groups.length && JSON.stringify(report.groups[j]!.calls) === JSON.stringify(g.calls) && report.groups[j]!.fused === g.fused) j++;
    const times = j - i > 1 ? ` (x${j - i} groups alike)` : '';
    lines.push(
      `  ${calls(g.calls)}${g.fused ? ' (fused)' : ''}${times}${g.workgroupShapes ? ` shapes ${JSON.stringify(g.workgroupShapes)}` : ''}${g.gpuTime !== undefined ? ` gpu ${(g.gpuTime / 1e6).toFixed(3)} ms` : ''}${g.why ? `\n    why: ${g.why}` : ''}`,
    );
    i = j;
  }
  return lines.join('\n');
}

/** The Node binary on PATH: the first `node` that is not Bun's alias of itself. */
async function nodeBinary(): Promise<string> {
  const named = process.env['NODE_BINARY'];
  if (named) return named;
  for (const d of (process.env['PATH'] ?? '').split(delimiter)) {
    const candidate = join(d, 'node');
    const real = await realpath(candidate).catch(() => undefined);
    if (real !== undefined && !/(^|[/\\])bun(\.exe)?$/.test(real)) return candidate;
  }
  throw new Error('run.ts: found no Node on PATH, only Bun. Install Node 22, or name it with NODE_BINARY.');
}

/** Runs Node on `argv` and resolves to its stdout; its stderr is this process's. */
function runNode(node: string, argv: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(node, ['--max-old-space-size=8192', ...argv], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(`node exited with ${code}`))));
  });
}
