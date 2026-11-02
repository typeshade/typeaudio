// Experiment 2, the CPU tier inside an AudioWorklet (docs/experiments.md, section 2).
//
//   bun run exp:02 [--parts load,offline,realtime] [--voices 1,8,32,64,128,256,512]
//                  [--variants empty,plain,host,kernel,engine] [--seconds 4] [--warmup 1]
//                  [--repeat 3] [--realtime 3] [--max-run 120] [--out <file.json>]
//
// It bundles the page and four worklet bundles with Vite and the compiler's plugin (`processor.ts`
// and `engine.ts`, each with its dynamic imports inlined and without), opens the page in headless
// Chromium (`TYPESHADE_CHROMIUM` names the binary) and runs three parts:
//
// - `load`: each bundle loaded with `audioWorklet.addModule` into an `OfflineAudioContext`, and a
//   short render through it: whether it loads, whether its calls run, and the error of each that
//   does not (the measurement of compiler ask F);
// - `offline`: for each voice count and variant, `--seconds` of audio rendered in an
//   `OfflineAudioContext`, the first `--warmup` seconds timed apart; the real-time ratio is the
//   render time of the rest over its audio time. Each run is repeated `--repeat` times, but one
//   whose timed part took more than 20 s; the summary takes the median. A run whose predicted
//   render time passes `--max-run` seconds is not run, and says so;
// - `realtime`: the `plain`, `kernel`, `host` and `engine` variants in a real-time `AudioContext`
//   for `--realtime` seconds each: the audio clock against the wall clock, the underruns of
//   `playbackStats` where the browser has it, and the CPU time of the render thread.
//
// Around the timed part of each run it reads the CPU time of the browser's threads from `/proc`
// (`scripts/cpu-time.ts`): the container is shared, and the wall time holds the waits for a CPU.
//
// It writes the result as JSON, with the commit, the compiler pin, the browser and the load
// average around each part, and prints a table for each part. A number without its record is not
// a result: the record is `docs/records/`.

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { busiest, snapshot, type Snapshot } from '../../scripts/cpu-time.ts';
import {
  BUNDLES,
  VARIANTS,
  VOICES,
  type BundleName,
  type Cpu,
  type OfflineResult,
  type RealtimeResult,
  type Tiers,
  type Variant,
} from './options.ts';
import type { OfflineSpec, RealtimeSpec } from './page.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!;
  const value = process.argv[i + 1];
  if (!key.startsWith('--') || value === undefined) {
    throw new Error(`run.ts: "${key}" is not an option with a value; see the usage at the top of the file.`);
  }
  args.set(key.slice(2), value);
}
const number = (name: string, fallback: number): number => {
  const v = Number(args.get(name) ?? fallback);
  if (!Number.isFinite(v) || v < 0) throw new Error(`run.ts: --${name} takes a number of 0 or more.`);
  return v;
};
const list = (name: string, fallback: readonly string[]): string[] => (args.get(name) ?? fallback.join(',')).split(',');
const parts = list('parts', ['load', 'offline', 'realtime']);
const voiceCounts = list('voices', VOICES.map(String)).map(Number);
const variants = list('variants', ['empty', 'plain', 'host', 'kernel', 'engine']) as Variant[];
for (const v of variants) if (!(VARIANTS as readonly string[]).includes(v)) throw new Error(`run.ts: --variants takes ${VARIANTS.join(', ')}; got "${v}".`);
const seconds = number('seconds', 4);
const warmup = number('warmup', 1);
const repeat = Math.max(1, Math.round(number('repeat', 3)));
const realtimeSeconds = number('realtime', 3);
const maxRun = number('max-run', 120);
const outFile = args.get('out') ?? join(ROOT, 'experiments/02-worklet/out/result.json');

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { devDependencies: Record<string, string> };
const cpu = cpus();
const record: Record<string, unknown> = {
  experiment: '02-worklet',
  date: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  host: { cpu: cpu[0]?.model ?? 'unknown', cores: cpu.length, os: `${platform()} ${release()}`, bun: process.versions['bun'] },
  options: { parts, voices: voiceCounts, variants, seconds, warmup, repeat, realtimeSeconds, maxRun },
};
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;

// The page, then each worklet bundle in a directory of its own beside it, so that the page loads
// `./<bundle>/processor.js` from its own origin.
const pageDir = 'experiments/02-worklet/out/web';
const page = await bundle({ entry: 'experiments/02-worklet/page.ts', outDir: pageDir, target: 'web' });
const bundles: Record<string, unknown> = {};
for (const [name, b] of Object.entries(BUNDLES)) {
  const dir = `${pageDir}/${name}`;
  await bundle({ entry: b.entry, outDir: dir, target: 'worklet', split: b.split });
  bundles[name] = await inspect(dir, b.entry, b.split);
}
record['bundles'] = bundles;

