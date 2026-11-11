// A mix built from its parts (`Mix.part`): each part is loaded from a cache on disk when its key is
// there, and made on worker threads when it is not. The layers and their order are those the plain
// code gives, whatever the number of workers and whatever is in the cache.
//
// 1. The scene runs once with a builder that collects its parts and runs no part.
// 2. Each part gets a key: the hash of its code and of what it reaches (`part-keys.ts`), of the
//    study's models (every file of `src/study/`), of the runtime, of the mix's settings and of
//    the layer steps (`Mix.eachLayer`).
// 3. A part whose key is in the cache is read from it. The others are made on the workers, the
//    longest first, each by the same code on its own; the layer steps are applied to its layers.
// 4. The layers are put in the order the scene adds them, and the `finish` steps run in order.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Stereo } from './dsp.ts';
import { setBuilder, type Builder, type Layer, type LayerStep, type Meter, type Mix } from './mix.ts';
import { sceneKeys } from './part-keys.ts';

/**
 * Raise this when the cache's files, what goes into a key, or the way a part is made and its layer
 * steps applied (`Collector.run`) change: the builder's own files are not in the keys.
 */
const FORMAT = 2;

export interface BuildOptions {
  /** The function of the entry module that makes the mix; 'scene' by default. */
  readonly exportName?: string;
  /** Worker threads for the parts that are not in the cache; the cores by default; 0 makes them here. */
  readonly workers?: number;
  /** The cache's directory, or null for no cache. */
  readonly cacheDir?: string | null;
  readonly log?: (line: string) => void;
}

export interface BuildReport {
  readonly parts: number;
  readonly loaded: number;
  readonly made: number;
  readonly workers: number;
  readonly seconds: { collect: number; keys: number; parts: number; finish: number };
  /** The seconds each part that was made took, by name. */
  readonly partSeconds: Record<string, number>;
  readonly cacheBytes: number;
}

/** The layers of one part, in the order it adds them. */
export type PartLayers = [string, Layer][];

interface Part {
  readonly name: string;
  readonly make: () => void;
}

type Entry = { readonly part: Part } | { readonly loose: readonly string[] };

/** A builder that collects the parts and steps of a scene, then runs parts on demand. */
export class Collector implements Builder {
  readonly entries: Entry[] = [];
  readonly parts = new Map<string, Part>();
  readonly finishes: ((m: Mix) => void)[] = [];
  readonly steps: [string, LayerStep][] = [];
  private seen = 0;
  private running: string | null = null;

  private flush(m: Mix): void {
    if (m.order.length > this.seen) this.entries.push({ loose: m.order.slice(this.seen) });
    this.seen = m.order.length;
  }

  private idle(what: string): void {
    if (this.running !== null) throw new Error(`part '${this.running}' calls ${what}`);
  }

  part(m: Mix, name: string, make: () => void): void {
    this.idle(`part '${name}'`);
    if (this.parts.has(name)) throw new Error(`a second part named '${name}'`);
    this.flush(m);
    const p = { name, make };
    this.parts.set(name, p);
    this.entries.push({ part: p });
  }

  finish(m: Mix, step: (m: Mix) => void): void {
    this.idle('finish');
    this.flush(m);
    this.finishes.push(step);
  }

  eachLayer(m: Mix, name: string, step: LayerStep): void {
    this.idle(`eachLayer '${name}'`);
    this.flush(m);
    this.steps.push([name, step]);
  }

  /** Ends the collection: the layers added after the last part are kept in their place. */
  close(m: Mix): void {
    this.flush(m);
  }

  /** Makes one part on the mix it was collected from, applies the layer steps, and takes its layers out. */
  run(m: Mix, name: string): PartLayers {
    const p = this.parts.get(name);
    if (!p) throw new Error(`no part named '${name}'`);
    const before = m.order.length;
    this.running = name;
    try {
      p.make();
    } finally {
      this.running = null;
    }
    const names = m.order.splice(before);
    const out: PartLayers = names.map((n) => [n, m.layers.get(n)!]);
    for (const [, step] of this.steps) for (const [n, l] of out) step(m, n, l);
    for (const n of names) m.layers.delete(n);
    return out;
  }
}

