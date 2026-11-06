import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bundle } from './bundle.ts';
import { inPage } from './browser.ts';
import { prepareSpatialSource, SpatialMixer } from '../src/spatial/index.ts';

const rate = 48000, length = 4096, switchFrame = 2048;
const listener = { position: { x: 0, y: 0, z: 0 } };
const first = prepareSpatialSource(listener, { position: { x: -2, y: 0, z: -1 } }, rate);
const second = prepareSpatialSource(listener, { position: { x: 2, y: 0, z: -1 }, occlusion: 0.3 }, rate);
const input = Float32Array.from({ length }, (_, i) => 0.4 * Math.sin(i * 0.13));
const entry = await bundle({ entry: 'test/spatial/worklet/processor.ts', outDir: 'out/spatial-worklet', target: 'worklet' });
const dir = dirname(entry);
await writeFile(join(dir, 'index.html'), '<!doctype html><title>Spatial worklet check</title>');
const rendered = await inPage(dir, page => page.evaluate(async ({ first, second, input, length, rate, switchFrame }) => {
  const context = new OfflineAudioContext(2, length, rate);
  await context.audioWorklet.addModule('./processor.js');
  const node = new AudioWorkletNode(context, 'typeaudio-spatial-check', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    channelCount: 1, channelCountMode: 'explicit',
    processorOptions: { first, second, switchFrame },
  });
  const buffer = context.createBuffer(1, length, rate);
  buffer.copyToChannel(Float32Array.from(input), 0);
  const source = context.createBufferSource();
  source.buffer = buffer; source.connect(node); node.connect(context.destination);
  let failed = false; node.onprocessorerror = () => { failed = true; };
  source.start();
  const out = await context.startRendering();
  node.disconnect(); source.disconnect();
  if (failed) throw new Error('Spatial AudioWorklet processor failed.');
  return [Array.from(out.getChannelData(0)), Array.from(out.getChannelData(1))];
}, { first, second, input: Array.from(input), length, rate, switchFrame }));
const mixer = new SpatialMixer({ capacity: 1, sampleRate: rate });
mixer.setSource(0, first);
const mono = new Float32Array(128), left = mono.slice(), right = mono.slice(), inputs = [mono];
let maxError = 0, energy = 0;
for (let at = 0; at < length; at += 128) {
  if (at === switchFrame) mixer.setSource(0, second);
  mono.set(input.subarray(at, at + 128));
  mixer.process(inputs, left, right);
  for (let i = 0; i < 128; i++) {
    maxError = Math.max(maxError, Math.abs(left[i] - rendered[0][at + i]), Math.abs(right[i] - rendered[1][at + i]));
    energy += rendered[0][at + i] ** 2 + rendered[1][at + i] ** 2;
  }
}
if (!Number.isFinite(maxError) || maxError > 1e-6 || energy < 0.1)
  throw new Error('Spatial worklet mismatch: error=' + maxError + ', energy=' + energy);
console.log(JSON.stringify({
  check: 'spatial AudioWorklet', frames: length, sampleRate: rate, maxError, energy,
  scope: 'OfflineAudioContext loading and PCM parity; excludes physical device deadlines and listening quality.',
}));
