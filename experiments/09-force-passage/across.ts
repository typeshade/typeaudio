// Experiment 9, a page tier's mix against the CPU tier's (docs/experiments.md, section 9, method step 4).
//
//   bun experiments/09-force-passage/across.ts <directory of the page tier> <directory of the CPU tier> [--tier webgpu]
//
// Each directory holds the files of one run of `run.ts` with the same `--blocks`. It prints how many
// values of the two mixes differ, the largest difference and the relative RMS of the difference
// (`experiments/08-sound-design/across.ts`).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareMixes } from '../08-sound-design/across.ts';

const [pageDir, cpuDir] = process.argv.slice(2);
if (pageDir === undefined || cpuDir === undefined)
  throw new Error(
    'across.ts: name the directory of the page tier and the directory of the CPU tier.',
  );
const flag = process.argv.indexOf('--tier');
const tier = flag > 0 ? process.argv[flag + 1]! : 'webgpu';
const read = async (dir: string, name: string): Promise<Float32Array> => {
  const raw = await readFile(join(dir, name));
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
};
const page = await read(pageDir, `mix-${tier}.f32`);
const cpu = await read(cpuDir, 'mix-cpu.f32');
const d = compareMixes(page, page.length / 2, cpu, cpu.length / 2);
if ('skipped' in d) {
  console.log(`${tier}-cpu: not compared. ${d.skipped}`);
  process.exitCode = 1;
} else {
  console.log(
    `${tier}-cpu: ${d.frames} frames: ${d.differ} of ${d.values} values differ (largest ${d.largest.toExponential(2)} of a peak ${d.peak.toFixed(3)}, relative RMS ${d.relativeRms.toExponential(2)})`,
  );
}