/** Runs a scene's function with a collector. */
export async function collect(entry: string, exportName: string): Promise<{ m: Mix; c: Collector }> {
  const c = new Collector();
  const old = setBuilder(c);
  try {
    const mod = await import(entry);
    const m = (await mod[exportName]()) as Mix;
    c.close(m);
    return { m, c };
  } finally {
    setBuilder(old);
  }
}

const sha = (...parts: string[]): string => {
  const h = createHash('sha256');
  for (const p of parts) h.update(`${p}\0`);
  return h.digest('hex');
};

/** The builder's own files, which make no sample: FORMAT stands for them. */
const BUILDER = new Set(['build.ts', 'build-worker.ts', 'part-keys.ts', 'peak-worker.ts']);

/** Every file of the study's models: a change to any of them changes every key. */
function studyHash(): string {
  const dir = dirname(new URL(import.meta.url).pathname);
  const h = createHash('sha256');
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (!BUILDER.has(f) && statSync(p).isFile())
      h.update(`${f}\0`).update(readFileSync(p)).update('\0');
  }
  return h.digest('hex');
}

function mixHash(m: Mix): string {
  const r = m.room;
  return sha(
    JSON.stringify({
      t0: m.t0,
      t1: m.t1,
      tail: m.tail,
      n: m.n,
      revDb: m.revDb,
      until: m.until,
      room: [r.x, r.y, r.z, r.listener, r.rtMid, r.beta],
    }),
  );
}

// ---------------------------------------------------------------- the cache's files

interface LayerHead {
  readonly name: string;
  readonly start: number;
  readonly gainDb: number;
  readonly target: number | null;
  readonly meter: Meter;
  readonly t: number;
  /** The lengths of dry left, dry right, wet left, wet right; a negative length is all zeros. */
  readonly lengths: number[];
}

const allZero = (x: Float32Array): boolean => {
  const u = new Uint32Array(x.buffer, x.byteOffset, x.length);
  for (let i = 0; i < u.length; i++) if (u[i] !== 0) return false;
  return true;
};

export function encode(layers: PartLayers): Uint8Array {
  const heads: LayerHead[] = [];
  const data: Float32Array[] = [];
  for (const [name, l] of layers) {
    const arrays = [l.dry[0], l.dry[1], l.wet[0], l.wet[1]];
    const lengths = arrays.map((a) => {
      if (a.length > 0 && allZero(a)) return -a.length;
      data.push(a);
      return a.length;
    });
    heads.push({ name, start: l.start, gainDb: l.gainDb, target: l.target, meter: l.meter, t: l.t, lengths });
  }
  let head = new TextEncoder().encode(JSON.stringify(heads));
  const headLen = Math.ceil(head.length / 4) * 4;
  const total = 8 + headLen + data.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, FORMAT, true);
  v.setUint32(4, headLen, true);
  out.fill(0x20, 8, 8 + headLen);
  out.set(head, 8);
  head = new Uint8Array(0);
  let o = 8 + headLen;
  for (const a of data) {
    out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o);
    o += a.byteLength;
  }
  return out;
}

export function decode(buf: Uint8Array): PartLayers {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (v.getUint32(0, true) !== FORMAT) throw new Error('a cache file of another format');
  const headLen = v.getUint32(4, true);
  const heads = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + headLen))) as LayerHead[];
  // one copy, aligned, that the layers share (a Buffer's own slice() is a view, not a copy)
  const body = new Float32Array(Uint8Array.prototype.slice.call(buf, 8 + headLen).buffer);
  let o = 0;
  return heads.map((h) => {
    const [dl, dr, wl, wr] = h.lengths.map((n) => {
      if (n <= 0) return new Float32Array(-n);
      const a = body.subarray(o, o + n);
      o += n;
      return a;
    }) as [Float32Array, Float32Array, Float32Array, Float32Array];
    const layer: Layer = {
      start: h.start,
      dry: [dl, dr],
      wet: [wl, wr],
      gainDb: h.gainDb,
      target: h.target,
      meter: h.meter,
      t: h.t,
    };
    return [h.name, layer];
  });
}

