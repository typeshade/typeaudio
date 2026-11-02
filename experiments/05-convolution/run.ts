// Experiment 5, a 10-second partitioned convolution (docs/experiments.md, section 5).
//
//   bun run exp:05 [--tier all|cpu,oracle,webgpu,webgl2]
//                  [--blocks webgpu=1000,webgl2=50,oracle=3]
//                  [--tails webgpu=full+jump,webgl2=jump,oracle=jump]
//                  [--levels full,quiet] [--timeout 60] [--prepare-timeout 900]
//                  [--spectra yes|no] [--out <file.json>] [--raw <file.json>]
//
// The convolution is uniform and partitioned, by overlap-add: an impulse response of 10 seconds at
// 48 kHz (`signals.ts`, 480,000 frames) in 469 partitions of 1,024 frames, each transformed once by
// the 2,048-point FFT entry of experiment 3 (`fftMediumTable`), and each block of 1,024 input frames
// padded, transformed, stored in the frequency-domain delay line, multiplied and summed over the
// partitions, transformed back and overlap-added (`convolution.shade.ts`). Four arms:
//
// - `cpu`: the host face's CPU tier, in Node: the harness bundled with Vite and the compiler's
//   plugin, run with the Node on PATH (`NODE_BINARY` names another). At the pin it refuses the FFT
//   entry, which reaches a barrier; it runs the kernel check: each kernel function once, on seeded
//   inputs, and one block as a fuse plan on a CPU device.
// - `oracle`: the compiler's oracle, in this process (Bun): the FFT entry by `dispatch` at `f32`
//   precision, the kernel functions through `fns` (`oracle.ts`). It runs a call of the FFT entry in
//   about 1.4 seconds, so it runs fewer blocks than the page arms.
// - `webgpu` and `webgl2`: the harness bundled for a page, opened in headless Chromium with WebGPU
//   and WebGL2 on SwiftShader (`TYPESHADE_CHROMIUM` names the binary), a fresh browser for each.
//   Each block is one `dev.fuse` plan.
//
// `--blocks` sets the noise blocks each arm times, from the first: `arm=n` pairs, or one number for
// every arm. `--tails` sets how each arm runs the impulses' tails: `full`, every one of the 469
// blocks; `jump`, block 0 and then the blocks from 420 (`signals.ts`, `JUMP_FROM`); `full+jump`,
// both, which holds the jump to the full run bit for bit. `--levels` names the impulses: `full`, at
// 1, and `quiet`, at 2^-112, whose tail reaches the subnormals. `--timeout` bounds one block on a page
// arm, in seconds, and `--prepare-timeout` the transform of the partitions. `--spectra no` leaves
// out the comparison of the partitions' spectra, 7.3 MiB an arm.
//
// It holds every output to an `f64` reference and the arms to one another over the last second of
// the impulse's tail, counts the subnormals, reads the fuse reports, the device's statistics and
// `compile().determinism`, writes the result as JSON (`--out`; the outputs themselves to `--raw`)
// and prints the tables. A number without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { buildInfo } from 'typeshade';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { accuracy, fft64, fromBase64, subnormals, toBase64, twiddleTable, flushed, ulp32 } from '../03-fft/signals.ts';
import type { KernelCheck, Options, Result, Tail, TailRun, Timing } from './harness.ts';
import { oracleOf, pairs } from './oracle.ts';
import {
  CHECK_HEAD,
  CHECK_SLOT,
  FRAMES,
  IR_FRAMES,
  JUMP_FROM,
  LEVELS,
  PARTITIONS,
  POINTS,
  TAIL_BLOCKS,
  TAIL_END,
  TAIL_FIRST_BLOCK,
  TAIL_START,
  checkInputs,
  convolve64,
  impulseBlock,
  impulseReference,
  impulseResponse,
  noise,
  paddedPartitions,
  tailAccuracy,
  tailAgreement,
  type Level,
} from './signals.ts';

