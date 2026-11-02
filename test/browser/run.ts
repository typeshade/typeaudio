// The browser check: `render` on WebGPU in headless Chromium (SwiftShader unless
// `TYPESHADE_CHROMIUM` names another Chromium), held to the CPU tier of the same page.
//
//   bun run test:gpu
//
// It checks that the WebGPU render runs on WebGPU, that it and the bank it leaves are the CPU
// tier's within the room the compiler's determinism report leaves the driver (`sin`, `cos` and
// `tanh` within 32 ULP or 2^-11, surface §38), and that each block plans as `docs/architecture.md`
// expects on WebGPU: the voices apart, and the mixdown, the chain and the meter fused.

import { dirname } from 'node:path';
import { bundle } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import type { Side } from './page.ts';

const VOICES = 32;
const FRAMES = 2048;
const BLOCK = 512;
/** The room of the comparison: 2^-11 of full scale, the determinism report's bound (surface §38). */
const ROOM = 2 ** -11;

const page = await bundle({ entry: 'test/browser/page.ts', outDir: 'out/browser', target: 'web' });
type Page = { renderBoth(v: number, f: number, b: number): Promise<Side[]> };
const [gpu, cpu] = await inPage(dirname(page), (p) =>
  p.evaluate(([v, f, b]) => (globalThis as unknown as Page).renderBoth(v!, f!, b!), [VOICES, FRAMES, BLOCK]),
);

const failures: string[] = [];
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const largest = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i]!)), 0);
const same = (a: readonly number[], b: readonly number[]): number =>
  a.filter((x, i) => Object.is(x, b[i])).length;

check(gpu!.tier === 'webgpu', `the first render ran on WebGPU (${gpu!.tier})`);
check(cpu!.tier === 'cpu', `the second render ran on the CPU tier (${cpu!.tier})`);
const outDiff = largest(gpu!.out, cpu!.out);
check(
  outDiff <= ROOM,
  `WebGPU's ${gpu!.out.length} samples are the CPU tier's within 2^-11: largest difference ${outDiff.toExponential(3)}, ${same(gpu!.out, cpu!.out)} the same bits`,
);
const stateDiff = largest(gpu!.state, cpu!.state);
check(
  stateDiff <= ROOM,
  `the bank's state after the renders is the CPU tier's within 2^-11: largest difference ${stateDiff.toExponential(3)}, ${same(gpu!.state, cpu!.state)} of ${gpu!.state.length} the same bits`,
);
check(Math.abs(gpu!.peak - cpu!.peak) <= ROOM, `the peaks agree (${gpu!.peak} and ${cpu!.peak})`);
const blocks = gpu!.reports;
check(blocks.length === FRAMES / BLOCK, `one fuse report for each block (${blocks.length})`);
for (const [i, report] of blocks.entries()) {
  const groups = report.groups.map((g) => `${g.calls.join('+')}${g.fused ? ' (fused)' : ''}`);
  check(
    report.tier === 'webgpu' &&
      report.submissions === 1 &&
      JSON.stringify(groups) === JSON.stringify(['synth', 'mixdown+drive+gain+peak (fused)']),
    `block ${i + 1} plans as two groups in one submission: ${groups.join(', ')}; ${report.dispatches} dispatches`,
  );
}
console.log(`\nexplain(plan.reports) on WebGPU:\n${gpu!.explain}\n`);
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('The browser check passed.');
