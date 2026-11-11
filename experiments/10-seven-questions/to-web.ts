// The force passage of experiment 10 as a project of the site's editor (audio.typeshade.dev): the
// sounds of the passage that are typed functions today, each event a cue whose patch is the
// event's function nodes (`src/kinds/functions/`). Today that is the accepted `wall-hit` (twelve
// events, store/wall-hit.json). The other sounds of the passage join as they become functions.
//
// The project holds no audio. The picture is a YouTube reference by its id only, as the site's
// earlier examples held it.
//
// How the engine's render maps onto the editor's scene (the editor's `scene/renderSpatialScene.ts`
// and `functions/FunctionPatchDsp.ts`, in `typeshade/web`):
//
// - Time. The bed of the heard passage (module-4.json, `passage-without-break`) starts at picture
//   second 136.5. An event sounds where the render places it: its onset snapped to the picture
//   (`snapped` in src/render-plan.ts), rounded to the frame. A cue's time is that, in picture seconds.
// - The sound. A cue's patch is the event's nodes (`kindNodes`), which sound as the engine's lane
//   does: the event's intensity and the kind's calibration (`KIND_GAIN`, `KIND_PEAK`) are inside
//   the nodes' amplitude inputs. Its duration is the lane's length.
// - Distance and pan. The engine gives a source at `d` metres the gain `min(1, 2 / d)` and pans it
//   by its screen x, equal power. The editor attenuates by `prepareSpatialSource` with a reference
//   distance of 1.5 m and a rolloff of 0.5, and pans by the source's direction. The cue's point
//   puts the source at `d` metres with the screen x as its pan, and the cue's gain is the engine's
//   gain over the editor's, so the direct sound has the engine's level and pan.
// - Master. The engine scales the whole passage to its loudness target: the bed's render was
//   raised by `PASSAGE_NORMALIZE_DB`. The scene's master trim carries that gain and the inverse of
//   the patch volume (the editor caps a patch's volume at 0.7), less what keeps the direct sum
//   under the peak the engine's limiter would allow (`PEAK_CEILING_DB`).
//
// What is not the engine's: the room (the editor's image-source room and diffuse tail stand in for
// the engine's early reflections and convolution), the layer strip (the `effects` shelf of +1.5 dB
// above 6 kHz) and the air lowpass are left out, the engine's limiter is a static trim, and the
// editor fades each source in over 5 ms. The test (`test/to-web.test.ts`) holds each cue's nodes to
// the event's lane and its direct gain and pan to the engine's.

import { kindNodes } from '../../src/kinds/functions/fromEvent.ts';
import { eventKey, makeLane, type Made } from '../../src/kinds/make.ts';
import type {
  FunctionGraphDocument,
  FunctionInstance,
  FunctionParameter,
} from '../../src/function-graph/types.ts';
import { validatePlan, type PlanEvent, type SoundPlan } from '../../src/plan/index.ts';
import { snapped } from '../../src/render-plan.ts';
import { prepareSpatialSource } from '../../src/spatial/prepareSpatialSource.ts';
import { MATERIALS } from '../../src/spatial/room.ts';
import bed from './store/passage-without-break.json';
import wallHit from './store/wall-hit.json';
import moduleFour from './module-4.json';

/** The sample rate of the engine's render and of the editor. */
export const SAMPLE_RATE = 48000;

/**
 * The gain, dB, that the engine's master gave the render of `passage-without-break` (the bed of
 * module-4, `slow-many-ordered`, which the owner heard): `normalizeDb` of its store render on
 * WebGPU (headless Chromium, SwiftShader), key `667abcef5a937d54`, 2026-11-11.
 */
export const PASSAGE_NORMALIZE_DB = 9.263282737362804;

/** The peak the direct sum of the cues may reach: the engine's limiter ceiling, -1 dBFS. */
export const PEAK_CEILING_DB = -1;

/** The editor's distance model (`scene/renderSpatialScene.ts` in `typeshade/web`). */
export const EDITOR_DISTANCE = { referenceDistance: 1.5, rolloff: 0.5, airAbsorption: 0.04 };

/** The highest volume the editor takes for a patch (`sound/limits.ts` in `typeshade/web`). */
export const PATCH_VOLUME = 0.7;