const ARMS = ['cpu', 'oracle', 'webgpu', 'webgl2'] as const;
type Arm = (typeof ARMS)[number];
const TAILS = ['full', 'jump'] as const;
const LEVEL_NAMES = Object.keys(LEVELS) as Level[];

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(`run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`);
  }
  args.set(key.slice(2), value);
}
const listOf = <T extends string>(name: string, all: readonly T[]): T[] => {
  const given = args.get(name);
  if (given === undefined || given === 'all') return [...all];
  const values = given.split(',') as T[];
  for (const v of values) {
    if (!all.includes(v)) throw new Error(`run.ts: --${name} takes ${all.join(', ')} or all; got "${v}".`);
  }
  return values;
};
/** `arm=value` pairs, or one value for every arm, over `defaults`. */
const perArm = <T>(name: string, defaults: Record<Arm, T>, parse: (v: string) => T): Record<Arm, T> => {
  const given = args.get(name);
  const out = { ...defaults };
  if (given === undefined) return out;
  if (!given.includes('=')) {
    for (const arm of ARMS) out[arm] = parse(given);
    return out;
  }
  for (const pair of given.split(',')) {
    const [arm, value] = pair.split('=') as [Arm, string | undefined];
    if (!ARMS.includes(arm) || value === undefined) throw new Error(`run.ts: --${name} takes arm=value pairs; got "${pair}".`);
    out[arm] = parse(value);
  }
  return out;
};
const whole = (name: string, min: number) => (v: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new Error(`run.ts: --${name} takes a whole number of ${min} or more; got "${v}".`);
  return n;
};
const arms = listOf<Arm>('tier', ARMS);
const blocks = perArm('blocks', { cpu: 0, oracle: 3, webgpu: 1000, webgl2: 50 }, whole('blocks', 0));
const tails = perArm<Tail[]>('tails', { cpu: [], oracle: ['jump'], webgpu: ['full', 'jump'], webgl2: ['jump'] }, (v) => {
  const modes = v.split('+') as Tail[];
  for (const m of modes) if (!TAILS.includes(m)) throw new Error(`run.ts: --tails takes full, jump or full+jump; got "${v}".`);
  return modes;
});
const levels = listOf<Level>('levels', LEVEL_NAMES);
const timeout = whole('timeout', 1)(args.get('timeout') ?? '60');
const prepareTimeout = whole('prepare-timeout', 1)(args.get('prepare-timeout') ?? '900');
const withSpectra = (args.get('spectra') ?? 'yes') !== 'no';
const outFile = args.get('out') ?? join(ROOT, 'experiments/05-convolution/out/result.json');
const rawFile = args.get('raw') ?? join(ROOT, 'experiments/05-convolution/out/raw.json');
const optionsOf = (arm: Arm): Options => ({
  tier: arm === 'oracle' ? 'cpu' : arm,
  blocks: blocks[arm],
  levels,
  tails: tails[arm],
  timeoutMs: timeout * 1000,
  prepareTimeoutMs: prepareTimeout * 1000,
  spectra: withSpectra,
});

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const versionOf = async (pkg: string): Promise<string> =>
  (JSON.parse(await readFile(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')) as { version: string }).version;
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const started = Date.now();
const record: Record<string, unknown> = {
  experiment: '05-convolution',
  date: new Date(started).toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  compiler: buildInfo,
  tools: {
    bun: process.versions['bun'] ?? null,
    vite: await versionOf('vite'),
    'playwright-core': await versionOf('playwright-core'),
  },
  options: { arms, blocks, tails, levels, timeout, prepareTimeout, spectra: withSpectra },
  sizes: { FRAMES, POINTS, IR_FRAMES, PARTITIONS, TAIL_START, TAIL_END, TAIL_FIRST_BLOCK, TAIL_BLOCKS, JUMP_FROM, levels: LEVELS },
};

// The machine's load average over 1, 5 and 15 minutes, before and after each arm: another process
// that shares the machine shows here. It bears on the times, not on the bits.
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

const fftSource = await readFile(join(ROOT, 'experiments/03-fft/fft.shade.ts'), 'utf8');
const convSource = await readFile(join(ROOT, 'experiments/05-convolution/convolution.shade.ts'), 'utf8');

type ArmResult = Result & { environment?: unknown };
const results: Partial<Record<Arm, ArmResult>> = {};
/** The page's console lines that repeated, with their counts. */
const consoles: Record<string, { line: string; count: number }[]> = {};
record['consoles'] = consoles;
/** An arm whose run failed as a whole, with the sentence. */
const failures: Record<string, string> = {};
record['failures'] = failures;
/** The wall time of each arm, in seconds. */
const durations: Record<string, number> = {};
record['durations'] = durations;

if (arms.includes('cpu')) {
  const t = Date.now();
  const main = await bundle({ entry: 'experiments/05-convolution/node.ts', outDir: 'experiments/05-convolution/out/node', target: 'node' });
  const before = loadavg();
  try {
    results.cpu = JSON.parse(await runNode(await nodeBinary(), [main, JSON.stringify(optionsOf('cpu'))])) as ArmResult;
  } catch (e) {
    failures['cpu'] = String(e);
    console.error(`cpu: ${String(e)}`);
  }
  loads['cpu'] = { before, after: loadavg() };
  durations['cpu'] = (Date.now() - t) / 1000;
}

const pageTiers = arms.filter((a): a is 'webgpu' | 'webgl2' => a === 'webgpu' || a === 'webgl2');
if (pageTiers.length > 0) {
  const page = await bundle({ entry: 'experiments/05-convolution/browser.ts', outDir: 'experiments/05-convolution/out/web', target: 'web' });
  // `browser.ts` sets `runConvolution` on the page's global object.
  type Page = { runConvolution(o: Options): Promise<ArmResult> };
  for (const tier of pageTiers) {
    const t = Date.now();
    const before = loadavg();
    // The page's console, each distinct line printed once and counted.
    const seen = new Map<string, number>();
    // The page bounds each block (`timeoutMs`); this bounds the page, in case its script stops
    // yielding. The browser is closed on either way out.
    const o = optionsOf(tier);
    const runs = o.blocks + levels.length * o.tails.reduce((s, m) => s + (m === 'full' ? TAIL_BLOCKS : TAIL_BLOCKS - JUMP_FROM + 1), 0) + 10;
    const limit = o.prepareTimeoutMs + o.timeoutMs * runs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      results[tier] = await inPage(
        dirname(page),
        (p) =>
          Promise.race([
            p.evaluate((options) => (globalThis as unknown as Page).runConvolution(options), o),
            new Promise<never>((_, fail) => {
              timer = setTimeout(() => fail(new Error(`the page did not return within ${String(limit / 1000)} s`)), limit);
            }),
          ]),
        (line) => {
          const n = (seen.get(line) ?? 0) + 1;
          seen.set(line, n);
          if (n === 1) console.error(line);
        },
      );
    } catch (e) {
      failures[tier] = String(e);
      console.error(`${tier}: ${String(e)}`);
    } finally {
      clearTimeout(timer);
    }
    consoles[tier] = [...seen].filter(([, n]) => n > 1).map(([line, count]) => ({ line, count }));
    loads[tier] = { before, after: loadavg() };
    durations[tier] = (Date.now() - t) / 1000;
  }
}

const h = impulseResponse();
const padded = paddedPartitions(h);
let oracleChecks: Record<string, Float32Array> | undefined;
let determinism: unknown;
if (arms.includes('oracle')) {
  const t = Date.now();
  const before = loadavg();
  const oracle = oracleOf(fftSource, convSource);
  determinism = oracle.determinism;
  const o = optionsOf('oracle');
  let start = performance.now();
  const spectra = oracle.prepare(padded, twiddleTable(POINTS));
  const prepareMs = performance.now() - start;
  console.error(`oracle the transform of ${PARTITIONS} partitions: ${prepareMs.toFixed(0)} ms`);
  const x = noise(o.blocks);
  const y = new Float32Array(o.blocks * FRAMES);
  const timings: Timing[] = [];
  oracle.reset();
  for (let k = 0; k < o.blocks; k++) {
    start = performance.now();
    y.set(oracle.block(k, x.subarray(k * FRAMES, (k + 1) * FRAMES)), k * FRAMES);
    timings.push({ ms: performance.now() - start });
    console.error(`oracle noise block ${k}: ${timings[k]!.ms.toFixed(0)} ms`);
  }
  const runs: TailRun[] = [];
  for (const level of levels) {
    for (const tail of o.tails) {
      oracle.reset();
      const order = tail === 'full'
        ? Array.from({ length: TAIL_BLOCKS }, (_, k) => k)
        : [0, ...Array.from({ length: TAIL_BLOCKS - JUMP_FROM }, (_, i) => JUMP_FROM + i)];
      const out = new Float32Array((TAIL_BLOCKS - TAIL_FIRST_BLOCK) * FRAMES);
      const ms: number[] = [];
      for (const k of order) {
        start = performance.now();
        const b = oracle.block(k, impulseBlock(k, LEVELS[level]));
        ms.push(performance.now() - start);
        if (k >= TAIL_FIRST_BLOCK) out.set(b, (k - TAIL_FIRST_BLOCK) * FRAMES);
      }
      runs.push({ level, tail, blocks: order.length, output: toBase64(out), ms });
      console.error(`oracle the ${level} impulse's tail, ${tail}: ${order.length} blocks, ${(ms.reduce((s, v) => s + v, 0) / 1000).toFixed(0)} s`);
    }
  }
  // The kernel check on the oracle: the same seeded inputs as the tiers'.
  const i = checkInputs();
  const checks: Record<string, Float32Array> = {};
  {
    const p = pairs(new Float32Array(POINTS * 2));
    oracle.call('pad', p, Array.from(i.input));
    checks['pad'] = Float32Array.from(p.flat());
    const line = pairs(i.line);
    oracle.call('store', line, pairs(i.spectrum), CHECK_SLOT);
    checks['store'] = Float32Array.from(line.slice(CHECK_SLOT * POINTS, (CHECK_SLOT + 1) * POINTS).flat());
    const sum = pairs(new Float32Array(POINTS * 2));
    oracle.call('accumulate', sum, pairs(i.line), pairs(i.spectra), CHECK_HEAD, PARTITIONS);
    checks['accumulate'] = Float32Array.from(sum.flat());
    const out = new Array<number>(FRAMES).fill(0);
    const tail = Array.from(i.tail);
    oracle.call('overlapAdd', out, tail, pairs(i.block));
    checks['overlapAdd'] = Float32Array.from([...out, ...tail]);
  }
  oracleChecks = checks;
  const cpu = cpus();
  results.oracle = {
    tier: 'cpu',
    environment: { bun: process.versions['bun'], cpu: cpu[0]?.model ?? 'unknown', cores: cpu.length, os: `${platform()} ${release()}` },
    prepare: { ms: prepareMs, ...(withSpectra ? { spectra: toBase64(spectra) } : {}) },
    timings,
    noise: toBase64(y),
    tails: runs,
    checks: [],
  };
  loads['oracle'] = { before, after: loadavg() };
  durations['oracle'] = (Date.now() - t) / 1000;
}
if (determinism === undefined) {
  const { compile } = await import('typeshade');
  determinism = { fft: compile(fftSource).determinism, convolution: compile(convSource).determinism };
}
record['determinism'] = determinism;

// ---- The comparison ----

const present = arms.filter((a) => results[a] !== undefined);
const raw: Record<string, unknown> = {};
const stats = (xs: readonly number[]): { median: number; p95: number; min: number; max: number; mean: number; n: number } | undefined => {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const rank = (p: number): number => s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)]!;
  return { median: rank(50), p95: rank(95), min: s[0]!, max: s[s.length - 1]!, mean: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length };
};

