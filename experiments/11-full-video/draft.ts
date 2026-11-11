// The first draft of experiment 11: the cue sheet (`cues.json`) of the whole video, rendered.
//
//   bun experiments/11-full-video/draft.ts [--out dir] [--only seg-03]
//
// The engine renders each segment of the cue sheet as one plan on WebGPU (headless Chromium on
// SwiftShader), in one page, as the store of experiment 10 renders (`../10-seven-questions/
// engine-page.ts`). Each render is kept under `out/segments/`, named by a hash of its plan, so a
// changed segment is rendered again and the others are not. A cue that names a store entry takes
// the accepted sound of experiment 10 through its effect nodes (`compose.ts`). The accepted force
// passage (`module-4.json`, variant `slow-many-ordered`) is composed as experiment 10 composes it
// and laid into its range unchanged. Everything else passes the engine's limiter at -1 dBFS.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { limiterGain } from '../../src/master.ts';
import { validatePlan } from '../../src/plan/index.ts';
import { fromBase64 } from '../03-fft/signals.ts';
import { wavBytes } from '../08-sound-design/wav.ts';
import {
  compose,
  resolved,
  scattered,
  shaped,
  withVariant,
  type Composition,
  type StoredSound,
  type Variant,
} from '../10-seven-questions/compose.ts';
import { SAMPLE_RATE } from '../10-seven-questions/definitions.ts';
import { nodeSource, renderParts, type Stereo } from '../10-seven-questions/store.ts';
import { eventsOf, type Cue, type EngineEvent } from './recipes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The seven answers of a cue, in short. */
export interface Seven {
  readonly who: string;
  readonly what: string;
  readonly how: string;
  readonly howMuch: string;
  readonly when: string;
  readonly where: string;
  readonly why: string;
}

/** A cue of the sheet: a sound event or an ambience bed. */
export interface SheetCue extends Partial<Cue> {
  readonly id: string;
  readonly scene: string;
  readonly t: number;
  readonly what: string;
  readonly seven: Seven;
  /** A bed lasts the scene; a cue is an event. */
  readonly bed?: boolean;
  /** A, B or C: A is heard first, C may go. */
  readonly priority: 'A' | 'B' | 'C';
  /** The level in dB under the sound that leads the moment. */
  readonly level: number;
  /** An accepted sound of experiment 10's store, in place of a recipe. */
  readonly store?: {
    readonly name: string;
    /** A pitch ratio after the stored effects: under 1 is a larger body. */
    readonly pitch?: number;
    readonly scatter?: StoredSound['scatter'];
  };
  /** The force passage's cues: listed for the sheet, made by the accepted module. */
  readonly accepted?: boolean;
}

export interface Scene {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly picture: string;
  readonly space: string;
  readonly dialogue?: string;
  readonly music?: string;
}

export interface Sheet {
  readonly video: { readonly id: string; readonly duration: number; readonly fps: number };
  readonly note: string;
  readonly accepted: {
    readonly from: number;
    readonly to: number;
    readonly module: string;
    readonly variant: string;
  };
  /** Where the engine's audio ends: after it the reference is silent, and so is the draft. */
  readonly end: number;
  readonly room: { readonly size: [number, number, number]; readonly material: string };
  readonly segments: readonly { readonly id: string; readonly from: number; readonly to: number }[];
  readonly scenes: readonly Scene[];
  readonly cues: readonly SheetCue[];
}

/** The seconds a segment's render runs past its end, for the tails and the room. */
export const TAIL = 3;
/** The fade at each edge of the accepted passage, seconds. */
const EDGE = 0.25;

export const readSheet = (): Sheet =>
  JSON.parse(readFileSync(join(HERE, 'cues.json'), 'utf8')) as Sheet;

/** The engine cues of a sheet: the recipe cues, with each bed lasting its scene. */
export function engineCues(sheet: Sheet): Cue[] {
  const scenes = new Map(sheet.scenes.map((s) => [s.id, s]));
  return sheet.cues
    .filter((c) => !c.accepted && !c.store && c.recipe)
    .map((c) => {
      const scene = scenes.get(c.scene);
      if (!scene) throw new Error(`cue "${c.id}": no scene "${c.scene}"`);
      return c.bed ? ({ ...c, duration: c.duration ?? scene.to - c.t } as Cue) : (c as Cue);
    });
}

/** The plan of one segment: its cues' events, times from the segment's start. */
export function segmentPlan(sheet: Sheet, index: number): unknown {
  const seg = sheet.segments[index]!;
  const length = seg.to - seg.from + TAIL;
  const events: EngineEvent[] = engineCues(sheet)
    .filter((c) => c.t >= seg.from && c.t < seg.to)
    .flatMap(eventsOf)
    .map((e) => {
      const t = Math.max(0, e.t - seg.from);
      const room = length - t - 0.01;
      return {
        ...e,
        t,
        ...(e.duration === undefined ? {} : { duration: Math.min(e.duration, room) }),
      };
    });
  return {
    version: 1,
    description: `Experiment 11, the first draft: segment ${seg.id} (${seg.from} to ${seg.to} s of the video).`,
    clip: { duration: length, fps: sheet.video.fps },
    scene: { room: sheet.room, listener: { position: [0, 1.6, 0], yaw: 0 } },
    // A low target keeps the master's limiter out; the draft undoes the master's gain.
    master: { lufs: -40, truePeak: -1 },
    seed: 1100 + index,
    picture: { cuts: [], motion: [] },
    silences: [],
    events,
  };
}