/** Bun's zstd, typed here: the repository does not load Bun's types. */
const zstd = (globalThis as unknown as {
  Bun: {
    zstdCompressSync(data: Uint8Array, opts: { level: number }): Uint8Array;
    zstdDecompressSync(data: Uint8Array): Uint8Array;
  };
}).Bun;

// A file is the bytes of `encode` cut into four planes (every first byte of a float, then every
// second, ...) and compressed with zstd: about 47 % of the floats' size, read back exactly.

/** The bytes of `encode`, packed for the disk: their length, then the planes compressed. */
export function pack(raw: Uint8Array): Uint8Array {
  const n = raw.length / 4;
  const planes = new Uint8Array(raw.length);
  for (let i = 0; i < n; i++) {
    planes[i] = raw[4 * i]!;
    planes[n + i] = raw[4 * i + 1]!;
    planes[2 * n + i] = raw[4 * i + 2]!;
    planes[3 * n + i] = raw[4 * i + 3]!;
  }
  const z = zstd.zstdCompressSync(planes, { level: 1 });
  const out = new Uint8Array(8 + z.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, FORMAT, true);
  v.setUint32(4, raw.length, true);
  out.set(z, 8);
  return out;
}

export function unpack(file: Uint8Array): Uint8Array {
  const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (v.getUint32(0, true) !== FORMAT) throw new Error('a cache file of another format');
  const planes = zstd.zstdDecompressSync(file.subarray(8));
  const len = v.getUint32(4, true);
  if (planes.length !== len) throw new Error('a cache file cut short');
  const n = len / 4;
  const raw = new Uint8Array(len);
  for (let i = 0; i < n; i++) {
    raw[4 * i] = planes[i]!;
    raw[4 * i + 1] = planes[n + i]!;
    raw[4 * i + 2] = planes[2 * n + i]!;
    raw[4 * i + 3] = planes[3 * n + i]!;
  }
  return raw;
}

function writeAtomic(path: string, data: Uint8Array): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/** Removes the files no build used lately, oldest first, until the cache holds at most `keep` bytes. */
function prune(dir: string, used: ReadonlySet<string>, keep: number): number {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.bin'))
    .map((f) => {
      const s = statSync(join(dir, f));
      return { f, size: s.size, mtime: s.mtimeMs };
    });
  let total = files.reduce((s, x) => s + x.size, 0);
  for (const x of files.sort((a, b) => a.mtime - b.mtime)) {
    if (total <= keep) break;
    if (used.has(x.f)) continue;
    unlinkSync(join(dir, x.f));
    total -= x.size;
  }
  return total;
}

// ---------------------------------------------------------------- the workers

interface Done {
  readonly name: string;
  readonly layers: PartLayers;
  readonly seconds: number;
  /** The part's cache file (`pack`), made where the part was made. */
  readonly file: Uint8Array;
}

/** Makes the named parts on `count` workers, the given order first; calls `done` as each comes back. */
async function makeOnWorkers(
  entry: string,
  exportName: string,
  names: readonly string[],
  count: number,
  packFiles: boolean,
  done: (d: Done) => void,
): Promise<void> {
  const queue = [...names];
  const url = new URL('./build-worker.ts', import.meta.url);
  const one = (): Promise<void> =>
    new Promise((resolveOne, reject) => {
      const w = new Worker(url);
      const next = () => {
        const name = queue.shift();
        if (name === undefined) {
          w.terminate();
          resolveOne();
        } else w.postMessage({ type: 'run', name });
      };
      w.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type: string } & Partial<Done> & { error?: string };
        if (msg.type === 'error') {
          w.terminate();
          reject(new Error(msg.error));
        } else if (msg.type === 'ready') next();
        else {
          done(msg as Done);
          next();
        }
      };
      w.onerror = (e) => {
        w.terminate();
        reject(new Error(`a worker failed: ${e.message}`));
      };
      w.postMessage({ type: 'init', entry, exportName, pack: packFiles });
    });
  await Promise.all(Array.from({ length: Math.min(count, names.length) }, one));
}