// 1. The transform of the partitions, against the f64 transform and between the arms.
const spectraOf = new Map<Arm, Float32Array>();
for (const arm of present) {
  const s = results[arm]!.prepare?.spectra;
  if (s !== undefined) spectraOf.set(arm, fromBase64(s));
}
const spectraRows: Record<string, unknown>[] = [];
const spectraPairs: Record<string, unknown>[] = [];
if (spectraOf.size > 0) {
  const reference = fft64(padded, POINTS, 'forward');
  const span = 2 * POINTS;
  for (const [arm, y] of spectraOf) {
    let maxPeakUlp = 0;
    let meanPeakUlp = 0;
    let err = 0;
    let ref = 0;
    let exact = 0;
    for (let p = 0; p < PARTITIONS; p++) {
      const part = y.subarray(p * span, (p + 1) * span);
      const r = reference.subarray(p * span, (p + 1) * span);
      const a = accuracy(part, r);
      maxPeakUlp = Math.max(maxPeakUlp, a.maxPeakUlp);
      meanPeakUlp += a.meanPeakUlp / PARTITIONS;
      exact += a.exact;
      for (let i = 0; i < span; i++) {
        err += (part[i]! - r[i]!) ** 2;
        ref += r[i]! ** 2;
      }
    }
    const sub = subnormals(y);
    spectraRows.push({ arm, maxPeakUlp, meanPeakUlp, relRms: Math.sqrt(err / ref), exact, count: y.length, ...sub });
  }
  const names = [...spectraOf.keys()];
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      const ya = spectraOf.get(names[a]!)!;
      const yb = spectraOf.get(names[b]!)!;
      const ua = new Uint32Array(ya.buffer, ya.byteOffset, ya.length);
      const ub = new Uint32Array(yb.buffer, yb.byteOffset, yb.length);
      let differ = 0;
      let partitionsDiffer = 0;
      let largest = 0;
      for (let p = 0; p < PARTITIONS; p++) {
        let here = 0;
        for (let i = p * 2 * POINTS; i < (p + 1) * 2 * POINTS; i++) {
          if (ua[i] !== ub[i]) {
            here++;
            largest = Math.max(largest, Math.abs(ya[i]! - yb[i]!));
          }
        }
        differ += here;
        if (here > 0) partitionsDiffer++;
      }
      spectraPairs.push({ arms: [names[a], names[b]], differ, count: ya.length, partitionsDiffer, largest });
    }
  }
}
record['spectra'] = { rows: spectraRows, pairs: spectraPairs };