interface Rendered {
  readonly dry: Stereo;
  readonly wet: Stereo;
  readonly normalizeDb: number;
  readonly ms?: number;
}

const OUT = join(HERE, 'out', 'segments');

const fileOf = (id: string, plan: unknown): string =>
  join(OUT, `${id}-${createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0, 16)}`);

const readStereo = (file: string): Stereo => {
  const bytes = readFileSync(file);
  const both = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const n = both.length / 2;
  return [both.slice(0, n), both.slice(n)];
};

/** Renders the segments that have no render yet, in one page; returns the time of each. */
async function renderSegments(sheet: Sheet, only?: string): Promise<Record<string, number>> {
  mkdirSync(OUT, { recursive: true });
  const todo = sheet.segments
    .map((seg, i) => ({ seg, plan: segmentPlan(sheet, i) }))
    .filter((t) => !only || t.seg.id === only)
    .map((t) => ({ ...t, file: fileOf(t.seg.id, t.plan) }))
    .filter((t) => !existsSync(`${t.file}.master.json`));
  for (const t of todo) validatePlan(t.plan);
  const times: Record<string, number> = {};
  if (todo.length === 0) return times;
  const page = await bundle({
    entry: 'experiments/10-seven-questions/engine-page.ts',
    outDir: 'experiments/11-full-video/out/web',
    target: 'web',
  });
  type Page = {
    renderPlans(
      plans: unknown[],
    ): Promise<{ dry: string; wet: string; ms: number; normalizeDb: number }[]>;
  };
  // One page for each segment: a long run in one page holds every render's base64 in memory.
  for (const t of todo) {
    const [r] = await inPage(dirname(page), (p) => {
      p.setDefaultTimeout(0);
      return p.evaluate((all) => (globalThis as unknown as Page).renderPlans(all), [t.plan]);
    });
    for (const part of ['dry', 'wet'] as const) {
      const bytes = fromBase64(r![part]);
      writeFileSync(
        `${t.file}.${part}.f32`,
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      );
    }
    writeFileSync(`${t.file}.master.json`, JSON.stringify({ normalizeDb: r!.normalizeDb, ms: r!.ms }));
    times[t.seg.id] = r!.ms;
    const events = (t.plan as { events: unknown[] }).events.length;
    console.error(
      `draft: ${t.seg.id} (${(t.seg.to - t.seg.from).toFixed(1)} s, ${events} events) rendered on WebGPU in ${(r!.ms / 1000).toFixed(1)} s`,
    );
  }
  return times;
}

function segmentRender(sheet: Sheet, index: number): Rendered {
  const seg = sheet.segments[index]!;
  const file = fileOf(seg.id, segmentPlan(sheet, index));
  const m = JSON.parse(readFileSync(`${file}.master.json`, 'utf8')) as {
    normalizeDb: number;
    ms: number;
  };
  return { dry: readStereo(`${file}.dry.f32`), wet: readStereo(`${file}.wet.f32`), ...m };
}

type File = Composition & { readonly variants: Record<string, Variant> };

const rms = (x: Stereo, a: number, b: number): number => {
  let e = 0;
  let n = 0;
  for (const c of x)
    for (let i = Math.max(0, a); i < Math.min(c.length, b); i++) {
      e += c[i]! * c[i]!;
      n++;
    }
  return Math.sqrt(e / Math.max(1, n));
};

/** The stored sound of a sheet cue, as `compose.ts` takes it. */
function storedOf(c: SheetCue): StoredSound {
  const s = c.store!;
  return {
    id: c.id,
    from: { store: s.name, start: 0, length: 0, fade: 0 },
    effects: s.pitch ? [{ pitch: s.pitch }] : [],
    when: { at: c.t },
    why: { part: c.seven.why, under: -c.level },
    pan: c.pan,
    scatter: s.scatter,
  };
}

export interface Draft {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly report: Record<string, unknown>;
}

