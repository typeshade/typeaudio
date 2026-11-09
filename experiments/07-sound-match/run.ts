// Experiment 7, a sound match with function-level `grad` (docs/experiments.md, section 7).
//
//   bun run exp:07 [--tier all|cpu,oracle,webgpu,webgl2] [--counts 3,10,30,100]
//                  [--forms forward,along,reverse] [--warmup 30] [--warmup-ms 2000]
//                  [--runs 30] [--gpu-warmup 5] [--gpu-warmup-ms 1000] [--gpu-runs 20]
//                  [--timeout 300] [--iterations 300] [--out <file.json>] [--raw <file.json>]
//   bun run exp:07 --write      writes patch-3/10/30/100.shade.ts from patch.ts, and nothing else
//
// The patch is a two-operator FM voice whose parameters are the ratio, the index and the levels of
// an envelope's breakpoints; its loss is a log-power distance to a target over 16 bins of a
// 1,024-point DFT (`patch.ts`). For each parameter count it times the render alone, the loss alone,
// and one step of an Adam descent with the gradient taken in each form:
//
// - `forward`: forward-mode `grad` per parameter, one derivative function for each (the method);
// - `along`: forward-mode `grad` of `lossAlong` in `t`, one function called once for each parameter
//   with that parameter's direction as an argument (the form the GPU tiers run);
// - `reverse`: reverse-mode `grad` with respect to every parameter, one call (change 0056).
//
// Four arms:
//
// - `cpu`: the CPU tier in Node. The harness is bundled with Vite, the compiler's plugin and the
//   compiler (`typescript` kept external) and run with the Node on PATH (`NODE_BINARY` names another).
//   The render and the loss run through the host face as well; the derivatives through
//   `compileModuleJs` at `f32`, the host face's code generator, since the host face has none (`cpu.ts`).
// - `oracle`: the same in this process, Bun. It also runs the descent of 3 parameters to its end
//   (`--iterations`), `gradCheck` in both modes, and holds the loss's bins and the match to the
//   FFT of experiment 3 (`fftSmallTable` on the oracle) and to an `f64` FFT.
// - `webgpu` and `webgl2`: the packed program of each count (`program.ts`) in headless Chromium
//   on SwiftShader (`TYPESHADE_CHROMIUM` names the binary), a fresh browser for each tier: the
//   render, the loss, forward mode as one dispatch of one invocation per parameter, and reverse mode
//   in one invocation, and the descent of 3 parameters.
//
// It writes the result as JSON (`--out`), the outputs themselves to `--raw` (the frames each GPU tier
// read back, as base64 of their `f32`s, and every gradient the comparisons read), and prints the
// tables. A number without its record is not a result: the record is `docs/records/`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { cpus, loadavg, platform, release } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { buildInfo, compile, compileModuleJs } from 'typeshade';
import { bundle, ROOT } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { oracleOf } from '../03-fft/oracle.ts';
import { fft64, toBase64, twiddleTable } from '../03-fft/signals.ts';
import type { PageOptions, PageResult } from './browser.ts';
import { checks, descend, FORMS, measure, prepare, type CountResult, type Descent, type Form } from './cpu.ts';
import { gradientDistance, type Repeats, type Timing } from './match.ts';
import type { NodeCount, NodeOptions } from './node.ts';
import { BINS, COUNTS, EPS, FRAMES, LOSS_BINS, namesOf, patchSource, startOf, truthOf } from './patch.ts';
import { buildProgram, checkProgram, type Program, type ProgramCheck } from './program.ts';
import { probeRefusals, type RefusalResult } from './refusals.ts';

const ARMS = ['cpu', 'oracle', 'webgpu', 'webgl2'] as const;
type Arm = (typeof ARMS)[number];
const HERE = 'experiments/07-sound-match';
const moduleFile = (count: number): string => join(ROOT, HERE, `patch-${count}.shade.ts`);

