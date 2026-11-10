import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepareRoom, prepareRoomSource, RoomMixer } from '../src/spatial/room/index.ts';

const rate = 48000, frames = 128, blocks = 2000;
const room = prepareRoom({ min: { x: -6, y: -3, z: -8 }, max: { x: 6, y: 3, z: 8 }, decaySeconds: 1.6 }, rate);
const listener = { position: { x: 0, y: 0, z: 0 } }, rows = [];
for (const capacity of [1, 8, 32]) for (const moving of [false, true]) {
  const mixer = new RoomMixer(room, { capacity });
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const inputs = Array.from({ length: capacity }, (_, slot) =>
    Float32Array.from({ length: frames }, (_, i) => Math.sin((i + slot * 17) * 0.13) * 0.25));
  const targets = [0, 1].map(side => Array.from({ length: capacity }, (_, slot) =>
    prepareRoomSource(room, listener, { position: { x: (side ? -1 : 1) * (1 + Math.sin(slot) * 3), y: 0, z: -2 }, gain: 1 / capacity })));
  for (let slot = 0; slot < capacity; slot++) mixer.setSource(slot, targets[0][slot]);
  for (let block = 0; block < 1000; block++) {
    if (moving && block % 8 === 0) for (let slot = 0; slot < capacity; slot++) mixer.setSource(slot, targets[(block >> 3) % 2][slot]);
    mixer.process(inputs, left, right);
  }
  const times = new Float64Array(blocks);
  for (let block = 0; block < blocks; block++) {
    const start = performance.now();
    if (moving && block % 8 === 0) for (let slot = 0; slot < capacity; slot++) mixer.setSource(slot, targets[(block >> 3) % 2][slot]);
    mixer.process(inputs, left, right);
    times[block] = performance.now() - start;
  }
  if (mixer.invalidSamples || mixer.invalidOutputSamples || mixer.invalidTailSamples) throw new Error('Invalid room benchmark output.');
  const sorted = Array.from(times).sort((a, b) => a - b), budgetMs = frames / rate * 1000;
  rows.push({ capacity, moving, blocks, budgetMs, delayBufferBytes: mixer.delayBufferBytes,
    p50Ms: sorted[Math.floor(blocks * 0.5)], p95Ms: sorted[Math.floor(blocks * 0.95)], p99Ms: sorted[Math.floor(blocks * 0.99)],
    maxMs: sorted[blocks - 1], overBudgetBlocks: sorted.filter(ms => ms > budgetMs).length });
}
const outIndex = process.argv.indexOf('--out'), out = outIndex >= 0 ? process.argv[outIndex + 1] : 'artifacts/room/benchmark.json';
if (!out) throw new Error('--out needs a path.');
const report = {
  date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: process.versions, device: { cpu: cpus()[0]?.model, platform: platform(), arch: arch() }, frames, sampleRate: rate,
  scope: 'CPU direct bus, six reflections per source, one shared tail, and prepared-target updates every eight moving blocks; excludes synthesis, geometry preparation, device scheduling, GC guarantees and output underruns.',
  rows,
};
await mkdir(dirname(out), { recursive: true }); await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
