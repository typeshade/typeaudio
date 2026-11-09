// The split of the `cues` time by kind, on WebGPU (docs/lanes.md, section 6, step 1).
//
//   TYPESHADE_CHROMIUM=<chromium> bun experiments/08-sound-design/run-split.ts [blocks]
//
// It prints the load average and one table: for each kind, the mean GPU time of `cues` for 1 lane
// and for 9 lanes of that kind, and the time of each added lane. Every event starts at frame 0,
// so each lane sounds in every timed block. The default is 40 blocks.

import { dirname } from 'node:path';
import { loadavg } from 'node:os';
import { bundle } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import type { SplitRow } from './split-page.ts';

const blocks = Number(process.argv[2] ?? 40);
const page = await bundle({
  entry: 'experiments/08-sound-design/split-page.ts',
  outDir: 'experiments/08-sound-design/out/split',
  target: 'web',
});
const before = loadavg();
const rows = await inPage(dirname(page), (p) =>
  p.evaluate(
    (n) => (globalThis as unknown as { runSplit(b: number): Promise<SplitRow[]> }).runSplit(n),
    blocks,
  ),
);
const fmt = (xs: readonly number[]): string => xs.map((x) => x.toFixed(2)).join(' ');
console.log(`load average before: ${fmt(before)}; after: ${fmt(loadavg())}`);
const all = rows.find((r) => r.kind === 'all')!;
console.log(
  `whole fixture, ${all.lanes} lanes: cues ${all.cuesMs.toFixed(2)} ms, block median ${all.blockMs.toFixed(2)} ms`,
);
console.log('\n| Kind | cues, 1 lane (ms) | cues, 9 lanes (ms) | Per added lane (ms) |');
console.log('| --- | ---: | ---: | ---: |');
for (const kind of new Set(rows.filter((r) => r.kind !== 'all').map((r) => r.kind))) {
  const one = rows.find((r) => r.kind === kind && r.lanes === 1)!;
  const nine = rows.find((r) => r.kind === kind && r.lanes === 9)!;
  console.log(
    `| ${kind} | ${one.cuesMs.toFixed(2)} | ${nine.cuesMs.toFixed(2)} | ${((nine.cuesMs - one.cuesMs) / 8).toFixed(2)} |`,
  );
}
