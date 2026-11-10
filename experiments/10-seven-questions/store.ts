// The store of experiment 10: definitions that the owner accepted, by name.
//
// An entry is a definition, not a recording: a group of the engine's events (times from the
// sound's own start) or a whole plan. The engine renders it on WebGPU, and the render is
// kept under `out/store/`, named by a hash of the entry, so a changed entry is rendered again.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '../../scripts/bundle.ts';
import { inPage } from '../../scripts/browser.ts';
import { fromBase64 } from '../03-fft/signals.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out', 'store');

export interface StoreEntry {
  readonly name: string;
  readonly note: string;
  /** A group of the engine's events, times in seconds from the sound's start. */
  readonly events?: readonly { readonly t: number; readonly [key: string]: unknown }[];
  /** A whole plan of the engine. */
  readonly plan?: { readonly clip: { readonly duration: number } };
  /**
   * A sound made from another entry through effect nodes (`compose.ts`): an accepted sound that is
   * used again by its name. Its `from` and `effects` take the place of a sound's own.
   */
  readonly sound?: { readonly from: unknown; readonly effects: readonly unknown[] };
}

/** A stereo sound: the left and the right. */
export type Stereo = readonly [Float32Array, Float32Array];

/** The render of an entry in its two parts: without the room, and the room. */
export interface Parts {
  readonly dry: Stereo;
  readonly wet: Stereo;
  /**
   * The gain the engine's master gave the render to reach its loudness target, dB. Two renders
   * are in one scale when each is divided by its own gain.
   */
  readonly normalizeDb: number;
}

export const readEntry = (name: string): StoreEntry =>
  JSON.parse(readFileSync(join(HERE, 'store', `${name}.json`), 'utf8')) as StoreEntry;

/** A plan for a group: the room and the master of the passage, the group at `lead` seconds. */
function planOfGroup(entry: StoreEntry, seconds: number, lead: number): unknown {
  const passage = readEntry('passage-without-landings').plan as Record<string, unknown>;
  return {
    ...passage,
    description: `The store entry "${entry.name}" alone.`,
    clip: { duration: seconds, fps: 23.976 },
    // The level of a group is set where it is used. A low target keeps the master's limiter out.
    master: { lufs: -40, truePeak: -1 },
    picture: { cuts: [], motion: [] },
    silences: [],
    events: entry.events!.map((e) => ({ ...e, t: e.t + lead })),
  };
}

let page: string | undefined;

/** The file of an entry's render, and the plan it is rendered from. */
function planned(name: string, seconds: number, lead: number): { file: string; text: string } {
  const entry = readEntry(name);
  const plan = entry.plan ?? planOfGroup(entry, seconds, lead);
  const text = JSON.stringify(plan);
  const key = createHash('sha256').update(text).digest('hex').slice(0, 16);
  return { file: join(OUT, `${name}-${key}`), text };
}

/**
 * Renders the entries that have no render yet, all in one page, through the engine on WebGPU
 * (headless Chromium on SwiftShader, as experiment 9 renders). A group starts at `lead` seconds
 * and lasts `seconds` in all; a plan lasts its own clip.
 */
export async function prepare(names: readonly string[], seconds = 3, lead = 0.05): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const todo = [...new Set(names)]
    .map((name) => ({ name, ...planned(name, seconds, lead) }))
    .filter((t) => !existsSync(`${t.file}.master.json`));
  if (todo.length === 0) return;
  page ??= await bundle({
    entry: 'experiments/10-seven-questions/engine-page.ts',
    outDir: 'experiments/10-seven-questions/out/web',
    target: 'web',
  });
  type Page = {
    renderPlans(
      plans: unknown[],
    ): Promise<{ dry: string; wet: string; ms: number; normalizeDb: number }[]>;
  };
  const plans = todo.map((t) => JSON.parse(t.text) as unknown);
  const done = await inPage(dirname(page), (p) =>
    p.evaluate((all) => (globalThis as unknown as Page).renderPlans(all), plans),
  );
  done.forEach((r, i) => {
    for (const part of ['dry', 'wet'] as const) {
      const bytes = fromBase64(r[part]);
      writeFileSync(
        `${todo[i]!.file}.${part}.f32`,
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      );
    }
    writeFileSync(`${todo[i]!.file}.master.json`, JSON.stringify({ normalizeDb: r.normalizeDb }));
    console.error(`store: ${todo[i]!.name} rendered on WebGPU in ${(r.ms / 1000).toFixed(1)} s`);
  });
}

const read = (file: string): Stereo => {
  const bytes = readFileSync(file);
  const both = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const n = both.length / 2;
  return [both.slice(0, n), both.slice(n)];
};

/** The render of an entry through the engine, in its two parts. `prepare` renders it if needed. */
export async function renderParts(name: string, seconds = 3, lead = 0.05): Promise<Parts> {
  await prepare([name], seconds, lead);
  const file = planned(name, seconds, lead).file;
  const { normalizeDb } = JSON.parse(readFileSync(`${file}.master.json`, 'utf8')) as {
    normalizeDb: number;
  };
  return { dry: read(`${file}.dry.f32`), wet: read(`${file}.wet.f32`), normalizeDb };
}

/** The render of an entry through the engine: the two parts summed, as the engine's mix. */
export async function renderEntry(name: string, seconds = 3, lead = 0.05): Promise<Stereo> {
  const { dry, wet } = await renderParts(name, seconds, lead);
  return [dry[0].map((v, i) => v + wet[0][i]!), dry[1].map((v, i) => v + wet[1][i]!)];
}
