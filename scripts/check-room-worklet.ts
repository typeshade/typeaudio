import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundle } from './bundle.ts';
import { inPage } from './browser.ts';
import { prepareRoom, prepareRoomSource, RoomMixer } from '../src/spatial/room/index.ts';

const rate = 48000, length = 65536, sourceLength = 8192, switchFrames = [4096, 4352];
const room = prepareRoom({ min: { x: -6, y: -3, z: -8 }, max: { x: 6, y: 3, z: 8 }, decaySeconds: 1.6, lateGain: 0.35 }, rate);
const listener = { position: { x: 0, y: 0, z: 0 } };
const targets = [-2, 2, -1].map(x => prepareRoomSource(room, listener, { position: { x, y: 0, z: -1 } }));
const input = Float32Array.from({ length: sourceLength }, (_, i) => 0.4 * Math.sin(i * 0.13) * Math.min(1, i / 128, (sourceLength - i) / 128));
const entry = await bundle({ entry: 'test/room/worklet/processor.ts', outDir: 'out/room-worklet', target: 'worklet' });
const dir = dirname(entry);
await writeFile(join(dir, 'index.html'), '<!doctype html><title>Room worklet check</title>');
const { rendered, browser } = await inPage(dir, async page => ({
  browser: page.context().browser()?.version(),
  rendered: await page.evaluate(async ({ room, targets, input, length, rate, switchFrames }) => {
    const context = new OfflineAudioContext(2, length, rate);
    await context.audioWorklet.addModule('./processor.js');
    const node = new AudioWorkletNode(context, 'typeaudio-room-check', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 1, channelCountMode: 'explicit',
      processorOptions: { room, targets, switchFrames },
    });
    const buffer = context.createBuffer(1, input.length, rate);
    buffer.copyToChannel(Float32Array.from(input), 0);
    const source = context.createBufferSource();
    source.buffer = buffer; source.connect(node); node.connect(context.destination);
    let failed = false; node.onprocessorerror = () => { failed = true; };
    source.start();
    const out = await context.startRendering();
    node.disconnect(); source.disconnect();
    if (failed) throw new Error('Room AudioWorklet processor failed.');
    return [Array.from(out.getChannelData(0)), Array.from(out.getChannelData(1))];
  }, { room, targets, input: Array.from(input), length, rate, switchFrames }),
}));
const mixer = new RoomMixer(room, { capacity: 1 }); mixer.setSource(0, targets[0]);
const mono = new Float32Array(128), left = mono.slice(), right = mono.slice(), inputs = [mono];
let maxError = 0, energy = 0, tailEnergy = 0, event = 0;
for (let at = 0; at < length; at += 128) {
  if (at === switchFrames[event]) mixer.setSource(0, targets[++event]);
  mono.fill(0); if (at < sourceLength) mono.set(input.subarray(at, at + 128));
  mixer.process(inputs, left, right);
  for (let i = 0; i < 128; i++) {
    maxError = Math.max(maxError, Math.abs(left[i] - rendered[0][at + i]), Math.abs(right[i] - rendered[1][at + i]));
    const power = rendered[0][at + i] ** 2 + rendered[1][at + i] ** 2;
    energy += power; if (at > sourceLength + 4096) tailEnergy += power;
  }
}
if (!Number.isFinite(maxError) || maxError > 1e-6 || energy < 0.1 || tailEnergy < 1e-6)
  throw new Error('Room worklet mismatch: error=' + maxError + ', energy=' + energy + ', tail=' + tailEnergy);
const report = {
  date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  check: 'room AudioWorklet', browser, frames: length, sampleRate: rate, maxError, energy, tailEnergy,
  scope: 'OfflineAudioContext, structured control data, moving delays and tail PCM parity; excludes physical device deadlines and listening quality.',
};
await mkdir('artifacts/room', { recursive: true });
await writeFile('artifacts/room/worklet.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