/** Reads cache files on `count` workers, the largest first: unpacking is most of a warm build. */
async function loadOnWorkers(
  hits: readonly [string, string][],
  count: number,
  made: Map<string, PartLayers>,
): Promise<void> {
  const queue = [...hits].sort((a, b) => statSync(b[1]).size - statSync(a[1]).size);
  const url = new URL('./build-worker.ts', import.meta.url);
  const one = (): Promise<void> =>
    new Promise((resolveOne, reject) => {
      const w = new Worker(url);
      const next = () => {
        const job = queue.shift();
        if (job === undefined) {
          w.terminate();
          resolveOne();
        } else w.postMessage({ type: 'load', name: job[0], path: job[1] });
      };
      w.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type: string; name: string; layers: PartLayers; error?: string };
        if (msg.type === 'error') {
          w.terminate();
          reject(new Error(msg.error));
          return;
        }
        made.set(msg.name, msg.layers);
        next();
      };
      w.onerror = (e) => {
        w.terminate();
        reject(new Error(`a worker failed: ${e.message}`));
      };
      next();
    });
  await Promise.all(Array.from({ length: Math.min(count, hits.length) }, one));
}

// ---------------------------------------------------------------- the build

/** The default cache: `.cache/scene-parts/` at the repository's root (ignored by git). */
export const DEFAULT_CACHE = resolve(dirname(new URL(import.meta.url).pathname), '../../.cache/scene-parts');

export async function build(
  entryPath: string,
  opts: BuildOptions = {},
): Promise<{ mix: Mix; report: BuildReport }> {
  const entry = resolve(entryPath);
  const exportName = opts.exportName ?? 'scene';
  const workers = opts.workers ?? availableParallelism();
  const cacheDir = opts.cacheDir === undefined ? DEFAULT_CACHE : opts.cacheDir;
  const log = opts.log ?? (() => {});

  const t0 = performance.now();
  const { m, c } = await collect(entry, exportName);
  const t1 = performance.now();

  const keys = sceneKeys(entry);
  for (const name of c.parts.keys())
    if (!keys.parts.has(name)) throw new Error(`part '${name}' is not in the scene's sources`);
  const stepKeys = c.steps.map(([name]) => {
    const k = keys.steps.get(name);
    if (!k) throw new Error(`layer step '${name}' is not in the scene's sources`);
    return k;
  });
  const common = sha(`format ${FORMAT}`, process.versions.bun ?? process.version, studyHash(), mixHash(m), ...stepKeys);
  const fileOf = new Map<string, string>();
  for (const name of c.parts.keys()) fileOf.set(name, `${sha(common, name, keys.parts.get(name)!)}.bin`);
  const t2 = performance.now();

  const made = new Map<string, PartLayers>();
  const missing: string[] = [];
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  const now = new Date();
  const hits: [string, string][] = [];
  for (const name of c.parts.keys()) {
    const path = cacheDir ? join(cacheDir, fileOf.get(name)!) : null;
    if (path && existsSync(path)) {
      hits.push([name, path]);
      utimesSync(path, now, now);
    } else missing.push(name);
  }
  if (hits.length > 1 && workers > 1) await loadOnWorkers(hits, workers, made);
  else for (const [name, path] of hits) made.set(name, decode(unpack(readFileSync(path))));
  const loaded = made.size;

  // the longest first, from the seconds each part took when it was last made
  const timingsPath = cacheDir ? join(cacheDir, 'timings.json') : null;
  let timings: Record<string, number> = {};
  try {
    if (timingsPath && existsSync(timingsPath)) timings = JSON.parse(readFileSync(timingsPath, 'utf8'));
  } catch {
    timings = {};
  }
  missing.sort((a, b) => (timings[b] ?? 1e9) - (timings[a] ?? 1e9));

  const partSeconds: Record<string, number> = {};
  const done = (d: Done) => {
    made.set(d.name, d.layers);
    partSeconds[d.name] = d.seconds;
    if (cacheDir) writeAtomic(join(cacheDir, fileOf.get(d.name)!), d.file);
    log(`  made ${d.name} (${d.seconds.toFixed(1)} s)`);
  };
  if (missing.length > 0 && workers > 0) await makeOnWorkers(entry, exportName, missing, workers, cacheDir !== null, done);
  else
    for (const name of missing) {
      const s = performance.now();
      const layers = c.run(m, name);
      const seconds = (performance.now() - s) / 1000;
      done({ name, layers, seconds, file: cacheDir ? pack(encode(layers)) : new Uint8Array(0) });
    }
  const t3 = performance.now();

  // the layers in the scene's order, the loose ones with the layer steps, then the finish steps
  const loose: string[] = [];
  m.order.length = 0;
  for (const e of c.entries) {
    if ('part' in e) {
      for (const [n, l] of made.get(e.part.name)!) {
        m.order.push(n);
        m.layers.set(n, l);
      }
    } else {
      for (const n of e.loose) m.order.push(n);
      loose.push(...e.loose);
    }
  }
  for (const [, step] of c.steps) for (const n of loose) step(m, n, m.layers.get(n)!);
  for (const step of c.finishes) step(m);
  const t4 = performance.now();

  let cacheBytes = 0;
  if (cacheDir) {
    writeFileSync(timingsPath!, JSON.stringify({ ...timings, ...partSeconds }, null, 1));
    const used = new Set(fileOf.values());
    const usedBytes = [...used].reduce((s, f) => s + statSync(join(cacheDir, f)).size, 0);
    // the disk is small: keep a quarter more than this build uses, for a round that goes back
    cacheBytes = prune(cacheDir, used, 1.25 * usedBytes);
  }
  return {
    mix: m,
    report: {
      parts: c.parts.size,
      loaded,
      made: missing.length,
      workers: missing.length > 0 ? Math.min(workers, missing.length) : 0,
      seconds: {
        collect: (t1 - t0) / 1000,
        keys: (t2 - t1) / 1000,
        parts: (t3 - t2) / 1000,
        finish: (t4 - t3) / 1000,
      },
      partSeconds,
      cacheBytes,
    },
  };
}