const argv = process.argv.slice(2);
if (argv.includes('--write')) {
  for (const count of COUNTS) await writeFile(moduleFile(count), patchSource(count));
  console.log(`wrote ${COUNTS.map((c) => `${HERE}/patch-${c}.shade.ts`).join(', ')}`);
  process.exit(0);
}
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 2) {
  const key = argv[i]!;
  const value = argv[i + 1];
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
const whole = (name: string, fallback: number, least = 1): number => {
  const v = Number(args.get(name) ?? fallback);
  if (!Number.isInteger(v) || v < least) throw new Error(`run.ts: --${name} takes a whole number of ${least} or more.`);
  return v;
};
const arms = listOf<Arm>('tier', ARMS);
const counts = listOf<number>('counts', COUNTS);
const forms = listOf<Form>('forms', FORMS);
const repeats: Repeats = { warmup: whole('warmup', 30), warmupMs: whole('warmup-ms', 2000, 0), runs: whole('runs', 30) };
const gpuRepeats: Repeats = { warmup: whole('gpu-warmup', 5), warmupMs: whole('gpu-warmup-ms', 1000, 0), runs: whole('gpu-runs', 20) };
const timeoutMs = whole('timeout', 300) * 1000;
const iterations = whole('iterations', 300, 0);
const outFile = args.get('out') ?? join(ROOT, HERE, 'out/result.json');
const rawFile = args.get('raw') ?? join(ROOT, HERE, 'out/raw.json');

// The modules in the tree must be the ones `patch.ts` writes: the record names the commit, and the
// commit holds the programs that ran.
for (const count of COUNTS) {
  const text = await readFile(moduleFile(count), 'utf8').catch(() => '');
  if (text !== patchSource(count)) {
    throw new Error(`run.ts: ${HERE}/patch-${count}.shade.ts is not what patch.ts writes. Run \`bun run exp:07 --write\` and commit it.`);
  }
}

const git = (...a: string[]): string => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const versionOf = async (pkg: string): Promise<string> =>
  (JSON.parse(await readFile(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')) as { version: string }).version;
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { devDependencies: Record<string, string> };
const began = Date.now();
const record: Record<string, unknown> = {
  experiment: '07-sound-match',
  date: new Date(began).toISOString(),
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  pin: pkg.devDependencies['typeshade'],
  compiler: buildInfo,
  tools: { bun: process.versions['bun'] ?? null, vite: await versionOf('vite'), 'playwright-core': await versionOf('playwright-core') },
  options: { arms, counts, forms, repeats, gpuRepeats, timeoutMs, iterations },
  patch: { frames: FRAMES, bins: LOSS_BINS, eps: EPS },
};
/** The machine's load average over 1, 5 and 15 minutes, before and after each arm. */
const loads: Record<string, { before: number[]; after: number[] }> = {};
record['load'] = loads;
const failures: Record<string, string> = {};
record['failures'] = failures;

// The target of each count: `logPower` of the known answer on the oracle at `f32`, which every arm
// holds its loss to, so the loss is 0 at the known answer on the oracle.
const sources = new Map<number, string>();
const targets: Record<string, number[]> = {};
for (const count of counts) {
  const source = await readFile(moduleFile(count), 'utf8');
  sources.set(count, source);
  const cpu = compileModuleJs(compile(source).module, { precision: 'f32' });
  targets[String(count)] = (cpu.fns['logPower']!(...truthOf(count)) as unknown as number[][]).flat();
}
record['targets'] = targets;

const results: { cpu?: { environment: unknown; counts: NodeCount[] }; oracle?: { environment: unknown; counts: CountResult[] } } = {};
const pages: Partial<Record<'webgpu' | 'webgl2', PageResult>> = {};

if (arms.includes('cpu')) {
  const main = await bundle({ entry: `${HERE}/node.ts`, outDir: `${HERE}/out/node`, target: 'node', external: ['typescript'] });
  const before = loadavg();
  const options: NodeOptions = { root: ROOT, counts, forms, repeats, targets };
  try {
    results.cpu = JSON.parse(await runNode(await nodeBinary(), [main, JSON.stringify(options)]));
  } catch (e) {
    failures['cpu'] = String(e);
    console.error(`cpu: ${String(e)}`);
  }
  loads['cpu'] = { before, after: loadavg() };
}

let descent: Descent | undefined;
let plainDescent: Descent | undefined;
let gradChecks: ReturnType<typeof checks> | undefined;
let fftChecks: Record<string, unknown> | undefined;
let refusals: RefusalResult[] | undefined;
if (arms.includes('oracle')) {
  const before = loadavg();
  refusals = probeRefusals();
  const measured: CountResult[] = [];
  for (const count of counts) {
    const prep = prepare(sources.get(count)!, count, targets[String(count)]);
    measured.push(measure(prep, repeats, forms, (line) => console.error(`oracle ${line}`)));
    if (count === 3) {
      if (iterations > 0) {
        descent = descend(prep, iterations, 'adam', 0.01);
        plainDescent = descend(prep, iterations, 'plain', 0.002);
      }
      gradChecks = checks(prep);
      fftChecks = holdToFft(await readFile(join(ROOT, 'experiments/03-fft/fft.shade.ts'), 'utf8'), prep.render as (...a: number[]) => ArrayLike<number>, descent);
    }
  }
  const cpu = cpus();
  results.oracle = {
    environment: { bun: process.versions['bun'], cpu: cpu[0]?.model ?? 'unknown', cores: cpu.length, os: `${platform()} ${release()}` },
    counts: measured,
  };
  loads['oracle'] = { before, after: loadavg() };
}

const programs: Program[] = [];
const programChecks: (ProgramCheck & { count: number })[] = [];
const pageTiers = arms.filter((a): a is 'webgpu' | 'webgl2' => a === 'webgpu' || a === 'webgl2');
if (pageTiers.length > 0) {
  for (const count of counts) {
    const p = buildProgram(count);
    programs.push(p);
    // The swap, held on the oracle to the CPU arm's own values at the start.
    const prep = prepare(sources.get(count)!, count, targets[String(count)]);
    const start = startOf(count);
    programChecks.push({
      count,
      ...checkProgram(p, start, targets[String(count)]!, {
        frames: Array.from(prep.render(...start) as ArrayLike<number>),
        loss: prep.loss(...start, ...prep.target) as number,
        along: prep.gradient.along(start),
        reverse: prep.gradient.reverse(start),
      }),
    });
  }
  const page = await bundle({ entry: `${HERE}/browser.ts`, outDir: `${HERE}/out/web`, target: 'web' });
  for (const p of programs) {
    await writeFile(join(dirname(page), `program-${p.count}.json`), JSON.stringify(p.pack));
    await writeFile(join(dirname(page), `program-${p.count}.source.txt`), p.source);
  }
  type Page = { runMatch(o: PageOptions): Promise<PageResult> };
  for (const tier of pageTiers) {
    const before = loadavg();
    const seen = new Map<string, number>();
    const options: PageOptions = { tier, counts, repeats: gpuRepeats, timeoutMs, targets, iterations };
    // The page bounds each call; this bounds the page, in case its script stops yielding.
    const limit = timeoutMs * (counts.length * 4 * (gpuRepeats.runs + gpuRepeats.warmup + 2) + 2 * iterations + 8);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      pages[tier] = await inPage(
        dirname(page),
        (p) =>
          Promise.race([
            p.evaluate((o) => (globalThis as unknown as Page).runMatch(o), options),
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
    // Every distinct line of the page's console, with how often it came: the page's own progress
    // lines, and what Chromium and the runtime printed.
    record[`console-${tier}`] = [...seen].map(([line, count]) => ({ line, count }));
    loads[tier] = { before, after: loadavg() };
  }
}

// ---- The comparison ----

/** The oracle's values at the start, by count, which the other arms are held to. */
const oracleOfCount = (count: number): CountResult | undefined => results.oracle?.counts.find((c) => c.count === count);
const oracleFrames = new Map<number, number[]>();
for (const count of counts) {
  const cpu = compileModuleJs(compile(sources.get(count)!).module, { precision: 'f32' });
  oracleFrames.set(count, [...(cpu.fns['render']!(...truthOf(count)) as unknown as number[])]);
}
const gpuAgreement = pageTiers.flatMap((tier) =>
  (pages[tier]?.counts ?? []).map((c) => {
    const o = oracleOfCount(c.count);
    const frames = oracleFrames.get(c.count)!;
    const against = (ys: readonly number[] | undefined): { differ: number; of: number; largest: number } | undefined => {
      if (ys === undefined) return undefined;
      let differ = 0;
      let largest = 0;
      for (let i = 0; i < FRAMES; i++) {
        if (!Object.is(Math.fround(ys[i]!), Math.fround(frames[i]!))) differ++;
        largest = Math.max(largest, Math.abs(ys[i]! - frames[i]!));
      }
      return { differ, of: FRAMES, largest };
    };
    const one = c.renderOutput;
    const each = c.framesOutput;
    return {
      tier,
      count: c.count,
      frames: against(one),
      framesEntry: against(each),
      renderAgainstFrames: one === undefined || each === undefined ? undefined : one.filter((v, i) => !Object.is(v, each[i])).length,
      lossAtStart: c.lossAtStart === undefined || o === undefined ? undefined : { gpu: c.lossAtStart, oracle: o.lossAtStart },
      forward: c.forwardGradient === undefined || o?.gradients.forward === undefined ? undefined : gradientDistance(o.gradients.forward, c.forwardGradient),
      reverse: c.reverseGradient === undefined || o?.gradients.forward === undefined ? undefined : gradientDistance(o.gradients.forward, c.reverseGradient),
      forwardAgainstReference: c.forwardGradient === undefined || o === undefined ? undefined : gradientDistance(o.reference, c.forwardGradient),
      reverseAgainstReference: c.reverseGradient === undefined || o === undefined ? undefined : gradientDistance(o.reference, c.reverseGradient),
    };
  }),
);

// WebGL2 against WebGPU, value by value: the outputs whose `f32` bits differ.
const bitsDiffer = (a: readonly number[] | undefined, b: readonly number[] | undefined): number | undefined =>
  a === undefined || b === undefined ? undefined : a.filter((v, i) => !Object.is(Math.fround(v), Math.fround(b[i]!))).length;
record['tiersAgainstEachOther'] = counts.map((count) => {
  const a = pages.webgpu?.counts.find((c) => c.count === count);
  const b = pages.webgl2?.counts.find((c) => c.count === count);
  return {
    count,
    render: bitsDiffer(a?.renderOutput, b?.renderOutput),
    frames: bitsDiffer(a?.framesOutput, b?.framesOutput),
    lossAtStart: a?.lossAtStart === undefined || b?.lossAtStart === undefined ? undefined : bitsDiffer([a.lossAtStart], [b.lossAtStart]),
    forward: bitsDiffer(a?.forwardGradient, b?.forwardGradient),
    reverse: bitsDiffer(a?.reverseGradient, b?.reverseGradient),
    descent: bitsDiffer(a?.descent?.losses, b?.descent?.losses),
  };
});

record['environments'] = {
  cpu: results.cpu?.environment,
  oracle: results.oracle?.environment,
  ...Object.fromEntries(pageTiers.map((t) => [t, { renderer: pages[t]?.renderer, userAgent: pages[t]?.userAgent }])),
};
// The outputs go to `--raw`; the record keeps what was measured of them.
const raw: Record<string, unknown> = {};
const asBits = (xs: readonly number[] | undefined): string | undefined => (xs === undefined ? undefined : toBase64(Float32Array.from(xs)));
const measured = <C extends CountResult>(arm: string, cs: readonly C[] | undefined) =>
  cs?.map((c) => {
    raw[`${arm} ${c.count}`] = { gradients: c.gradients, reference: c.reference };
    const { gradients: _g, reference: _r, ...kept } = c;
    return kept;
  });
record['cpu'] = measured('cpu', results.cpu?.counts);
record['oracle'] = measured('oracle', results.oracle?.counts);
record['pages'] = Object.fromEntries(
  pageTiers.map((tier) => {
    const page = pages[tier];
    if (page === undefined) return [tier, undefined];
    return [
      tier,
      {
        ...page,
        counts: page.counts.map((c) => {
          raw[`${tier} ${c.count}`] = {
            renderOutput: asBits(c.renderOutput),
            framesOutput: asBits(c.framesOutput),
            forwardGradient: c.forwardGradient,
            reverseGradient: c.reverseGradient,
          };
          const { renderOutput: _a, framesOutput: _b, forwardGradient: _c, reverseGradient: _d, ...kept } = c;
          return kept;
        }),
      },
    ];
  }),
);
record['programs'] = programs.map((p) => ({ count: p.count, tapeBytes: p.tapeBytes, wgslChars: p.wgslChars, glComputes: p.glComputes, ms: p.ms }));
record['programChecks'] = programChecks;
record['gpuAgreement'] = gpuAgreement;
record['descent'] = descent;
record['plainDescent'] = plainDescent;
record['gradCheck'] = gradChecks;
record['fft'] = fftChecks;
record['refusals'] = refusals;
record['seconds'] = (Date.now() - began) / 1000;

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
const ms = (t: Timing | undefined): string => (t === undefined ? 'n/a' : `${fix(t.median)} / ${fix(t.p95)}`);
const fix = (v: number): string => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
const ratio = (a: Timing | undefined, b: Timing | undefined): string => (a === undefined || b === undefined ? 'n/a' : fix(a.median / b.median));
interface Row {
  arm: Arm;
  count: number;
  render?: Timing;
  /** The GPU tiers' render by one invocation for each frame. */
  frames?: Timing;
  loss?: Timing;
  steps: Partial<Record<Form, Timing>>;
}
const rows: Row[] = [];
for (const count of counts) {
  const c = results.cpu?.counts.find((x) => x.count === count);
  if (c !== undefined) rows.push({ arm: 'cpu', count, render: c.render, loss: c.loss, steps: c.steps });
  const o = oracleOfCount(count);
  if (o !== undefined) rows.push({ arm: 'oracle', count, render: o.render, loss: o.loss, steps: o.steps });
  for (const tier of pageTiers) {
    const g = pages[tier]?.counts.find((x) => x.count === count);
    if (g?.render !== undefined) rows.push({ arm: tier, count, render: g.render, frames: g.frames, loss: g.loss, steps: { along: g.forward, reverse: g.reverse } });
  }
}
table(
  'Time per call (ms): median / p95. A step is the gradient and Adam\'s update; GPU forward mode is `along` (one dispatch, one invocation per parameter); "Frames" is the GPU render with one invocation per frame',
  ['Arm', 'Params', 'Render', 'Frames', 'Loss', ...FORMS],
  rows.map((r) => [r.arm, String(r.count), ms(r.render), ms(r.frames), ms(r.loss), ...FORMS.map((f) => ms(r.steps[f]))]),
);
table(
  'Step time over render time (medians); on the GPU tiers over the render with one invocation per frame in brackets',
  ['Arm', 'Params', 'Loss / render', ...FORMS],
  rows.map((r) => [
    r.arm,
    String(r.count),
    ratio(r.loss, r.render),
    ...FORMS.map((f) => (r.frames === undefined || r.steps[f] === undefined ? ratio(r.steps[f], r.render) : `${ratio(r.steps[f], r.render)} (${ratio(r.steps[f], r.frames)})`)),
  ]),
);
table(
  'Step time over loss time (medians)',
  ['Arm', 'Params', ...FORMS],
  rows.map((r) => [r.arm, String(r.count), ...FORMS.map((f) => ratio(r.steps[f], r.loss))]),
);
if (results.cpu !== undefined) {
  table(
    'The CPU tier in Node: the host face against compileModuleJs (median ms), and what agrees',
    ['Params', 'Render (face)', 'Loss (face)', 'Same render bits', 'Same loss bits', 'Same target bits'],
    results.cpu.counts.map((c) => [String(c.count), ms(c.hostFace.render), ms(c.hostFace.loss), String(c.hostFace.sameRender), String(c.hostFace.sameLoss), String(c.sameTarget)]),
  );
}
const codegenOf = results.oracle?.counts ?? results.cpu?.counts ?? [];
table(
  'Building the derivatives (oracle arm, ms): grad calls / compileModuleJs; functions added; tape bytes',
  ['Params', ...FORMS, 'Added (fwd, along, rev)', 'Tape bytes'],
  codegenOf.map((c) => [
    String(c.count),
    ...FORMS.map((f) => `${fix(c.codegen.gradMs[f])} / ${fix(c.codegen.compileMs[f])}`),
    `${c.codegen.added.forward}, ${c.codegen.added.along}, ${c.codegen.added.reverse}`,
    String(c.codegen.tapeBytes),
  ]),
);
table(
  'Each form\'s gradient at the start against forward mode\'s on the oracle at f64: largest difference over the largest magnitude',
  ['Arm', 'Params', ...FORMS],
  [...(results.cpu?.counts.map((c) => ['cpu', c] as const) ?? []), ...(results.oracle?.counts.map((c) => ['oracle', c] as const) ?? [])].map(([arm, c]) => [
    arm,
    String(c.count),
    ...FORMS.map((f) => (c.againstReference[f] === undefined ? 'n/a' : c.againstReference[f]!.relative.toExponential(1))),
  ]),
);
table(
  'Each form\'s gradient at the start against forward mode\'s: largest difference over the largest magnitude; values whose f32 bits differ',
  ['Arm', 'Params', ...FORMS],
  [...(results.cpu?.counts.map((c) => ['cpu', c] as const) ?? []), ...(results.oracle?.counts.map((c) => ['oracle', c] as const) ?? [])].map(([arm, c]) => [
    arm,
    String(c.count),
    ...FORMS.map((f) => (c.agreement[f] === undefined ? 'n/a' : `${c.agreement[f]!.relative.toExponential(1)}; ${c.agreement[f]!.differ} of ${c.count}`)),
  ]),
);
if (programs.length > 0) {
  table(
    'The GPU programs: WGSL characters, entries with a WebGL2 pass program, tape bytes, build (ms: compile, grad, pack)',
    ['Params', 'WGSL', 'WebGL2 passes', 'Tape bytes', 'Build'],
    programs.map((p) => [String(p.count), String(p.wgslChars), String(p.glComputes.length), String(p.tapeBytes), `${fix(p.ms.compile)}, ${fix(p.ms.grad)}, ${fix(p.ms.pack)}`]),
  );
  table(
    'The swapped program on the oracle against the CPU arm: bit for bit',
    ['Params', 'renderEntry', 'framesEntry', 'lossEntry', 'forwardStep', 'reverseStep'],
    programChecks.map((c) => [String(c.count), String(c.render), String(c.frames), String(c.loss), String(c.forward), String(c.reverse)]),
  );
  table(
    'The GPU tiers against the oracle: frames whose bits differ (largest difference), by one invocation and by one per frame; loss at the start; gradients against forward mode on the oracle at f32, and at f64 in brackets',
    ['Tier', 'Params', 'Frames (one)', 'Frames (each)', 'Loss (GPU / oracle)', 'Forward', 'Reverse'],
    gpuAgreement.map((g) => [
      g.tier,
      String(g.count),
      g.frames === undefined ? 'n/a' : `${g.frames.differ} of ${g.frames.of} (${g.frames.largest.toExponential(1)})`,
      g.framesEntry === undefined ? 'n/a' : `${g.framesEntry.differ} of ${g.framesEntry.of} (${g.framesEntry.largest.toExponential(1)})`,
      g.lossAtStart === undefined ? 'n/a' : `${g.lossAtStart.gpu.toPrecision(6)} / ${g.lossAtStart.oracle.toPrecision(6)}`,
      g.forward === undefined ? 'n/a' : `${g.forward.relative.toExponential(1)} (${g.forwardAgainstReference?.relative.toExponential(1) ?? 'n/a'})`,
      g.reverse === undefined ? 'n/a' : `${g.reverse.relative.toExponential(1)} (${g.reverseAgainstReference?.relative.toExponential(1) ?? 'n/a'})`,
    ]),
  );
  const refused = pageTiers.flatMap((t) => (pages[t]?.counts ?? []).filter((c) => c.refused !== undefined || c.unfinished !== undefined).map((c) => `- ${t} ${c.count}: ${c.refused ?? c.unfinished}`));
  if (refused.length > 0) lines.push('', 'Refused, or not finished', '', ...refused);
}
const curve = (losses: readonly number[]): string =>
  [0, 10, 50, 100, 200, losses.length - 1].filter((i) => i < losses.length).map((i) => `${i}: ${losses[i]!.toExponential(2)}`).join(', ');
for (const d of [descent, plainDescent]) {
  if (d === undefined) continue;
  lines.push('', `The descent of 3 parameters on the oracle (${d.optimizer}, rate ${d.rate}): loss ${curve(d.losses)}`);
  lines.push(`  final ${d.final.map((v) => v.toFixed(5)).join(', ')}; known answer ${d.truth.join(', ')}; start ${d.start.join(', ')}`);
}
for (const tier of pageTiers) {
  const d = pages[tier]?.counts.find((c) => c.count === 3)?.descent;
  if (d !== undefined) lines.push(`The descent of 3 parameters on ${tier}: loss ${curve(d.losses)}; final ${d.final.map((v) => v.toFixed(5)).join(', ')}`);
}
if (gradChecks !== undefined) {
  lines.push('', `gradCheck at ${gradChecks.at.map((p) => `(${p.map((v) => v.toFixed(3)).join(', ')})`).join(' and ')}: forward ${JSON.stringify(gradChecks.forward)}; reverse ${JSON.stringify(gradChecks.reverse)}`);
  lines.push(`  the worst |derivative - difference| / max(1, |difference|): forward ${JSON.stringify(gradChecks.agreement.forward)}; reverse ${JSON.stringify(gradChecks.agreement.reverse)}`);
}
if (fftChecks !== undefined) lines.push('', `The FFT checks: ${JSON.stringify(fftChecks)}`);
if (refusals !== undefined) {
  lines.push('', 'What grad does with the forms the method asks for');
  for (const r of refusals) lines.push(`- ${r.name} (${r.why}), ${r.mode}: ${r.outcome}${r.sentence === undefined ? '' : `: ${r.sentence.split('\n')[0]}`}`);
}
for (const [arm, sentence] of Object.entries(failures)) lines.push('', `${arm} failed: ${sentence}`);
const load = Object.entries(loads).map(([arm, l]) => `${arm}: ${l.before.map((x) => x.toFixed(2)).join(', ')} -> ${l.after.map((x) => x.toFixed(2)).join(', ')}`);
lines.push('', `Load average before -> after: ${load.join('; ')}`, `Seconds: ${String(record['seconds'])}`);
console.log(lines.join('\n'));
console.log(`\nwrote ${outFile} and ${rawFile}`);

/**
 * Holds the loss's bins and the match to experiment 3's FFT: `fftSmallTable`, the 1,024-point entry
 * with the host's twiddle table, on the oracle at `f32` (`../03-fft/oracle.ts`), and `fft64`.
 */
function holdToFft(fftSource: string, render: (...a: number[]) => ArrayLike<number>, d: Descent | undefined): Record<string, unknown> {
  const fft = oracleOf(fftSource);
  const complex = (frames: ArrayLike<number>): Float32Array => {
    const src = new Float32Array(2 * FRAMES);
    for (let i = 0; i < FRAMES; i++) src[2 * i] = frames[i]!;
    return src;
  };
  const logPowers = (y: ArrayLike<number>): number[] =>
    Array.from({ length: FRAMES / 2 }, (_, k) => Math.log(y[2 * k]! * y[2 * k]! + y[2 * k + 1]! * y[2 * k + 1]! + EPS));
  const spectra = (frames: ArrayLike<number>): { table: number[]; f64: number[] } => {
    const src = complex(frames);
    return { table: logPowers(fft.run('fftSmallTable', 'forward', FRAMES, 1, src, twiddleTable(FRAMES))), f64: logPowers(fft64(src, FRAMES, 'forward')) };
  };
  const truth = spectra(render(...truthOf(3)));
  const target = targets['3']!;
  const largest = (a: readonly number[], b: (k: number) => number): number => Math.max(...LOSS_BINS.map((k, i) => Math.abs(a[i]! - b(k))));
  const out: Record<string, unknown> = {
    bins: LOSS_BINS,
    lossBinsAgainstTable: largest(target, (k) => truth.table[k]!),
    lossBinsAgainstF64: largest(target, (k) => truth.f64[k]!),
    tableAgainstF64: Math.max(...truth.table.map((v, k) => Math.abs(v - truth.f64[k]!))),
  };
  const distance = (a: readonly number[], b: readonly number[]): number => a.reduce((s, v, k) => s + (v - b[k]!) ** 2, 0) / a.length;
  const start = spectra(render(...startOf(3)));
  out['fullSpectrumAtStart'] = { table: distance(start.table, truth.table), f64: distance(start.f64, truth.f64) };
  if (d !== undefined) {
    const end = spectra(render(...d.final));
    out['fullSpectrumAtEnd'] = { table: distance(end.table, truth.table), f64: distance(end.f64, truth.f64) };
  }
  return out;
}

/** The Node binary on PATH: the first `node` that is not Bun's alias of itself (as experiment 3's runner). */
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
