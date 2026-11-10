import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import impact from '../fixtures/feedback/impact.json';
import tone from '../fixtures/feedback/tone.json';
import { validateReproduction } from '../src/feedback/index.ts';
import { compileGraph } from '../src/graph/compiler/index.ts';
import { GraphDsp } from '../src/graph/runtime.ts';
import { prepareRoom, prepareRoomSource, roomWalls, RoomMixer } from '../src/spatial/room/index.ts';
import { writeStereoWav } from './audio/writeStereoWav.ts';

function voice(raw: unknown) {
  const { graph } = validateReproduction(raw); const program = compileGraph(graph);
  new Function(program.code)(); return new GraphDsp({ graph, volume: 0.3 });
}
const rate = 48000, frames = 128, total = rate * 10;
const rooms = {
  dry: prepareRoom({ min: { x: -3, y: -1.5, z: -4 }, max: { x: 3, y: 1.5, z: 4 }, earlyGain: 0, lateGain: 0 }),
  'small-room': prepareRoom({ min: { x: -3, y: -1.5, z: -4 }, max: { x: 3, y: 1.5, z: 4 },
    walls: Object.fromEntries(roomWalls.map(wall => [wall, { reflection: 0.65, damping: 0.65 }])), lateGain: 0.3 }),
  hall: prepareRoom({ min: { x: -9, y: -4, z: -12 }, max: { x: 9, y: 4, z: 12 },
    walls: Object.fromEntries(roomWalls.map(wall => [wall, { reflection: 0.9, damping: 0.2 }])), lateGain: 0.35 }),
};
const listener = { position: { x: 0, y: 0, z: 0 } };
const cues = [
  { start: 0, end: 2, label: 'Left impact' }, { start: 2, end: 4, label: 'Right impact' },
  { start: 4, end: 5, label: 'Short centre tone' }, { start: 5, end: 10, label: 'Silence at the source; room decay only' },
];
const results = [];
await mkdir('artifacts/room', { recursive: true });
for (const [name, room] of Object.entries(rooms)) {
  const hit = voice(impact), sustained = voice(tone), mixer = new RoomMixer(room, { capacity: 1 });
  const mono = new Float32Array(frames), left = mono.slice(), right = mono.slice(), inputs = [mono];
  const output = new Float32Array(total * 2), boundaries = [0, rate * 2, rate * 4, rate * 5, total];
  let cue = 0;
  for (let at = 0; at < total;) {
    if (at === boundaries[cue]) {
      if (cue < 2) hit.retrigger();
      if (cue === 2) sustained.retrigger();
      mixer.setSource(0, prepareRoomSource(room, listener, { position: { x: cue === 0 ? -1 : cue === 1 ? 1 : 0, y: 0, z: -1 } }));
      cue++;
    }
    const count = Math.min(frames, boundaries[cue] - at);
    if (at < rate * 4) hit.process(mono, count);
    else if (at < rate * 5) sustained.process(mono, count);
    else mono.fill(0);
    for (let i = 0; i < count; i++) {
      const time = (at + i) / rate;
      if (time < 4) mono[i] *= Math.exp(-(time % 2) * 4);
      else if (time < 5) mono[i] *= Math.min(1, (time - 4) / 0.02, (5 - time) / 0.05);
    }
    mixer.process(inputs, left, right, count);
    for (let i = 0; i < count; i++) { output[(at + i) * 2] = left[i]; output[(at + i) * 2 + 1] = right[i]; }
    at += count;
  }
  if (mixer.invalidSamples || mixer.invalidOutputSamples || mixer.invalidTailSamples || mixer.overloadFrames)
    throw new Error('Invalid or overloaded room demo: ' + name);
  await writeStereoWav('artifacts/room/' + name + '.wav', output, rate);
  results.push({ name, room, peak: mixer.peak, delayBufferBytes: mixer.delayBufferBytes });
}
await writeFile('artifacts/room/listening.json', JSON.stringify({
  date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sampleRate: rate, seconds: total / rate, channels: 2, cues, results,
  levels: 'Identical deterministic GraphDsp sources and direct gain; no per-file normalization or limiting.',
  scope: 'First-order reflections and algorithmic stereo decay. No HRTF or listening approval.',
}, null, 2) + '\n');
console.log('Wrote dry.wav, small-room.wav, hall.wav and listening.json under artifacts/room/.');
