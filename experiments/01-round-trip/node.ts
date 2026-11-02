// Experiment 1 on the CPU tier, in Node: `run.ts` bundles this file and runs it with Node. It
// prints the result as JSON on stdout, and a line for each row on stderr.

import { cpus, platform, release } from 'node:os';
import { clockStep } from './clock.ts';
import { measure, type Options } from './harness.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options;
const result = await measure({ ...options, tier: 'cpu' }, (row) => {
  process.stderr.write(`cpu ${row.variant} ${row.frames}: median ${row.medianMs.toFixed(3)} ms\n`);
});
const cpu = cpus();
process.stdout.write(
  JSON.stringify({
    environment: {
      node: process.version,
      cpu: cpu[0]?.model ?? 'unknown',
      cores: cpu.length,
      os: `${platform()} ${release()}`,
      clockStepMs: clockStep(),
    },
    ...result,
  }),
);
