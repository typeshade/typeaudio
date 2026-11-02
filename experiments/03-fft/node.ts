// Experiment 3 on the CPU tier of the host face, in Node: `run.ts` bundles this file and runs it
// with Node. It prints the result as JSON on stdout, and a line for each call on stderr.

import { cpus, platform, release } from 'node:os';
import { runTier, type Options } from './harness.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options;
const result = await runTier({ ...options, tier: 'cpu' }, (line) => {
  process.stderr.write(`${line}\n`);
});
const cpu = cpus();
process.stdout.write(
  JSON.stringify({
    environment: {
      node: process.version,
      cpu: cpu[0]?.model ?? 'unknown',
      cores: cpu.length,
      os: `${platform()} ${release()}`,
    },
    ...result,
  }),
);