type Exp02 = {
  exp02: { offline(s: OfflineSpec): Promise<OfflineResult>; realtime(s: RealtimeSpec): Promise<RealtimeResult> };
};
const loadRows: OfflineResult[] = [];
const offlineRows: (OfflineResult | { variant: Variant; voices: number; skipped: string })[] = [];
const realtimeRows: RealtimeResult[] = [];
await inPage(
  dirname(page),
  async (p) => {
    // The page calls `exp02Cpu` at the start and at the end of the timed part of each run.
    const snaps: Partial<Record<'start' | 'end', Snapshot>> = {};
    await p.exposeFunction('exp02Cpu', (label: 'start' | 'end') => {
      snaps[label] = snapshot();
    });
    /** `run`, with the CPU time of its timed part over `per` of its result, in milliseconds. The
     *  render thread is the busiest whose name matches `thread`: in `/proc`, which keeps 15
     *  characters of a name, Chromium's worklet threads read "Offline AudioWo" and "Realtime
     *  AudioW". */
    const withCpu = async <R extends { cpu?: Cpu }>(
      run: () => Promise<R>,
      per: (r: R) => number | undefined,
      thread: RegExp,
    ): Promise<R> => {
      delete snaps.start;
      delete snaps.end;
      const r = await run();
      const denominator = per(r);
      const t = snaps.start === undefined || snaps.end === undefined ? undefined : busiest(snaps.start, snaps.end, thread);
      if (t === undefined || denominator === undefined) return r;
      return { ...r, cpu: { thread: t.name, threadMs: t.ms, allMs: t.allMs, ratio: t.ms / denominator } };
    };
    const offline = (s: OfflineSpec): Promise<OfflineResult> =>
      withCpu(
        () => p.evaluate((spec) => (globalThis as unknown as Exp02).exp02.offline(spec), s),
        (r) => r.timedAudioMs,
        /^Offline AudioW/,
      );
    const realtime = (s: RealtimeSpec): Promise<RealtimeResult> =>
      withCpu(
        () => p.evaluate((spec) => (globalThis as unknown as Exp02).exp02.realtime(spec), s),
        (r) => r.wallMs,
        /^Realtime AudioW/,
      );
    record['browser'] = { userAgent: await p.evaluate(() => navigator.userAgent), version: p.context().browser()?.version() };

    if (parts.includes('load')) {
      const before = loadavg();
      // Each bundle, a short render of 8 voices. The kernel bundles call `synth` with the tiers
      // left as they are, then required to be the CPU tier, then required to be WebGPU.
      const runs: { bundle: BundleName; variant: Variant; tiers: Tiers; polyfill?: boolean }[] = [
        { bundle: 'kernel', variant: 'kernel', tiers: 'default' },
        { bundle: 'kernel', variant: 'kernel', tiers: 'cpu' },
        { bundle: 'kernel', variant: 'kernel', tiers: 'webgpu' },
        { bundle: 'kernel', variant: 'host', tiers: 'default' },
        { bundle: 'kernel-split', variant: 'kernel', tiers: 'default' },
        { bundle: 'engine-split', variant: 'engine', tiers: 'cpu', polyfill: false },
        { bundle: 'engine-split', variant: 'engine', tiers: 'cpu', polyfill: true },
        { bundle: 'engine', variant: 'engine', tiers: 'cpu', polyfill: false },
        { bundle: 'engine', variant: 'engine', tiers: 'cpu', polyfill: true },
      ];
      // The reference the outputs are held to.
      await offline({ bundle: 'kernel', variant: 'plain', voices: 8, tiers: 'cpu', seconds: 0.5, warmup: 0 });
      for (const r of runs) {
        const row = await offline({ ...r, voices: 8, seconds: 0.5, warmup: 0, census: true });
        loadRows.push(row);
        console.error(`load ${r.bundle} ${r.variant} tiers ${r.tiers}${r.polyfill === undefined ? '' : ` polyfill ${r.polyfill}`}: ${row.loadError ?? (row.errors.join('; ') || 'ran')}`);
      }
      loads['load'] = { before, after: loadavg() };
    }

    if (parts.includes('offline')) {
      const before = loadavg();
      const last = new Map<Variant, { voices: number; ratio: number }>();
      const order = (['plain', ...variants.filter((v) => v !== 'plain')] as Variant[]).filter((v) => variants.includes(v) || v === 'plain');
      for (const voices of voiceCounts) {
        for (const variant of order) {
          if (variant === 'empty' && voices !== voiceCounts[0]) continue;
          const prev = last.get(variant);
          const predicted = prev === undefined ? 0 : prev.ratio * (voices / prev.voices) * seconds;
          if (predicted > maxRun) {
            const skipped = `not run: the ratio at ${prev!.voices} voices predicts ${predicted.toFixed(0)} s of render, past --max-run ${maxRun}`;
            offlineRows.push({ variant, voices, skipped });
            console.error(`offline ${variant} ${voices}: ${skipped}`);
            continue;
          }
          for (let repetition = 1; repetition <= repeat; repetition++) {
            const row = {
              repetition,
              ...(await offline({
                bundle: variant === 'engine' ? 'engine' : 'kernel',
                variant,
                voices,
                tiers: 'cpu',
                seconds,
                warmup,
                ...(variant === 'engine' ? { polyfill: true } : {}),
              })),
            };
            if (repetition === 1 && row.ratio !== undefined) last.set(variant, { voices, ratio: row.ratio });
            offlineRows.push(row);
            console.error(
              `offline ${variant} ${voices} #${repetition}: ratio ${row.ratio?.toFixed(4)}, cpu ratio ${row.cpu?.ratio.toFixed(4)} (${row.cpu?.thread}), ${row.quantumMs?.toFixed(4)} ms a quantum${row.errors.length > 0 ? `; ${row.errors.join('; ')}` : ''}`,
            );
            if ((row.timedMs ?? 0) > 20_000) break;
          }
        }
      }
      loads['offline'] = { before, after: loadavg() };
    }

    if (parts.includes('realtime')) {
      const before = loadavg();
      for (const voices of voiceCounts) {
        for (const variant of ['plain', 'kernel', 'host', 'engine'] as const) {
          if (!variants.includes(variant)) continue;
          const row = await realtime({
            bundle: variant === 'engine' ? 'engine' : 'kernel',
            variant,
            voices,
            seconds: realtimeSeconds,
            ...(variant === 'engine' ? { polyfill: true } : {}),
          });
          realtimeRows.push(row);
          console.error(`realtime ${variant} ${voices}: ${row.error ?? `clock ratio ${row.clockRatio?.toFixed(4)}, cpu ${row.cpu?.ratio.toFixed(4)} (${row.cpu?.thread})`}`);
        }
      }
      loads['realtime'] = { before, after: loadavg() };
    }
  },
  (line) => console.error(`page: ${line}`),
  ['--autoplay-policy=no-user-gesture-required'],
);
record['loadRuns'] = loadRows;
record['offline'] = offlineRows;
record['realtime'] = realtimeRows;
const summary = summarize(offlineRows.filter((r): r is OfflineResult => !('skipped' in r)));
record['summary'] = summary;

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(record, null, 2)}\n`);
const fmt = (v: number | undefined, d = 3): string => (v === undefined ? '' : v.toFixed(d));
const loadText = (k: string): string => {
  const l = loads[k];
  return l === undefined ? '' : ` (load average before ${l.before.map((x) => x.toFixed(2)).join(', ')}; after ${l.after.map((x) => x.toFixed(2)).join(', ')})`;
};
if (loadRows.length > 0) {
  console.log(`\nload${loadText('load')}\n`);
  console.log('| Bundle | Variant | Tiers | Polyfill | addModule (ms) | Result | Output against the reference |');
  console.log('| --- | --- | --- | --- | ---: | --- | --- |');
  for (const r of loadRows) {
    const result = r.loadError ?? (r.errors.length > 0 ? r.errors.join('; ') : 'ran');
    const c = r.check === undefined ? '' : `${r.check.same} of ${r.check.frames} the same bits (${r.check.reference})`;
    console.log(`| ${r.bundle} | ${r.variant} | ${r.tiers} | ${r.polyfill ?? ''} | ${fmt(r.addModuleMs, 1)} | ${result} | ${c} |`);
  }
}
if (offlineRows.length > 0) {
  console.log(`\noffline${loadText('offline')}\n`);
  console.log('| Variant | Voices | Ratio | Quantum (ms) | CPU ratio | Warm-up ratio | Busy by Date.now (ms a quantum) | Same bits as the reference | Errors |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const r of offlineRows) {
    if ('skipped' in r) {
      console.log(`| ${r.variant} | ${r.voices} | | | | | | | ${r.skipped} |`);
      continue;
    }
    const busy = r.stats === undefined || r.stats.quanta === 0 ? undefined : r.stats.busyMs / r.stats.quanta;
    const c = r.check === undefined ? '' : `${r.check.same} of ${r.check.frames}`;
    console.log(`| ${r.variant} | ${r.voices} | ${fmt(r.ratio, 4)} | ${fmt(r.quantumMs, 4)} | ${fmt(r.cpu?.ratio, 4)} | ${fmt(r.warmupRatio, 4)} | ${fmt(busy, 4)} | ${c} | ${r.errors.join('; ')} |`);
  }
}
if (summary.length > 0) {
  console.log('\nsummary: the median of the repetitions, and the voice count at which the ratio reaches 1 and 0.5\n');
  console.log('| Variant | Voices | Runs | Ratio | CPU ratio | Quantum (ms) |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const v of summary) {
    for (const r of v.rows) console.log(`| ${v.variant} | ${r.voices} | ${r.runs} | ${fmt(r.ratio, 4)} | ${fmt(r.cpuRatio, 4)} | ${fmt(r.quantumMs, 4)} |`);
  }
  console.log('\n| Variant | Ratio 1 at | Ratio 0.5 at | CPU ratio 1 at | CPU ratio 0.5 at |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const v of summary) console.log(`| ${v.variant} | ${v.crossing.ratio1} | ${v.crossing.ratio05} | ${v.crossing.cpu1} | ${v.crossing.cpu05} |`);
}
if (realtimeRows.length > 0) {
  console.log(`\nrealtime${loadText('realtime')}\n`);
  console.log('| Variant | Voices | Clock ratio | Quanta | Busy (ms a quantum) | CPU of the busiest thread | Underruns | Underrun (s) | Error |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const r of realtimeRows) {
    const busy = r.stats === undefined || r.stats.quanta === 0 ? undefined : r.stats.busyMs / r.stats.quanta;
    const s = r.playbackStats as { before?: Record<string, number>; after?: Record<string, number> } | undefined;
    const delta = (k: string): number | undefined =>
      s?.after?.[k] === undefined || s.before?.[k] === undefined ? undefined : s.after[k]! - s.before[k]!;
    console.log(
      `| ${r.variant} | ${r.voices} | ${fmt(r.clockRatio, 4)} | ${r.stats?.quanta ?? ''} | ${fmt(busy, 4)} | ${fmt(r.cpu?.ratio, 4)} | ${delta('underrunEvents') ?? ''} | ${fmt(delta('underrunDuration'), 3)} | ${r.error ?? ''} |`,
    );
  }
}
console.log(`\nwrote ${outFile}`);

/** The median of each variant and voice count over its repetitions, and where the ratio crosses
 *  1 and 0.5, interpolated linearly between the two voice counts around it. */
function summarize(rows: readonly OfflineResult[]) {
  const median = (xs: number[]): number | undefined => {
    const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (s.length === 0) return undefined;
    return s.length % 2 === 1 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  };
  const out = [];
  for (const variant of [...new Set(rows.map((r) => r.variant))]) {
    const counts = [...new Set(rows.filter((r) => r.variant === variant).map((r) => r.voices))].sort((a, b) => a - b);
    const medians = counts.map((voices) => {
      const of = rows.filter((r) => r.variant === variant && r.voices === voices);
      return {
        voices,
        runs: of.length,
        ratio: median(of.map((r) => r.ratio ?? Number.NaN)),
        cpuRatio: median(of.map((r) => r.cpu?.ratio ?? Number.NaN)),
        quantumMs: median(of.map((r) => r.quantumMs ?? Number.NaN)),
      };
    });
    const cross = (key: 'ratio' | 'cpuRatio', at: number): string => {
      const pts = medians.filter((m) => m[key] !== undefined) as { voices: number; ratio?: number; cpuRatio?: number }[];
      if (pts.length === 0) return 'not measured';
      const i = pts.findIndex((m) => m[key]! >= at);
      if (i === -1) return `above ${pts[pts.length - 1]!.voices} (${pts[pts.length - 1]![key]!.toFixed(3)} there)`;
      if (i === 0) return `below ${pts[0]!.voices} (${pts[0]![key]!.toFixed(3)} there)`;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const v = a.voices + ((at - a[key]!) * (b.voices - a.voices)) / (b[key]! - a[key]!);
      return `${Math.round(v)} (between ${a.voices} and ${b.voices})`;
    };
    out.push({
      variant,
      rows: medians,
      crossing: { ratio1: cross('ratio', 1), ratio05: cross('ratio', 0.5), cpu1: cross('cpuRatio', 1), cpu05: cross('cpuRatio', 0.5) },
    });
  }
  return out;
}

/** The files of a bundle, their bytes, and what the code names that the scope may not have. */
async function inspect(dir: string, entry: string, split: boolean): Promise<unknown> {
  const files: Record<string, unknown> = {};
  for (const f of await readdir(join(ROOT, dir))) {
    const text = await readFile(join(ROOT, dir, f), 'utf8');
    const count = (re: RegExp): number => text.match(re)?.length ?? 0;
    files[f] = {
      bytes: Buffer.byteLength(text),
      dynamicImports: count(/\bimport\s*\(/g),
      staticImports: count(/^import\s/gm),
      structuredClone: count(/\bstructuredClone\b/g),
      navigator: count(/\bnavigator\b/g),
      OffscreenCanvas: count(/\bOffscreenCanvas\b/g),
      document: count(/\bdocument\b/g),
      MessageChannel: count(/\bMessageChannel\b/g),
    };
  }
  return { entry, split, files };
}
