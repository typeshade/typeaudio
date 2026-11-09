// The Node entry of `run-overhead.ts`: the three forms on the CPU tier. Prints the rows as JSON.

import { runOverhead } from './overhead.ts';

const blocks = Number(process.argv[2] ?? 40);
process.stdout.write(JSON.stringify(await runOverhead('cpu', blocks)));