/** The YouTube reference of the passage, by its id only. */
export const MEDIA = {
  kind: 'youtube',
  name: 'Frieren sound-design reference',
  id: 'YHCqcyX9N3s',
} as const;

/** The names a person reads in the editor, by event id. */
const NAMES: Record<string, string> = {
  'wall-hit': 'Body hits the wall (impact)',
  'wall-stone': 'Stone face cracks (crack)',
  'wall-mid': 'Middle of the wall cracks (crack)',
  'wall-edge': 'Edge of the wall cracks (crack)',
  'wall-body': 'Body of the wall (boom)',
  'wall-punch': 'Punch of the hit (boom)',
  'wall-thump': 'Thump of the hit (boom)',
  'wall-chips': 'Chips fly (rubble)',
  'wall-burst': 'Wall bursts (roar)',
  'dust-burst': 'Dust bursts (roar)',
  'hall-answer': 'The hall answers (boom)',
  'hit-rumble': 'Rumble of the hit (boom)',
};

/** The patch fields of the editor's default patch (`sound/defaultPatch.ts` in `typeshade/web`). */
const PATCH_FIELDS = {
  graph: null,
  baseMuted: false,
  fmRatio: 2,
  fmIndex: 0,
  seed: 1,
  wave: Array.from({ length: 64 }, (_, i) => Math.sin((i * Math.PI * 2) / 64)),
  curves: { pitch: [], cutoff: [], gain: [] },
  layers: [],
  lfoRate: 1,
  lfoDepth: 0,
  lfoTarget: 0,
  lfoShape: 0,
  lfoSync: false,
  tempo: 120,
  shapeA: 1,
  shapeB: 0,
  blend: 0.35,
  frequency: 220,
  transpose: 0,
  detune: 7,
  voices: 2,
  spread: 9,
  cutoff: 2200,
  resonance: 0.8,
  filter: true,
  attack: 0.02,
  decay: 0.25,
  sustain: 0.55,
  release: 0.35,
  drive: 1.4,
  distortion: true,
  delay: false,
  delayTime: 0.25,
  feedback: 0.35,
  delayMix: 0.3,
  reverb: false,
  room: 0.6,
  reverbMix: 0.25,
};

/** One event of the passage as the exporter reads it. */
export interface PassageEvent {
  readonly event: PlanEvent;
  /** The event's key in the bed's plan. */
  readonly key: number;
  /** The frame of the bed's clip where the render places its onset. */
  readonly startFrame: number;
  /** The picture second of its onset. */
  readonly time: number;
}

/** The bed of the heard passage, validated, and the picture second where its clip starts. */
export function passage(): { plan: SoundPlan; from: number } {
  if (moduleFour.bed.store !== bed.name)
    throw new Error(`to-web: module-4's bed is "${moduleFour.bed.store}", not "${bed.name}".`);
  return { plan: validatePlan(bed.plan), from: moduleFour.bed.from };
}

/** The events of `wall-hit` in the bed, where the render places them. */
export function wallHitEvents(): PassageEvent[] {
  const { plan, from } = passage();
  const ids = new Set(wallHit.events.map((e) => e.id));
  const events = plan.events.filter((e) => ids.has(e.id));
  if (events.length !== ids.size)
    throw new Error('to-web: the bed does not hold every event of wall-hit.');
  return events.map((event) => {
    const startFrame = Math.round(snapped(plan, event.t) * SAMPLE_RATE);
    return {
      event,
      key: eventKey(plan.seed, event.id),
      startFrame,
      time: from + startFrame / SAMPLE_RATE,
    };
  });
}

/** The lane of an event, as the engine makes it. */
export const laneOf = (e: PassageEvent): Made =>
  makeLane(e.event, { sr: SAMPLE_RATE, key: e.key });

/** The engine's direct gain and pan of an event (src/spatial/room.ts, `spatialOf`). */
export function engineDirect(e: PlanEvent): { gain: number; left: number; right: number } {
  const gain = Math.min(1, 2 / Math.max(e.position.distance, 0.1));
  const angle = ((e.position.x + 1) * Math.PI) / 4;
  return { gain, left: gain * Math.cos(angle), right: gain * Math.sin(angle) };
}

/**
 * The editor's point of an event, the listener at the origin facing -z: `distance` metres away,
 * its pan the screen x, and raised by half the screen y (the screen's half height as 30 degrees).
 */
