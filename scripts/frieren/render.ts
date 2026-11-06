import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { prepareRoom } from '../../src/spatial/room/index.ts';
import type { RoomDefinition } from '../../src/spatial/room/types.ts';
import type { ListenerPose } from '../../src/spatial/types.ts';
import { renderSource } from './renderSource.ts';
import { renderRoomStem } from './renderRoomStem.ts';
import type { Study } from './types.ts';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const sourceRoot = join(root, 'docs/studies/frieren/sound-design');
const destination = resolve(process.argv[2] ?? 'artifacts/frieren-sound-design');
const only = process.argv[3];
const sessionBytes = await readFile(join(sourceRoot, 'session.json'));
const session = JSON.parse(sessionBytes.toString()) as { sampleRate: number; studies: Study[]; room: RoomDefinition; listener: ListenerPose };
if (session.sampleRate !== 48000) throw new Error('GraphDsp requires 48000 Hz.');
if (only && !session.studies.some(s => s.id === only)) throw new Error('Unknown study: ' + only);
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const compiler = /\/([a-f0-9]{40})\.tar\.gz$/.exec(pkg.devDependencies.typeshade)?.[1];
if (compiler !== '87af4eb0d9d15f02b66b8341b72cab0944290472') throw new Error('Review the private compiler adapter before changing the pin.');
await mkdir(destination); // Refuse to overwrite a prior render.
await mkdir(join(destination, 'graphs'));
await mkdir(join(destination, 'generated'));
await writeFile(join(destination, 'session.json'), sessionBytes);
const room = prepareRoom(session.room, session.sampleRate);
const sourceCache = new Map<string, ReturnType<typeof renderSource>>();
const programHashes: Record<string, string> = {};
const renders = [];
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
for (const study of session.studies.filter(s => !only || s.id === only)) {
  for (const variant of study.variants) {
    const outputDir = join(destination, study.id + '-' + variant.id);
    await mkdir(outputDir);
    const layers = [];
    for (const original of study.layers) {
      const layer = { ...original, ...variant.changes[original.id] };
      const code = await readFile(join(sourceRoot, 'programs', layer.family + '.txt'), 'utf8');
      programHashes[layer.family] = hash(code);
      const cacheKey = JSON.stringify([layer.family, layer.duration, layer.pitch, layer.decay, layer.character, layer.seed]);
      if (!sourceCache.has(cacheKey)) sourceCache.set(cacheKey, renderSource(layer, code));
      const rendered = sourceCache.get(cacheKey)!;
      await writeFile(join(destination, 'graphs', study.id + '-' + variant.id + '-' + layer.id + '.json'), JSON.stringify(rendered.graph, null, 2));
      await writeFile(join(destination, 'generated', layer.family + '.shade.ts'), rendered.source);
      layers.push({ layer, pcm: rendered.pcm });
    }
    const buses = [...new Set(layers.map(s => s.layer.bus))].sort();
    const stems = [];
    for (const bus of buses) {
      const result = renderRoomStem(study, layers.filter(s => s.layer.bus === bus), room, session.listener);
      const bytes = new Uint8Array(result.pcm.buffer);
      await writeFile(join(outputDir, bus + '.f32'), bytes);
      stems.push({ bus, samples: result.pcm.length, sha256: hash(bytes), peak: result.peak, delayBufferBytes: result.delayBufferBytes });
    }
    renders.push({ study: study.id, variant: variant.id, range: study.range, tailSeconds: study.tailSeconds, stems });
    console.log('Rendered', study.id, variant.id, layers.length, 'layers;', stems.length, 'stems.');
  }
}
await writeFile(join(destination, 'render-receipt.json'), JSON.stringify({
  date: new Date().toISOString(), sourceCommit, workingTreeDirty: Boolean(dirty), compiler,
  runtime: { bun: process.versions.bun, platform: process.platform, architecture: process.arch },
  renderer: 'TypeShade compiled CPU GraphDsp sources; TypeAudio RoomMixer; offline host automation',
  sampleRate: session.sampleRate, channels: 2, sessionSha256: hash(sessionBytes), programHashes, room, renders,
  listeningReviewed: false, onlineOffsetVerified: false,
  limits: ['Stereo, no HRTF or perceived height guarantee', 'Authored room proxy, not measured hall geometry',
    'Offline production render, not a real-time benchmark', 'Effects only; no reference audio, dialogue or music'],
}, null, 2) + '\n');
