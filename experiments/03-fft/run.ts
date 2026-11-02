// Experiment 3, the FFT entry held to the oracle on three tiers (docs/experiments.md, section 3).
//
//   bun run exp:03 [--tier all|cpu,oracle,webgpu,webgl2] [--sizes 1024,4096]
//                  [--variants device,table,double] [--repeats 3] [--timeout 60]
//                  [--out <file.json>] [--raw <file.json>]
//
// Four arms, each transforming the same `f32` inputs (`signals.ts`):
//
// - `cpu`: the host face's CPU tier, in Node: the harness bundled with Vite and the compiler's
//   plugin, run with the Node on PATH (`NODE_BINARY` names another). At the pin it refuses an entry
//   that reaches a barrier; the refusals are the result, with the probes, which it runs.
// - `oracle`: the compiler's oracle, `dispatch` at `f32` precision, in this process (Bun), since
//   it needs the compiler's front end (`oracle.ts`).
// - `webgpu` and `webgl2`: the harness bundled for a page, opened in headless Chromium with WebGPU
//   and WebGL2 on SwiftShader (`TYPESHADE_CHROMIUM` names the binary), a fresh browser for each.
//
// It holds every output to the `f64` reference and the arms to one another, counts the
// subnormals, reads `compile().determinism`, writes the result as JSON (`--out`; the outputs
// themselves to `--raw`) and prints the tables. A number without its record is not a result: the
// record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { buildInfo, compile } from 'typeshade';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import type { Call, Options, Probe, Result } from './harness.ts';
import { oracleOf } from './oracle.ts';
import {
  DIRECTIONS,
  ENTRIES,
  PROBE_INPUTS,
  SIGNALS,
  SIZES,
  VARIANTS,
  accuracy,
  agreement,
  fft64,
  flushed,
  fromBase64,
  inputOf,
  subnormals,
  toBase64,
  twiddleTable,
  type Accuracy,
  type Agreement,
  type Direction,
  type Signal,
  type Size,
  type Subnormals,
  type Variant,
} from './signals.ts';

