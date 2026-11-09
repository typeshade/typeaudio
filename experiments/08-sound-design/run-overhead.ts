// The three forms of the `cues` kernel (docs/lanes.md, "Step 1b: the overhead").
//
//   TYPESHADE_CHROMIUM=<chromium> bun experiments/08-sound-design/run-overhead.ts [blocks]
//
// It prints the load average and one table: for the kernel of `src/kinds/cue.shade.ts`, the hoisted
// form and the narrow form, 1 lane and 9 lanes of `whoosh`, on WebGPU (GPU time) and on the CPU
// tier (host time). The default is 40 blocks.

import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { dirname, delimiter, join } from 'node:path';
import { loadavg } from 'node:os';
import { bundle } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import type { OverheadRow } from './overhead.ts';

const blocks = Number(process.argv[2] ?? 40);
const HERE = 'experiments/08-sound-design';

async function nodeBinary(): Promise<string> {
  const named = process.env['NODE_BINARY'];
  if (named) return named;
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    const candidate = join(dir, 'node');
    const real = await realpath(candidate).catch(() => undefined);
    if (real !== undefined && !/(^|[/\\])bun(\.exe)?$/.test(real)) return candidate;
  }
  throw new Error('run-overhead.ts: found no Node on PATH. Name it with NODE_BINARY.');
}

function runNode(node: string, argv: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(node, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(`node exited ${code}`))));
  });
}

const fmt = (xs: readonly number[]): string => xs.map((x) => x.toFixed(2)).join(' ');
const before = loadavg();
const page = await bundle({
  entry: `${HERE}/overhead-page.ts`,
  outDir: `${HERE}/out/overhead-web`,
  target: 'web',
});
const gpu = await inPage(dirname(page), (p) =>
  p.evaluate(
    (n) =>
      (
        globalThis as unknown as { runOverheadPage(b: number): Promise<OverheadRow[]> }
      ).runOverheadPage(n),
    blocks,
  ),
);
const main = await bundle({
  entry: `${HERE}/overhead-node.ts`,
  outDir: `${HERE}/out/overhead-node`,
  target: 'node',
});
const cpu = JSON.parse(await runNode(await nodeBinary(), [main, String(blocks)])) as OverheadRow[];
console.log(`load average before: ${fmt(before)}; after: ${fmt(loadavg())}`);
console.log(
  '\n| Form | WebGPU 1 lane GPU (ms) | WebGPU 9 lanes GPU (ms) | WebGPU per added lane (ms) | CPU 1 lane (ms) | CPU 9 lanes (ms) | CPU per added lane (ms) |',
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const form of ['cues', 'hoisted', 'wide', 'oneBranch', 'inlined', 'narrow']) {
  const g = (lanes: number): OverheadRow => gpu.find((r) => r.form === form && r.lanes === lanes)!;
  const c = (lanes: number): OverheadRow => cpu.find((r) => r.form === form && r.lanes === lanes)!;
  const gg = [g(1).gpuMs ?? NaN, g(9).gpuMs ?? NaN];
  const cc = [c(1).hostMs, c(9).hostMs];
  console.log(
    `| ${form} | ${gg[0]!.toFixed(2)} | ${gg[1]!.toFixed(2)} | ${((gg[1]! - gg[0]!) / 8).toFixed(2)} | ${cc[0]!.toFixed(2)} | ${cc[1]!.toFixed(2)} | ${((cc[1]! - cc[0]!) / 8).toFixed(2)} |`,
  );
}
