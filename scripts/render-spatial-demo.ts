import { mkdir, writeFile } from 'node:fs/promises';
import impact from '../fixtures/feedback/impact.json';
import tone from '../fixtures/feedback/tone.json';
import { validateReproduction } from '../src/feedback/index.ts';
import { compileGraph } from '../src/graph/compiler/index.ts';
import { GraphDsp } from '../src/graph/runtime.ts';
import { prepareSpatialSource, SpatialMixer } from '../src/spatial/index.ts';

function voice(raw: unknown) {
  const { graph } = validateReproduction(raw);
  const program = compileGraph(graph);
  new Function(program.code)();
  return new GraphDsp({ graph, volume: 0.3 });
}
const hit = voice(impact), sustained = voice(tone);
const rate = 48000, frames = 128, total = rate * 6;
const mixer = new SpatialMixer({ capacity: 1 });
const mono = new Float32Array(frames), left = mono.slice(), right = mono.slice(), inputs = [mono];
const output = Buffer.alloc(44 + total * 4);
output.write('RIFF', 0); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(2, 22);
output.writeUInt32LE(rate, 24); output.writeUInt32LE(rate * 4, 28); output.writeUInt16LE(4, 32);
output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(total * 4, 40);
const listener = { position: { x: 0, y: 0, z: 0 } };
for (let at = 0; at < total; at += frames) {
  const count = Math.min(frames, total - at), time = at / rate;
  const phase = Math.floor(time);
  if (at === 0 || at === rate || at === rate * 2) hit.retrigger();
  if (time < 3) hit.process(mono, count); else sustained.process(mono, count);
  for (let i = 0; i < count; i++) {
    const t = (at + i) / rate;
    mono[i] *= time < 3 ? Math.exp(-(t - phase) * 8) : Math.min(1, (t - 3) / 0.1, (6 - t) / 0.15);
  }
  const position = time < 3
    ? { x: phase === 0 ? -1 : phase === 2 ? 1 : 0, y: 0, z: phase === 1 ? -1 : 0 }
    : { x: -6 + (time - 3) * 4, y: 0, z: -1 };
  // Offline control preparation; real-time callers prepare targets outside the callback.
  mixer.setSource(0, prepareSpatialSource(listener, { position }));
  mixer.process(inputs, left, right, count);
  for (let i = 0; i < count; i++) {
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + (at + i) * 4);
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + (at + i) * 4);
  }
}
if (mixer.invalidSamples || mixer.invalidOutputSamples || mixer.overloadFrames) throw new Error('Invalid or overloaded spatial demo.');
await mkdir('artifacts/spatial', { recursive: true });
await writeFile('artifacts/spatial/listener-stereo.wav', output);
await writeFile('artifacts/spatial/listener-stereo.json', JSON.stringify({
  sampleRate: rate, seconds: 6, channels: 2, peak: mixer.peak,
  cues: [
    { start: 0, end: 1, label: 'Left impact' },
    { start: 1, end: 2, label: 'Centre impact' },
    { start: 2, end: 3, label: 'Right impact' },
    { start: 3, end: 6, label: 'Left-to-right pass, nearer at the centre' },
  ],
  scope: 'Procedural GraphDsp sources through stereo spatial DSP; not binaural, room acoustics or a listening-approved design.',
}, null, 2));
console.log('Wrote artifacts/spatial/listener-stereo.wav and its cue description.');