// 2. The noise run, against the f64 convolution and between the arms.
const noiseOf = new Map<string, Float32Array>();
for (const arm of present) {
  const r = results[arm]!;
  if (r.noise !== undefined && (r.timings?.length ?? 0) > 0) noiseOf.set(arm, fromBase64(r.noise).subarray(0, r.timings!.length * FRAMES));
  if (r.bare?.noise !== undefined && (r.bare.timings?.length ?? 0) > 0) noiseOf.set(`${arm} bare`, fromBase64(r.bare.noise).subarray(0, r.bare.timings!.length * FRAMES));
}
const noiseRows: Record<string, unknown>[] = [];
const noisePairs: Record<string, unknown>[] = [];
if (noiseOf.size > 0) {
  const most = Math.max(...[...noiseOf.values()].map((y) => y.length));
  const reference = convolve64(noise(most / FRAMES), h, most);
  for (const [arm, y] of noiseOf) {
    raw[`${arm} noise`] = toBase64(y);
    noiseRows.push({ arm, blocks: y.length / FRAMES, ...tailAccuracy(y, reference.subarray(0, y.length)), ...subnormals(y) });
  }
  const names = [...noiseOf.keys()];
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      const n = Math.min(noiseOf.get(names[a]!)!.length, noiseOf.get(names[b]!)!.length);
      noisePairs.push({
        arms: [names[a], names[b]],
        blocks: n / FRAMES,
        ...tailAgreement(noiseOf.get(names[a]!)!.subarray(0, n), noiseOf.get(names[b]!)!.subarray(0, n), reference.subarray(0, n)),
      });
    }
  }
}
record['noise'] = { rows: noiseRows, pairs: noisePairs };

