// The store of experiment 10: definitions that the owner accepted, by name.
//
// An entry is a definition, not a recording: a group of the engine's events (times from the
// sound's own start) or a whole plan. The engine renders it on the CPU tier, and the render is
// kept under `out/store/`, named by a hash of the entry, so a changed entry is rendered again.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, ROOT } from '../../scripts/bundle.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out', 'store');

export interface StoreEntry {
  readonly name: string;
  readonly note: string;
  /** A group of the engine's events, times in seconds from the sound's start. */
  readonly events?: readonly { readonly t: number; readonly [key: string]: unknown }[];
  /** A whole plan of the engine. */
  readonly plan?: { readonly clip: { readonly duration: number } };
}

/** A stereo sound: the left and the right. */
export type Stereo = readonly [Float32Array, Float32Array];

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

let engine: string | undefined;

/**
 * The render of an entry through the engine. A group starts at `lead` seconds and lasts
 * `seconds` in all; a plan lasts its own clip.
 */
export async function renderEntry(name: string, seconds = 3, lead = 0.05): Promise<Stereo> {
  const entry = readEntry(name);
  const plan = entry.plan ?? planOfGroup(entry, seconds, lead);
  const text = JSON.stringify(plan);
  const key = createHash('sha256').update(text).digest('hex').slice(0, 16);
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${name}-${key}.f32`);
  if (!existsSync(file)) {
    engine ??= await bundle({
      entry: 'experiments/10-seven-questions/engine-node.ts',
      outDir: 'experiments/10-seven-questions/out/node',
      target: 'node',
    });
    const planFile = join(OUT, `${name}-${key}.json`);
    writeFileSync(planFile, text);
    execFileSync(process.env['NODE_BINARY'] ?? 'node', [engine, planFile, file], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  }
  const bytes = readFileSync(file);
  const both = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const n = both.length / 2;
  return [both.slice(0, n), both.slice(n)];
}