/** Two workers that measure the true peak of one channel each. */
class PeakWorkers {
  private readonly ws: Worker[];

  private constructor() {
    const url = new URL('./peak-worker.ts', import.meta.url);
    this.ws = [new Worker(url), new Worker(url)];
  }

  static async with<T>(f: (p: PeakWorkers) => Promise<T>): Promise<T> {
    const p = new PeakWorkers();
    try {
      return await f(p);
    } finally {
      for (const w of p.ws) w.terminate();
    }
  }

  private one(w: Worker, x: Float64Array): Promise<number> {
    return new Promise<number>((ok, fail) => {
      w.onmessage = (e: MessageEvent) => ok(e.data as number);
      w.onerror = (e) => fail(new Error(`a peak worker failed: ${e.message}`));
      w.postMessage(x);
    });
  }

  /**
   * The largest of the channels' peaks in dB is the peak in dB of both (`truePeakDb` takes the
   * largest sample before the logarithm, which keeps the order), so the value is the same.
   */
  async peakDb(x: Stereo): Promise<number> {
    return Math.max(...(await Promise.all(x.map((ch, c) => this.one(this.ws[c]!, ch)))));
  }
}

/**
 * The mix's master (`Mix.render`), with the true peak of each channel measured on its own worker:
 * the samples are the ones `render` gives. `peakDb` is the true peak of the result, measured on
 * the same workers.
 */
export async function renderMaster(
  m: Mix,
  peakDbtp = -2.0,
): Promise<{ y: Stereo; peakDb: number }> {
  return PeakWorkers.with(async (p) => {
    const y = await m.renderWith((x) => p.peakDb(x), peakDbtp);
    return { y, peakDb: await p.peakDb(y) };
  });
}