// 3. The impulses' tails: the last second, and the frames after the response in the last block.
const OFFSET = TAIL_START - TAIL_FIRST_BLOCK * FRAMES;
const AFTER = TAIL_END - TAIL_FIRST_BLOCK * FRAMES;
const tailRows: Record<string, unknown>[] = [];
const tailPairs: Record<string, unknown>[] = [];
const referenceRows: Record<string, unknown>[] = [];
for (const level of levels) {
  const reference = impulseReference(h, LEVELS[level], TAIL_START, TAIL_END);
  const rounded = Float32Array.from(reference);
  referenceRows.push({ level, ...subnormals(rounded), peak: Math.max(...rounded.map(Math.abs)), smallest: Math.min(...[...reference].map(Math.abs)) });
  const outputs = new Map<string, Float32Array>();
  for (const arm of present) {
    for (const run of results[arm]!.tails ?? []) {
      if (run.level !== level || run.output === undefined) continue;
      outputs.set(`${arm} ${run.tail}`, fromBase64(run.output));
    }
  }
  const oracleWindow = [...outputs].find(([key]) => key.startsWith('oracle '))?.[1]?.subarray(OFFSET, OFFSET + reference.length);
  for (const [key, y] of outputs) {
    raw[`${key} ${level}`] = toBase64(y);
    const window = y.subarray(OFFSET, OFFSET + reference.length);
    const after = y.subarray(AFTER);
    tailRows.push({
      level,
      run: key,
      ...tailAccuracy(window, reference),
      ...subnormals(window),
      ...(oracleWindow === undefined || key.startsWith('oracle ') ? {} : { flushed: flushed(window, oracleWindow) }),
      after: { ...subnormals(after), count: after.length, largest: Math.max(...after.map(Math.abs)) },
      smallestNonzero: Math.min(...[...window].filter((v) => v !== 0).map(Math.abs)),
    });
  }
  const keys = [...outputs.keys()];
  for (let a = 0; a < keys.length; a++) {
    for (let b = a + 1; b < keys.length; b++) {
      const wa = outputs.get(keys[a]!)!;
      const wb = outputs.get(keys[b]!)!;
      tailPairs.push({
        level,
        runs: [keys[a], keys[b]],
        ...tailAgreement(wa.subarray(OFFSET, OFFSET + reference.length), wb.subarray(OFFSET, OFFSET + reference.length), reference),
        after: tailAgreement(wa.subarray(AFTER), wb.subarray(AFTER), new Float64Array(wa.length - AFTER).fill(ulp32(1))).differ,
      });
    }
  }
}
record['tails'] = { reference: referenceRows, rows: tailRows, pairs: tailPairs };