export function pointOf(e: PlanEvent): { x: number; y: number; z: number } {
  const d = e.position.distance;
  const x = d * e.position.x;
  const y = 0.5 * d * e.position.y;
  return { x, y, z: -Math.sqrt(Math.max(0, d * d - x * x - y * y)) };
}

/** The editor's direct gains of a source at `point`. */
export function editorDirect(point: { x: number; y: number; z: number }): {
  left: number;
  right: number;
} {
  const s = prepareSpatialSource(
    { position: { x: 0, y: 0, z: 0 } },
    { position: point, ...EDITOR_DISTANCE },
    SAMPLE_RATE,
  );
  return { left: s.left, right: s.right };
}

/** The named controls of an event's nodes: its levels (or brightness), bound in place of constants. */
function namedControls(nodes: FunctionInstance[]): FunctionParameter[] {
  const controls: { input: string; definition: string; id: string; name: string }[] = [
    { definition: 'impact', input: 'aSub', id: 'bodyLevel', name: 'Body level' },
    { definition: 'impact', input: 'aNoise', id: 'noiseLevel', name: 'Noise level' },
    { definition: 'impact', input: 'aClick', id: 'clickLevel', name: 'Click level' },
    { definition: 'boom', input: 'aNoise', id: 'noiseLevel', name: 'Noise level' },
    { definition: 'boom', input: 'aTone', id: 'toneLevel', name: 'Tone level' },
    { definition: 'roarMix', input: 'gain', id: 'level', name: 'Level' },
    { definition: 'stoneBand', input: 'bright', id: 'brightness', name: 'Brightness' },
  ];
  const parameters = new Map<string, FunctionParameter>();
  for (const node of nodes)
    for (const c of controls) {
      const binding = node.inputs[c.input];
      if (node.definition !== c.definition || binding?.kind !== 'constant') continue;
      const value = Number(binding.value);
      if (!parameters.has(c.id))
        parameters.set(c.id, {
          id: c.id,
          name: c.name,
          type: 'f32',
          unit: 'linear-gain',
          value,
          min: 0,
          max: Math.max(1, 2 * value),
        });
      node.inputs[c.input] = { kind: 'parameter', parameter: c.id };
    }
  return [...parameters.values()];
}

/** Columns for the editor's canvas: sources on the left, the node that sounds on the right. */
function layoutOf(nodes: FunctionInstance[], output: string): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const feeds = (id: string): string[] =>
    Object.values(nodes.find((n) => n.id === id)!.inputs).flatMap((b) =>
      b.kind === 'connection' ? [b.node] : [],
    );
  const walk = (id: string, d: number): void => {
    depth.set(id, Math.max(depth.get(id) ?? 0, d));
    for (const f of feeds(id)) walk(f, d + 1);
  };
  walk(output, 0);
  const most = Math.max(...depth.values());
  const rows = new Map<number, number>();
  return Object.fromEntries(
    nodes.map((n) => {
      const column = most - (depth.get(n.id) ?? 0);
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return [n.id, { x: 40 + column * 360, y: 40 + row * 220 }];
    }),
  );
}

/** A cue of the editor's scene. */
export interface WebCue {
  id: string;
  name: string;
  time: number;
  gain: number;
  muted: boolean;
  patch: Record<string, unknown> & {
    functions: FunctionGraphDocument;
    duration: number;
    volume: number;
  };
  space: { points: { time: number; x: number; y: number; z: number }[]; spread: number; send: number };
}

/** The cue of one event. */
export function cueOf(e: PassageEvent): WebCue {
  const made = laneOf(e);
  const id = e.event.id;
  const nodes = kindNodes(made, id);
  const graphNodes = nodes.nodes.map((n) => ({ ...n, inputs: { ...n.inputs } }));
  const parameters = namedControls(graphNodes);
  const point = pointOf(e.event);
  const engine = engineDirect(e.event);
  const editor = editorDirect(point);
  const gain = engine.gain / Math.hypot(editor.left, editor.right);
  if (!(gain > 0 && gain <= 1))
    throw new Error(`to-web: the cue gain of "${id}" is ${gain}, outside (0, 1].`);
  return {
    id,
    name: NAMES[id] ?? id,
    time: e.time,
    gain,
    muted: false,
    patch: {
      ...PATCH_FIELDS,
      functions: {
        schema: 'typeaudio.function-graph',
        version: 1,
        modules: nodes.modules,
        definitions: nodes.definitions,
        nodes: graphNodes,
        parameters,
        output: nodes.output,
      },
      functionLayout: layoutOf(graphNodes, nodes.output.node),
      duration: Math.min(30, Math.max(0.02, made.length / SAMPLE_RATE)),
      volume: PATCH_VOLUME,
    },
    space: {
      points: [{ time: 0, ...point }],
      spread: 0,
      // The engine's send of a stone room (`MATERIALS.stone.send * 0.5`); the editor's room is not
      // the engine's, so this is a starting value.
      send: MATERIALS.stone.send * 0.5,
    },
  };
}