const ARMS = ['cpu', 'oracle', 'webgpu', 'webgl2'] as const;
type Arm = (typeof ARMS)[number];

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(`run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`);
  }
  args.set(key.slice(2), value);
}
const listOf = <T extends string | number>(name: string, all: readonly T[]): T[] => {
  const given = args.get(name);
  if (given === undefined || given === 'all') return [...all];
  const values = given.split(',').map((v) => (typeof all[0] === 'number' ? Number(v) : v) as T);
  for (const v of values) {
    if (!all.includes(v)) throw new Error(`run.ts: --${name} takes ${all.join(', ')} or all; got "${String(v)}".`);
  }
  return values;
};
const arms = listOf<Arm>('tier', ARMS);
const repeats = Number(args.get('repeats') ?? 3);
if (!Number.isInteger(repeats) || repeats < 1) throw new Error('run.ts: --repeats takes a whole number of 1 or more.');
const timeout = Number(args.get('timeout') ?? 60);
if (!Number.isInteger(timeout) || timeout < 1) throw new Error('run.ts: --timeout takes a whole number of seconds, 1 or more.');
const options: Omit<Options, 'tier'> = {
  sizes: listOf<Size>('sizes', SIZES),
  variants: listOf<Variant>('variants', VARIANTS),
  repeats,
  timeoutMs: timeout * 1000,
};
const outFile = args.get('out') ?? join(ROOT, 'experiments/03-fft/out/result.json');
const rawFile = args.get('raw') ?? join(ROOT, 'experiments/03-fft/out/raw.json');

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const versionOf = async (pkg: string): Promise<string> =>
  (JSON.parse(await readFile(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')) as { version: string }).version;
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const record: Record<string, unknown> = {
  experiment: '03-fft',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  compiler: buildInfo,
  tools: {
    bun: process.versions['bun'] ?? null,
    vite: await versionOf('vite'),
    'playwright-core': await versionOf('playwright-core'),
  },
  options,
};

// The machine's load average over 1, 5 and 15 minutes, before and after each arm: another process
// that shares the machine shows here. It bears on the times, not on the bits.
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

// The determinism report of each module (compiler surface §38): what may differ by driver.
const fftSource = await readFile(join(ROOT, 'experiments/03-fft/fft.shade.ts'), 'utf8');
const probeSource = await readFile(join(ROOT, 'experiments/03-fft/probes.shade.ts'), 'utf8');
record['determinism'] = {
  'fft.shade.ts': compile(fftSource).determinism,
  'probes.shade.ts': compile(probeSource).determinism,
};

const results: Partial<Record<Arm, Result & { environment?: unknown }>> = {};
/** The page's console lines that repeated, with their counts. */
const consoles: Record<string, { line: string; count: number }[]> = {};
record['consoles'] = consoles;
/** An arm whose run failed as a whole, with the sentence. */
const failures: Record<string, string> = {};
record['failures'] = failures;

if (arms.includes('cpu')) {
  const main = await bundle({ entry: 'experiments/03-fft/node.ts', outDir: 'experiments/03-fft/out/node', target: 'node' });
  const before = loadavg();
  results.cpu = JSON.parse(await runNode(await nodeBinary(), [main, JSON.stringify(options)]));
  loads['cpu'] = { before, after: loadavg() };
}
if (arms.includes('oracle')) {
  const before = loadavg();
  const oracle = oracleOf(fftSource);
  const calls: Call[] = [];
  for (const size of options.sizes) {
    for (const variant of options.variants) {
      for (const direction of DIRECTIONS) {
        const entry = ENTRIES[size][variant];
        const start = performance.now();
        const y = oracle.run(entry, direction, size, SIGNALS.length, inputOf(size, direction), twiddleTable(size));
        const ms = performance.now() - start;
        console.error(`oracle ${entry} ${direction}: ${ms.toFixed(1)} ms`);
        calls.push({ size, variant, direction, entry, output: toBase64(y), unstable: 0, ms: [ms] });
      }
    }
  }
  const cpu = cpus();
  results.oracle = {
    tier: 'cpu',
    environment: {
      bun: process.versions['bun'],
      cpu: cpu[0]?.model ?? 'unknown',
      cores: cpu.length,
      os: `${platform()} ${release()}`,
    },
    calls,
    probes: [],
  };
  loads['oracle'] = { before, after: loadavg() };
}
const pageTiers = arms.filter((a): a is 'webgpu' | 'webgl2' => a === 'webgpu' || a === 'webgl2');
if (pageTiers.length > 0) {
  const page = await bundle({ entry: 'experiments/03-fft/browser.ts', outDir: 'experiments/03-fft/out/web', target: 'web' });
  // `browser.ts` sets `runFft` on the page's global object.
  type Page = { runFft(o: Options): Promise<Result> };
  for (const tier of pageTiers) {
    const before = loadavg();
    // The page's console, each distinct line printed once and counted: the WebGL2 tier's read-backs
    // draw Chromium's performance warning on every pass.
    const seen = new Map<string, number>();
    // The page bounds each call (`timeoutMs`); this bounds the page, in case its script stops
    // yielding. The browser is closed on either way out.
    const calls = options.sizes.length * options.variants.length * DIRECTIONS.length;
    const limit = options.timeoutMs * (calls * options.repeats + 4);
    try {
      results[tier] = await inPage(
        dirname(page),
        (p) =>
          Promise.race([
            p.evaluate((o) => (globalThis as unknown as Page).runFft(o), { ...options, tier }),
            new Promise<never>((_, fail) =>
              setTimeout(() => fail(new Error(`the page did not return within ${String(limit / 1000)} s`)), limit),
            ),
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
    }
    consoles[tier] = [...seen].filter(([, n]) => n > 1).map(([line, count]) => ({ line, count }));
    loads[tier] = { before, after: loadavg() };
  }
}

// ---- The comparison ----

/** One arm's output for one transform of one signal, against the reference. */
interface Row {
  readonly size: Size;
  readonly variant: Variant;
  readonly direction: Direction;
  readonly signal: Signal;
  readonly arm: Arm;
  readonly accuracy: Accuracy;
  readonly subnormals: Subnormals;
  /** The values the oracle holds as subnormals and this arm as 0. */
  readonly flushed?: number;
}
interface Pair {
  readonly size: Size;
  readonly variant: Variant;
  readonly direction: Direction;
  readonly signal: Signal;
  readonly arms: readonly [Arm, Arm];
  readonly agreement: Agreement;
}
interface Reference {
  readonly size: Size;
  readonly direction: Direction;
  readonly signal: Signal;
  /** The reference rounded to `f32`. */
  readonly subnormals: Subnormals;
}

const rows: Row[] = [];
const pairs: Pair[] = [];
const references: Reference[] = [];
const refusals: { arm: Arm; entry: string; direction: Direction; kind: 'refused' | 'unfinished'; sentence: string }[] = [];
const raw: Record<string, unknown> = {};
const outputOf = (arm: Arm, size: Size, variant: Variant, direction: Direction): Float32Array | undefined => {
  const c = results[arm]?.calls.find((x) => x.size === size && x.variant === variant && x.direction === direction);
  return c?.output === undefined ? undefined : fromBase64(c.output);
};
for (const arm of arms) {
  for (const c of results[arm]?.calls ?? []) {
    if (c.refused !== undefined) refusals.push({ arm, entry: c.entry, direction: c.direction, kind: 'refused', sentence: c.refused });
    if (c.unfinished !== undefined) refusals.push({ arm, entry: c.entry, direction: c.direction, kind: 'unfinished', sentence: c.unfinished });
  }
}
for (const size of options.sizes) {
  const span = 2 * size;
  for (const direction of DIRECTIONS) {
    const reference = fft64(inputOf(size, direction), size, direction);
    SIGNALS.forEach((signal, i) => {
      references.push({ size, direction, signal, subnormals: subnormals(reference.subarray(i * span, (i + 1) * span)) });
    });
    for (const variant of options.variants) {
      const outputs = new Map<Arm, Float32Array>();
      for (const arm of arms) {
        const y = outputOf(arm, size, variant, direction);
        if (y !== undefined) outputs.set(arm, y);
      }
      const oracle = outputs.get('oracle');
      for (const [arm, y] of outputs) {
        raw[`${arm} ${size} ${variant} ${direction}`] = toBase64(y);
        SIGNALS.forEach((signal, i) => {
          const part = y.subarray(i * span, (i + 1) * span);
          rows.push({
            size,
            variant,
            direction,
            signal,
            arm,
            accuracy: accuracy(part, reference.subarray(i * span, (i + 1) * span)),
            subnormals: subnormals(part),
            ...(oracle === undefined || arm === 'oracle'
              ? {}
              : { flushed: flushed(part, oracle.subarray(i * span, (i + 1) * span)) }),
          });
        });
      }
      const present = [...outputs.keys()];
      for (let a = 0; a < present.length; a++) {
        for (let b = a + 1; b < present.length; b++) {
          const ya = outputs.get(present[a]!)!;
          const yb = outputs.get(present[b]!)!;
          SIGNALS.forEach((signal, i) => {
            pairs.push({
              size,
              variant,
              direction,
              signal,
              arms: [present[a]!, present[b]!],
              agreement: agreement(
                ya.subarray(i * span, (i + 1) * span),
                yb.subarray(i * span, (i + 1) * span),
                reference.subarray(i * span, (i + 1) * span),
              ),
            });
          });
        }
      }
    }
  }
}

/** What each probe shows: the values a tier flushed, against the exact product. */
const probeRows = arms.flatMap((arm) =>
  (results[arm]?.probes ?? []).map((p: Probe) => {
    if (p.refused !== undefined || p.output === undefined) return { arm, name: p.name, factor: p.factor, refused: p.refused };
    const expected =
      p.name === 'wrapProbe'
        ? p.output.map((_, i) => p.input[i % p.input.length]!)
        : p.input.map((x) => Math.fround(x * p.factor!));
    const wrong = p.output.filter((v, i) => !Object.is(v, expected[i])).length;
    const zeros = p.output.filter((v, i) => v === 0 && expected[i] !== 0).length;
    return { arm, name: p.name, factor: p.factor, values: p.output.length, wrong, zeros, output: p.output };
  }),
);

const timing = arms.flatMap((arm) =>
  (results[arm]?.calls ?? [])
    .filter((c) => c.ms !== undefined)
    .map((c) => ({ arm, entry: c.entry, direction: c.direction, ms: c.ms!, unstable: c.unstable ?? 0 })),
);

record['environments'] = Object.fromEntries(
  arms.map((arm) => [arm, { environment: results[arm]?.environment, info: results[arm]?.info }]),
);
record['probeInputs'] = PROBE_INPUTS;
record['refusals'] = refusals;
record['probes'] = probeRows;
record['timing'] = timing;
record['rows'] = rows;
record['pairs'] = pairs;
record['references'] = references;

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
await mkdir(dirname(rawFile), { recursive: true });
await writeFile(rawFile, `${JSON.stringify(raw)}\n`);

// ---- The tables ----

const LOUD: readonly Signal[] = ['noise', 'impulse', 'decay'];
/** The signals the tables group: the three at full scale, and the quiet one, whose tail is subnormal. */
const GROUPS: readonly (readonly [string, readonly Signal[]])[] = [
  ['noise, impulse and decay', LOUD],
  ['quiet', ['quiet']],
];
const fixed = (v: number, d = 2): string => (v === 0 ? '0' : v < 0.01 ? v.toExponential(1) : v.toFixed(d));
const of = (size: Size, variant: Variant, direction: Direction, arm: Arm, signals: readonly Signal[]): Row[] =>
  rows.filter((r) => r.size === size && r.variant === variant && r.direction === direction && r.arm === arm && signals.includes(r.signal));
const cell = (rs: Row[], max: (a: Accuracy) => number, mean: (a: Accuracy) => number): string =>
  rs.length === 0
    ? 'n/a'
    : `${fixed(Math.max(...rs.map((r) => max(r.accuracy))))} / ${fixed(rs.reduce((s, r) => s + mean(r.accuracy), 0) / rs.length, 3)}`;
const shown = arms.filter((a) => rows.some((r) => r.arm === a));
const lines: string[] = [];
const table = (title: string, head: string[], body: string[][]): void => {
  lines.push('', title, '', `| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`);
  for (const r of body) lines.push(`| ${r.join(' | ')} |`);
};
const keys = options.sizes.flatMap((size) =>
  options.variants.flatMap((variant) => DIRECTIONS.map((direction) => ({ size, variant, direction }))),
);
for (const [title, signals] of GROUPS) {
  table(
    `Error against the f64 reference, ${title}: largest / mean, in f32 ULPs at the transform's peak`,
    ['Size', 'Variant', 'Direction', ...shown],
    keys.map((k) => [String(k.size), k.variant, k.direction, ...shown.map((a) => cell(of(k.size, k.variant, k.direction, a, signals), (x) => x.maxPeakUlp, (x) => x.meanPeakUlp))]),
  );
}
table(
  "The impulse's forward transform, which is the twiddles: largest absolute error (as a power of 2); values that are the twiddle rounded to the nearest f32",
  ['Size', 'Variant', ...shown],
  options.sizes.flatMap((size) => options.variants.map((variant) => [String(size), variant, ...shown.map((a) => {
    const r = of(size, variant, 'forward', a, ['impulse'])[0];
    if (r === undefined) return 'n/a';
    const e = r.accuracy.maxAbs;
    return `${e === 0 ? '0' : `${e.toExponential(2)} (2^${Math.log2(e).toFixed(1)})`}; ${r.accuracy.exact} of ${r.accuracy.count}`;
  })])),
);
const pairNames = [...new Set(pairs.map((p) => p.arms.join('-')))];
for (const [title, signals] of GROUPS) {
  table(
    `Values whose bits differ between two arms, ${title} (largest difference, in f32 ULPs at the transform's peak)`,
    ['Size', 'Variant', 'Direction', ...pairNames],
    keys.map((k) => [String(k.size), k.variant, k.direction, ...pairNames.map((name) => {
      const ps = pairs.filter((p) => p.size === k.size && p.variant === k.variant && p.direction === k.direction && p.arms.join('-') === name && signals.includes(p.signal));
      if (ps.length === 0) return 'n/a';
      const differ = ps.reduce((sum, p) => sum + p.agreement.differ, 0);
      const count = ps.reduce((sum, p) => sum + p.agreement.count, 0);
      return `${differ} of ${count} (${fixed(Math.max(...ps.map((p) => p.agreement.maxPeakUlp)))})`;
    })]),
  );
}
table(
  'The quiet signal: subnormal values (zeros) in the reference rounded to f32 and in each arm; flushed to 0 where the oracle holds a subnormal',
  ['Size', 'Variant', 'Direction', 'reference', ...shown],
  keys.map((k) => {
    const ref = references.find((r) => r.size === k.size && r.direction === k.direction && r.signal === 'quiet')!;
    return [String(k.size), k.variant, k.direction, `${ref.subnormals.subnormal} (${ref.subnormals.zero})`, ...shown.map((a) => {
      const r = of(k.size, k.variant, k.direction, a, ['quiet'])[0];
      if (r === undefined) return 'n/a';
      return `${r.subnormals.subnormal} (${r.subnormals.zero})${r.flushed === undefined ? '' : `, flushed ${r.flushed}`}`;
    })];
  }),
);
table(
  'Probes',
  ['Arm', 'Probe', 'Factor', 'Result'],
  probeRows.map((p) => [p.arm, p.name, p.factor === undefined ? '' : `2^${Math.log2(p.factor)}`,
    'refused' in p && p.refused !== undefined ? `refused: ${p.refused}` : `${(p as { wrong: number }).wrong} of ${(p as { values: number }).values} not the exact result, ${(p as { zeros: number }).zeros} of them 0`]),
);
table(
  'Host time per call (ms): median of the runs; runs whose bits differ from the first',
  ['Arm', 'Entry', 'Direction', 'Median (ms)', 'Runs', 'Unstable'],
  timing.map((t) => {
    const sorted = [...t.ms].sort((a, b) => a - b);
    return [t.arm, t.entry, t.direction, sorted[Math.floor((sorted.length - 1) / 2)]!.toFixed(1), String(t.ms.length), String(t.unstable)];
  }),
);
if (refusals.length > 0) {
  lines.push('', 'Refused, or not finished', '');
  for (const r of refusals) lines.push(`- ${r.arm} ${r.entry} ${r.direction} (${r.kind}): ${r.sentence}`);
}
const load = Object.entries(loads).map(([arm, l]) => `${arm}: ${l.before.map((x) => x.toFixed(2)).join(', ')} -> ${l.after.map((x) => x.toFixed(2)).join(', ')}`);
lines.push('', `Load average before -> after: ${load.join('; ')}`);
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