// 4. The time per block, the GPU time and the fuse reports.
const timingRows: Record<string, unknown>[] = [];
const timed: [string, Timing[]][] = present.flatMap((arm): [string, Timing[]][] => [
  [arm, results[arm]!.timings ?? []],
  ...(results[arm]!.bare?.timings === undefined ? [] : [[`${arm} bare`, results[arm]!.bare!.timings!] as [string, Timing[]]]),
]);
for (const [arm, t] of timed) {
  if (t.length === 0) continue;
  const gpuBlocks = t.filter((b) => b.gpu !== undefined && b.gpu.every((g) => g !== null));
  const groups = gpuBlocks[0]?.gpu?.length ?? 0;
  const perGroup = Array.from({ length: groups }, (_, g) => stats(gpuBlocks.map((b) => (b.gpu![g] as number) / 1e6)));
  timingRows.push({
    arm,
    host: stats(t.map((b) => b.ms)),
    first: t[0]!.ms,
    gpu: stats(gpuBlocks.map((b) => b.gpu!.reduce<number>((s, g) => s + (g as number), 0) / 1e6)),
    gpuBlocks: gpuBlocks.length,
    perGroup,
    dispatches: [...new Set(t.map((b) => b.dispatches))],
    submissions: [...new Set(t.map((b) => b.submissions))],
  });
}
record['timing'] = timingRows;
record['prepare'] = present.map((arm) => ({ arm, ms: results[arm]!.prepare?.ms, ...(results[arm]!.bare?.prepareMs === undefined ? {} : { bareMs: results[arm]!.bare!.prepareMs }) }));
record['plans'] = present.map((arm) => ({ arm, plan: results[arm]!.plan, reports: results[arm]!.reports }));
record['bare'] = present
  .filter((arm) => results[arm]!.bare !== undefined)
  .map((arm) => {
    const b = results[arm]!.bare!;
    return { arm, features: b.features, plan: b.plan, report: b.report, failed: b.failed };
  });

// 5. The memory the engine holds on the device: from the sizes, and as the runtime counts it.
const F32 = 4;
const memory = {
  computed: {
    spectra: PARTITIONS * POINTS * 2 * F32,
    line: PARTITIONS * POINTS * 2 * F32,
    twiddles: POINTS * F32,
    scratch: 4 * POINTS * 2 * F32,
    blocks: 3 * FRAMES * F32,
    prepareOnly: PARTITIONS * POINTS * 2 * F32,
  },
  statistics: Object.fromEntries(present.map((arm) => [arm, results[arm]!.statistics])),
};
record['memory'] = memory;

// 6. The kernel check against the oracle's, and the refusals.
const checkRows: Record<string, unknown>[] = [];
for (const arm of present) {
  for (const c of (results[arm]!.checks ?? []) as KernelCheck[]) {
    const o = oracleChecks?.[c.name];
    const y = c.output === undefined ? undefined : fromBase64(c.output);
    let differ: number | undefined;
    if (o !== undefined && y !== undefined) {
      const uo = new Uint32Array(o.buffer, o.byteOffset, o.length);
      const uy = new Uint32Array(y.buffer, y.byteOffset, y.length);
      differ = 0;
      for (let i = 0; i < uo.length; i++) if (uo[i] !== uy[i]) differ++;
    }
    checkRows.push({
      arm,
      name: c.name,
      ...(c.refused === undefined ? {} : { refused: c.refused }),
      ...(c.report === undefined ? {} : { report: c.report }),
      ...(c.ms === undefined ? {} : { ms: c.ms }),
      ...(c.outside === undefined ? {} : { outside: c.outside }),
      ...(differ === undefined ? {} : { differ, count: y!.length }),
    });
  }
}
record['checks'] = checkRows;
record['refusals'] = present.flatMap((arm) => {
  const r = results[arm]!;
  return [
    ...(r.refused === undefined ? [] : [{ arm, what: 'the convolution', sentence: r.refused }]),
    ...(r.plan?.refusal === undefined ? [] : [{ arm, what: 'fuse', sentence: r.plan.refusal }]),
    ...(r.unfinished === undefined ? [] : [{ arm, what: 'unfinished', sentence: r.unfinished }]),
    ...(r.noiseFailed === undefined ? [] : [{ arm, what: 'the noise run', sentence: r.noiseFailed }]),
    ...(r.bare?.failed === undefined ? [] : [{ arm, what: 'the device with no timestamp-query', sentence: r.bare.failed }]),
    ...(r.tails ?? []).filter((t) => t.failed !== undefined).map((t) => ({ arm, what: `the ${t.level} tail, ${t.tail}`, sentence: t.failed })),
  ];
});
record['environments'] = Object.fromEntries(
  present.map((arm) => [arm, { environment: results[arm]!.environment, info: results[arm]!.info, device: results[arm]!.device, limits: results[arm]!.limits }]),
);
record['tailTimes'] = present.flatMap((arm) => (results[arm]!.tails ?? []).map((t) => ({ arm, level: t.level, tail: t.tail, blocks: t.blocks, ms: stats(t.ms ?? []) })));
record['seconds'] = (Date.now() - started) / 1000;

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
await mkdir(dirname(rawFile), { recursive: true });
await writeFile(rawFile, `${JSON.stringify(raw)}\n`);