/** The whole draft: the segments, the stored cues, the accepted passage, the ceiling. */
export async function renderDraft(sheet: Sheet, only?: string): Promise<Draft> {
  const started = performance.now();
  const times = await renderSegments(sheet, only);
  const engineSeconds = (performance.now() - started) / 1000;
  const n = Math.round(sheet.video.duration * SAMPLE_RATE);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];

  // The scale of the accepted passage: its bed's master gain and its reference, the hit on the wall.
  const moduleFile = join(HERE, sheet.accepted.module);
  const module = JSON.parse(readFileSync(moduleFile, 'utf8')) as File;
  const bed = await renderParts(module.bed.store, 3, 0.05);
  const bedDb = bed.normalizeDb;
  const bedMix: Stereo = [
    bed.dry[0].map((v, i) => v + bed.wet[0][i]!),
    bed.dry[1].map((v, i) => v + bed.wet[1][i]!),
  ];
  const ref = rms(
    bedMix,
    Math.round((module.reference.at - module.bed.from) * SAMPLE_RATE),
    Math.round((module.reference.at + module.reference.length - module.bed.from) * SAMPLE_RATE),
  );

  // The segments, each in the passage's scale: the master's gain undone, the bed's gain applied.
  sheet.segments.forEach((seg, i) => {
    if (only && seg.id !== only) return;
    const r = segmentRender(sheet, i);
    const gain = 10 ** ((bedDb - r.normalizeDb) / 20);
    const at = Math.round(seg.from * SAMPLE_RATE);
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < r.dry[k]!.length && at + j < n; j++)
        out[k]![at + j]! += gain * (r.dry[k]![j]! + r.wet[k]![j]!);
  });

  // The stored cues: accepted sounds, at the level the passage's own stored sounds have.
  const read = nodeSource.read;
  let stored = 0;
  for (const c of sheet.cues.filter((x) => x.store && !x.accepted)) {
    if (only) {
      const seg = sheet.segments.find((s) => s.id === only)!;
      if (c.t < seg.from || c.t >= seg.to) continue;
    }
    for (const sound of scattered(resolved(storedOf(c), read), read)) {
      const parts = await renderParts(sound.from.store, 3, 0.05);
      const input: Stereo = sound.from.part === 'dry' ? parts.dry : [
        parts.dry[0].map((v, i) => v + parts.wet[0][i]!),
        parts.dry[1].map((v, i) => v + parts.wet[1][i]!),
      ];
      const plain = shaped(input, { ...sound, effects: [] }).sound;
      const own = rms(plain, 0, Math.round(module.reference.length * SAMPLE_RATE));
      const { sound: made, front } = shaped(input, sound);
      const gain = (ref / (own || 1)) * 10 ** (-sound.why.under / 20);
      const at = Math.round((sound.when.at - front) * SAMPLE_RATE);
      const pan = sound.pan ?? 0;
      const sides = [Math.min(1, 1 - pan), Math.min(1, 1 + pan)];
      for (let k = 0; k < 2; k++)
        for (let j = 0; j < made[k]!.length && at + j < n; j++)
          if (at + j >= 0) out[k]![at + j]! += gain * sides[k]! * made[k]![j]!;
      stored++;
    }
  }

  // Nothing after the end of the reference's audio.
  const end = Math.round(sheet.end * SAMPLE_RATE);
  const fall = Math.round(0.5 * SAMPLE_RATE);
  for (const x of out)
    for (let j = Math.max(0, end - fall); j < n; j++) x[j]! *= Math.max(0, (end - j) / fall);

  // The accepted passage, faded out of the draft over EDGE on each side.
  const a = Math.round(sheet.accepted.from * SAMPLE_RATE);
  const b = Math.round(sheet.accepted.to * SAMPLE_RATE);
  const e = Math.round(EDGE * SAMPLE_RATE);
  for (const x of out)
    for (let j = a; j < b; j++) {
      const w = Math.min(1, Math.max(0, Math.min(j - a, b - 1 - j) / e));
      x[j]! *= 1 - w;
    }
  const ceiling = limiterGain(out, SAMPLE_RATE, -1);
  for (const x of out) for (let j = 0; j < n; j++) x[j]! *= ceiling[j]!;

  let passageSamples = 0;
  if (!only) {
    const variant = module.variants[sheet.accepted.variant];
    if (!variant) throw new Error(`no variant "${sheet.accepted.variant}"`);
    const passage = await compose(withVariant(module, variant), nodeSource);
    passageSamples = passage[0].length;
    // The passage's samples, at their own gain, inside their range. The draft fades out over EDGE
    // after the range starts and back in over EDGE before it ends.
    for (let k = 0; k < 2; k++)
      for (let j = 0; j < passage[k]!.length && a + j < b; j++) out[k]![a + j]! += passage[k]![j]!;
  }

  let peak = 0;
  for (const x of out) for (const v of x) peak = Math.max(peak, Math.abs(v));
  return {
    left: out[0],
    right: out[1],
    report: {
      seconds: sheet.video.duration,
      segments: sheet.segments.length,
      renderedNow: times,
      engineSeconds,
      totalSeconds: (performance.now() - started) / 1000,
      storedCopies: stored,
      passageSamples,
      peakDb: 20 * Math.log10(peak || 1e-20),
      bedNormalizeDb: bedDb,
    },
  };
}

if (import.meta.main) {
  const arg = (name: string): string | undefined => {
    const at = process.argv.indexOf(`--${name}`);
    return at < 0 ? undefined : process.argv[at + 1];
  };
  const sheet = readSheet();
  const outDir = arg('out') ?? join(HERE, 'out');
  const only = arg('only');
  mkdirSync(outDir, { recursive: true });
  const draft = await renderDraft(sheet, only);
  const name = only ? `draft-${only}` : 'draft';
  writeFileSync(join(outDir, `${name}.wav`), wavBytes([draft.left, draft.right], SAMPLE_RATE));
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(draft.report, null, 2));
  console.log(JSON.stringify(draft.report, null, 2));
}
