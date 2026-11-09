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
import type { SpatialSide } from './page-spatial.ts';

const VOICES = 32;
const FRAMES = 2048;
const BLOCK = 512;
/** The room of the comparison: 2^-11 of full scale, the determinism report's bound (surface §38). */
const ROOM = 2 ** -11;

const page = await bundle({ entry: 'test/browser/page.ts', outDir: 'out/browser', target: 'web' });
type Page = { renderBoth(v: number, f: number, b: number): Promise<Side[]> };
const [gpu, cpu] = await inPage(dirname(page), (p) =>
  p.evaluate(
    ([v, f, b]) => (globalThis as unknown as Page).renderBoth(v!, f!, b!),
    [VOICES, FRAMES, BLOCK],
  ),
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

// The layered render (experiment 8): an impact, a whoosh and a shimmer through the spatial chain and
// the reverb, on WebGPU and on the CPU tier. The tolerance is 4 x 2^-11 of the CPU tier's peak.
// Surface section 38 bounds each `sin`, `cos` and `exp` at 2^-11 per operation. The layered chain
// runs many of them in series (filters, envelopes, the reverb), and the whole-clip comparison of
// record 08 observed 6.4e-4 of a peak 0.486, which is 2.7 x 2^-11. The earlier bound of exactly
// 2^-11 passed on a short render by luck.
const spatialPage = await bundle({
  entry: 'test/browser/page-spatial.ts',
  outDir: 'out/browser-spatial',
  target: 'web',
});
type SpatialPage = { spatialBoth(): Promise<SpatialSide[]> };
const [sg, sc] = await inPage(dirname(spatialPage), (p) =>
  p.evaluate(() => (globalThis as unknown as SpatialPage).spatialBoth()),
);
check(
  sg!.tier === 'webgpu' && sc!.tier === 'cpu',
  `the layered render ran on ${sg!.tier} and on ${sc!.tier}`,
);
const peakOf = (x: readonly number[]): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
for (const [name, a, b] of [
  ['effects stem, left', sg!.effects[0], sc!.effects[0]],
  ['effects stem, right', sg!.effects[1], sc!.effects[1]],
  ['reverb return, left', sg!.wet[0], sc!.wet[0]],
  ['reverb return, right', sg!.wet[1], sc!.wet[1]],
] as const) {
  const room = peakOf(b) * 4 * 2 ** -11;
  const d = largest(a, b);
  check(
    peakOf(b) > 0.01 && d <= room,
    `${name}: WebGPU is the CPU tier's within 4 x 2^-11 of its peak ${peakOf(b).toFixed(3)} (bound ${room.toExponential(3)}): largest difference ${d.toExponential(3)}, ${same(a, b)} of ${a.length} the same bits`,
  );
}
check(
  sg!.submissions === 1,
  `a block of the layered render is one submission on WebGPU (${sg!.submissions} submissions, ${sg!.dispatches} dispatches)`,
);
console.log(`the last block's groups on WebGPU: ${sg!.groups.join(', ')}\n`);
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('The browser check passed.');
