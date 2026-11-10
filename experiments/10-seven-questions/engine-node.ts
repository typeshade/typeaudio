// Renders one plan of the engine on the CPU tier, in Node: `store.ts` bundles this file and runs it.
//
//   node engine-node.js <plan.json> <out.f32>
//
// It writes the mix as 32-bit floats, the left channel then the right.

import { readFileSync, writeFileSync } from 'node:fs';
import { createDevice } from 'typeshade/runtime';
import { renderPlan } from '../../src/render-plan.ts';

const [planPath, outPath] = process.argv.slice(2);
if (!planPath || !outPath) throw new Error('engine-node: give the plan and the output file.');
const plan: unknown = JSON.parse(readFileSync(planPath, 'utf8'));
const dev = await createDevice({ prefer: ['cpu'] });
try {
  const r = await renderPlan(dev, plan);
  const n = r.mix[0]!.length;
  const both = new Float32Array(2 * n);
  both.set(r.mix[0]!, 0);
  both.set(r.mix[1]!, n);
  writeFileSync(outPath, new Uint8Array(both.buffer));
  process.stderr.write(
    `engine-node: ${r.tier}, ${n} frames, master ${r.master.lufsBefore.toFixed(1)} LUFS before\n`,
  );
} finally {
  await dev.dispose();
}
