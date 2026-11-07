import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepareSpatialSource, SpatialMixer } from '../src/spatial/index.ts';

const rate = 48000, frames = 128, blocks = 2000;
const rows = [];
for (const capacity of [1, 8, 32, 64]) {
  const mixer = new SpatialMixer({ capacity, sampleRate: rate });
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const inputs = Array.from({ length: capacity }, (_, slot) =>
    Float32Array.from({ length: frames }, (_, i) => Math.sin((i + slot * 17) * 0.13) * 0.25));
  const listener = { position: { x: 0, y: 0, z: 0 } };
  const targets = Array.from({ length: capacity }, (_, slot) =>
    prepareSpatialSource(listener, {
      position: { x: Math.sin(slot) * 3, y: 0, z: -2 },
      gain: 1 / capacity, occlusion: (slot % 3) * 0.2,
    }, rate));
  for (let slot = 0; slot < capacity; slot++) mixer.setSource(slot, targets[slot]);
  for (let block = 0; block < 1000; block++) mixer.process(inputs, left, right);
  const times = new Float64Array(blocks);
  for (let block = 0; block < blocks; block++) {
    const start = performance.now();
    if (block % 16 === 0)
      for (let slot = 0; slot < capacity; slot++) mixer.setSource(slot, targets[(slot + (block >> 4)) % capacity]);
    mixer.process(inputs, left, right);
    times[block] = performance.now() - start;
  }
  if (mixer.invalidSamples || mixer.invalidOutputSamples) throw new Error('Invalid spatial benchmark output.');
  const sorted = Array.from(times).sort((a, b) => a - b);
  const budgetMs = frames / rate * 1000;
  rows.push({
    capacity, blocks, budgetMs, p50Ms: sorted[Math.floor(blocks * 0.5)],
    p95Ms: sorted[Math.floor(blocks * 0.95)], p99Ms: sorted[Math.floor(blocks * 0.99)],
    maxMs: sorted[blocks - 1], overBudgetBlocks: sorted.filter(ms => ms > budgetMs).length,
  });
}
const outIndex = process.argv.indexOf('--out');
const out = outIndex >= 0 ? process.argv[outIndex + 1] : 'artifacts/spatial/benchmark.json';
if (!out) throw new Error('--out needs a path.');
const report = {
  date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: process.versions, device: { cpu: cpus()[0]?.model, platform: platform(), arch: arch() },
  frames, sampleRate: rate,
  scope: 'CPU bus processing and prepared-target updates; excludes source synthesis, geometry preparation, device scheduling, GC guarantees and measured output underruns.',
  rows,
};
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