// ---- The tables ----

const lines: string[] = [];
const table = (title: string, head: string[], body: string[][]): void => {
  lines.push('', title, '', `| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`);
  for (const r of body) lines.push(`| ${r.join(' | ')} |`);
};
const num = (v: unknown, d = 2): string => (typeof v !== 'number' ? 'n/a' : v === 0 ? '0' : Math.abs(v) < 0.01 || Math.abs(v) >= 1e6 ? v.toExponential(2) : v.toFixed(d));
type Stats = ReturnType<typeof stats>;
table(
  'Time per block (host time from the input write to the end of the output read, ms; GPU time from the fuse report, ms)',
  ['Arm', 'Blocks', 'Host median', 'Host p95', 'Host min', 'Host max', 'First', 'GPU median', 'GPU p95', 'Dispatches', 'Submissions'],
  timingRows.map((r) => {
    const host = r['host'] as Stats;
    const gpu = r['gpu'] as Stats;
    return [String(r['arm']), String(host?.n), num(host?.median), num(host?.p95), num(host?.min), num(host?.max), num(r['first']), num(gpu?.median, 3), num(gpu?.p95, 3), String(r['dispatches']), String(r['submissions'])];
  }),
);
for (const r of timingRows) {
  const groups = (r['perGroup'] as Stats[]) ?? [];
  if (groups.length === 0) continue;
  const name = String(r['arm']);
  const report = name.endsWith(' bare') ? results[name.slice(0, -5) as Arm]?.bare?.report : results[name as Arm]?.reports?.last;
  table(
    `GPU time per group on ${String(r['arm'])} (ms, over ${String(r['gpuBlocks'])} blocks)`,
    ['Group', 'Calls', 'Median', 'p95'],
    groups.map((g, i) => [String(i + 1), report?.groups[i]?.calls.join(' + ') ?? '?', num(g?.median, 4), num(g?.p95, 4)]),
  );
}
for (const p of record['plans'] as { arm: Arm; plan?: Result['plan']; reports?: Result['reports'] }[]) {
  if (p.reports?.last === undefined) {
    if (p.plan?.refusal !== undefined) lines.push('', `${p.arm}: fuse refused the block: ${p.plan.refusal}`);
    continue;
  }
  const r = p.reports.last;
  lines.push('', `The fuse report of the last noise block on ${p.arm}: tier ${r.tier}, ${r.dispatches} dispatches, ${r.submissions} submissions`);
  r.groups.forEach((g, i) => lines.push(`  ${i + 1}. ${g.calls.join(' + ')}${g.fused ? ' (fused)' : ''}${g.workgroupShapes === undefined ? '' : ` ${JSON.stringify(g.workgroupShapes)}`}${g.why === undefined ? '' : `: ${g.why}`}`));
}
table(
  'The transform of the 469 partitions: host time; against the f64 transform, largest / mean error in f32 ULPs at each transform\'s peak, relative RMS error',
  ['Arm', 'Time (ms)', 'Error (ULP at peak)', 'Relative RMS', 'Exact'],
  spectraRows.map((r) => [String(r['arm']), num(results[r['arm'] as Arm]?.prepare?.ms, 1), `${num(r['maxPeakUlp'])} / ${num(r['meanPeakUlp'], 3)}`, num(r['relRms']), `${String(r['exact'])} of ${String(r['count'])}`]),
);
table(
  'The partitions\' spectra between the arms: values whose bits differ (partitions with a difference; largest difference)',
  ['Arms', 'Differ', 'Partitions', 'Largest'],
  spectraPairs.map((r) => [(r['arms'] as string[]).join(' and '), `${String(r['differ'])} of ${String(r['count'])}`, String(r['partitionsDiffer']), num(r['largest'])]),
);
table(
  'The noise run against the f64 convolution: largest / mean error in f32 ULPs at the output\'s peak; relative RMS error; most f32s from the rounded reference',
  ['Arm', 'Blocks', 'Error (ULP at peak)', 'Relative RMS', 'Max ULP', 'Exact'],
  noiseRows.map((r) => [String(r['arm']), String(r['blocks']), `${num(r['maxPeakUlp'])} / ${num(r['meanPeakUlp'], 3)}`, num(r['relRms']), String(r['maxUlp']), `${String(r['exact'])} of ${String(r['count'])}`]),
);
table(
  'The noise run between the arms, over the blocks both ran',
  ['Arms', 'Blocks', 'Differ', 'Max ULP', 'Largest (ULP at peak)', 'Relative RMS'],
  noisePairs.map((r) => [(r['arms'] as string[]).join(' and '), String(r['blocks']), `${String(r['differ'])} of ${String(r['count'])}`, String(r['maxUlp']), num(r['maxPeakUlp']), num(r['relRms'])]),
);
table(
  'The reference\'s last second of each tail, rounded to f32: subnormal values (zeros); peak; smallest magnitude',
  ['Level', 'Subnormal (zero)', 'Peak', 'Smallest'],
  referenceRows.map((r) => [String(r['level']), `${String(r['subnormal'])} (${String(r['zero'])})`, num(r['peak']), num(r['smallest'])]),
);
table(
  'The last second of each tail against the f64 reference: largest / mean error in f32 ULPs at the window\'s peak; relative RMS; most f32s from the rounded reference; subnormals (zeros); flushed where the oracle holds a subnormal; after the response: subnormals (zeros) of the frames in the last block',
  ['Level', 'Run', 'Error (ULP at peak)', 'Relative RMS', 'Max ULP', 'Exact', 'Subnormal (zero)', 'Flushed', 'After the response'],
  tailRows.map((r) => {
    const after = r['after'] as { subnormal: number; zero: number; count: number; largest: number };
    return [String(r['level']), String(r['run']), `${num(r['maxPeakUlp'])} / ${num(r['meanPeakUlp'], 3)}`, num(r['relRms']), String(r['maxUlp']), `${String(r['exact'])} of ${String(r['count'])}`, `${String(r['subnormal'])} (${String(r['zero'])})`, r['flushed'] === undefined ? '' : String(r['flushed']), `${after.subnormal} (${after.zero}) of ${after.count}; largest ${num(after.largest)}`];
  }),
);
table(
  'The last second of each tail between the runs: values whose bits differ; most f32s apart; largest difference in ULPs at the window\'s peak; relative RMS of the difference; values that differ after the response',
  ['Level', 'Runs', 'Differ', 'Max ULP', 'Largest (ULP at peak)', 'Relative RMS', 'After'],
  tailPairs.map((r) => [String(r['level']), (r['runs'] as string[]).join(' and '), `${String(r['differ'])} of ${String(r['count'])}`, String(r['maxUlp']), num(r['maxPeakUlp']), num(r['relRms']), String(r['after'])]),
);
table(
  'The memory the engine holds (bytes): computed from the sizes; the runtime\'s count after the engine was made',
  ['Item', 'Bytes'],
  [
    ...Object.entries(memory.computed).map(([k, v]) => [k, String(v)]),
    ...present.flatMap((arm) => {
      const s = results[arm]!.statistics;
      return s === undefined ? [] : [[`${arm}: liveBytes held / end`, `${s.held.liveBytes} / ${s.end.liveBytes}`], [`${arm}: live arrays, pooled bytes`, `${s.held.live}, ${s.held.pooledBytes}`]];
    }),
  ],
);
table(
  'The kernel check: each kernel function on seeded inputs, against the oracle\'s fns bit for bit',
  ['Arm', 'Call', 'Result'],
  checkRows.map((r) => [String(r['arm']), String(r['name']), r['refused'] !== undefined ? `refused: ${String(r['refused'])}` : r['differ'] !== undefined ? `${String(r['differ'])} of ${String(r['count'])} differ${r['outside'] === undefined ? '' : `, ${String(r['outside'])} changed outside the slot`}` : r['report'] !== undefined ? `ran: ${JSON.stringify(r['report'])}` : 'ran']),
);
const refusals = record['refusals'] as { arm: string; what: string; sentence: string }[];
if (refusals.length > 0 || Object.keys(failures).length > 0) {
  lines.push('', 'Refused, failed or not finished', '');
  for (const r of refusals) lines.push(`- ${r.arm}, ${r.what}: ${r.sentence}`);
  for (const [arm, sentence] of Object.entries(failures)) lines.push(`- ${arm}: ${sentence}`);
}
const load = Object.entries(loads).map(([arm, l]) => `${arm}: ${l.before.map((x) => x.toFixed(2)).join(', ')} -> ${l.after.map((x) => x.toFixed(2)).join(', ')}`);
lines.push('', `Load average before -> after: ${load.join('; ')}`);
lines.push(`Duration: ${Object.entries(durations).map(([arm, s]) => `${arm} ${s.toFixed(0)} s`).join(', ')}; all ${String(record['seconds'])} s`);
console.log(lines.join('\n'));
console.log(`\nwrote ${outFile} and ${rawFile}`);

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