/** The direct sum of the cues, before the master trim: left and right, from the bed's clip start. */
export function directSum(events: readonly PassageEvent[], cues: readonly WebCue[]): [Float32Array, Float32Array] {
  const { plan } = passage();
  const frames = Math.ceil(plan.clip.duration * SAMPLE_RATE);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  events.forEach((e, i) => {
    const cue = cues[i]!;
    const made = laneOf(e);
    const unit = Object.values(made.lane).find(
      (v) => typeof v === 'object' && v !== null && typeof (v as { tick?: unknown }).tick === 'function',
    ) as { tick(): number };
    const d = editorDirect(cue.space.points[0]!);
    const g = cue.gain * cue.patch.volume;
    for (let t = 0; t < made.length && e.startFrame + t < frames; t++) {
      const v = unit.tick() * g;
      left[e.startFrame + t]! += v * d.left;
      right[e.startFrame + t]! += v * d.right;
    }
  });
  return [left, right];
}

/** The site's project of the force passage. `revision` is the typeaudio commit it is made at. */
export function forcePassageProject(revision: string): {
  project: Record<string, unknown>;
  report: { gainDb: number; engineDb: number; directPeakDb: number };
} {
  const { plan, from } = passage();
  const events = wallHitEvents();
  const cues = events.map(cueOf);
  const [l, r] = directSum(events, cues);
  let peak = 0;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]!), Math.abs(r[i]!));
  const engineDb = PASSAGE_NORMALIZE_DB + 20 * Math.log10(1 / PATCH_VOLUME);
  const directPeakDb = 20 * Math.log10(peak);
  const gainDb = Math.min(engineDb, PEAK_CEILING_DB - directPeakDb);
  const rounded = Math.round(gainDb * 100) / 100;
  const scene = {
    version: 1,
    name: 'Unseen force: wall hit (work in progress)',
    media: MEDIA,
    start: from,
    end: from + plan.clip.duration,
    loop: false,
    original: 0.5,
    effects: 1,
    cues,
    space: {
      room: {
        // The engine's room (18 x 24 x 14 m, stone), the listener 1.6 m above the floor.
        min: { x: -plan.scene.room.size[0] / 2, y: -1.6, z: -plan.scene.room.size[1] / 2 },
        max: {
          x: plan.scene.room.size[0] / 2,
          y: plan.scene.room.size[2] - 1.6,
          z: plan.scene.room.size[1] / 2,
        },
        walls: Object.fromEntries(
          ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'].map((w) => [
            w,
            { reflection: MATERIALS.stone.reflect, damping: 0.4 },
          ]),
        ),
        earlyGain: 0.65,
        lateGain: 0.28,
        decaySeconds: MATERIALS.stone.seconds,
      },
      listener: { position: { x: 0, y: 0, z: 0 } },
      gainDb: rounded,
      highpassHz: 0,
    },
    origin: {
      id: 'unseen-force-wall-hit',
      revision,
      author: 'TypeAudio engine (experiment 10)',
      notes:
        'The accepted wall hit of the force passage, twelve engine events as typed function nodes. Other sounds of the passage are added as they become functions. Levels and pan follow the engine; the room is the editor\'s. YouTube alignment is approximate.',
    },
  };
  const first = cues[0]!;
  return {
    project: {
      schema: 'typeaudio.project',
      version: 3,
      scene,
      editor: {
        source: { name: first.name, patch: first.patch },
        drafts: {},
        selected: first.id,
        selection: [],
      },
    },
    report: { gainDb: rounded, engineDb, directPeakDb },
  };
}
