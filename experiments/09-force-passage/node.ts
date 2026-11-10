// Experiment 9 on the CPU tier, in Node: `run.ts` bundles this file and runs it with Node. It prints
// the result as JSON on stdout, and a line for the render on stderr.

import { renderTier, type Options } from './harness.ts';

const options = JSON.parse(process.argv[2] ?? '{}') as Options;
const result = await renderTier({ ...options, tier: 'cpu' }, (line) => {
  process.stderr.write(`${line}\n`);
});
process.stdout.write(JSON.stringify(result));
