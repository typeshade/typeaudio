// Experiment 2 in a page: `run.ts` bundles this file, opens it in headless Chromium and calls
// `exp02.offline` and `exp02.realtime` for each run. Each run makes its own context, loads a
// worklet bundle into it with `audioWorklet.addModule`, and plays one processor into the
// destination. The page holds each output to a reference of the same voices.

import { refRender, RefVoice } from '../../test/reference.ts';
import {
  QUANTUM,
  SR,
  type BundleName,
  type Check,
  type Message,
  type OfflineResult,
  type ProcessorOptions,
  type RealtimeResult,
  type Stats,
  type Tiers,
  type Variant,
} from './options.ts';

export interface OfflineSpec {
  readonly bundle: BundleName;
  readonly variant: Variant;
  readonly voices: number;
  readonly tiers: Tiers;
  readonly seconds: number;
  /** The first seconds, timed apart: the processor's code is compiled while they render. */
  readonly warmup: number;
  readonly polyfill?: boolean;
  /** Return the census the processor reported. */
  readonly census?: boolean;
}

export interface RealtimeSpec {
  readonly bundle: BundleName;
  readonly variant: Variant;
  readonly voices: number;
  readonly seconds: number;
  readonly polyfill?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var exp02: {
    offline(spec: OfflineSpec): Promise<OfflineResult>;
    realtime(spec: RealtimeSpec): Promise<RealtimeResult>;
  };
  /** The runner's hook, `page.exposeFunction`: it reads the CPU time of the browser's threads.
   *  The page calls it at the start and at the end of the timed part of a run. */
  // eslint-disable-next-line no-var
  var exp02Cpu: ((label: 'start' | 'end') => Promise<void>) | undefined;
}

/** The `plain` output of each voice count, the reference of the other variants. */
const plainOutputs = new Map<number, Float32Array>();

/** The messages of a processor, and a wait for the first of a type. */
class Inbox {
  readonly errors: string[] = [];
  private readonly got: Message[] = [];
  private readonly waiters: (() => void)[] = [];

  constructor(node: AudioWorkletNode) {
    node.port.onmessage = (e: MessageEvent<Message>) => {
      this.got.push(e.data);
      if (e.data.type === 'error') this.errors.push(`${e.data.where}: ${e.data.error}`);
      for (const w of this.waiters.splice(0)) w();
    };
    node.onprocessorerror = (e) => {
      this.errors.push(`processorerror: ${(e as ErrorEvent).message ?? 'process() threw'}`);
      for (const w of this.waiters.splice(0)) w();
    };
  }

  /** The last message of `type`, once there is one, or undefined after `ms`. */
  async wait<T extends Message['type']>(type: T, ms: number): Promise<Extract<Message, { type: T }> | undefined> {
    const find = () => [...this.got].reverse().find((m) => m.type === type) as Extract<Message, { type: T }> | undefined;
    const deadline = performance.now() + ms;
    while (find() === undefined && performance.now() < deadline) {
      await new Promise<void>((done) => {
        this.waiters.push(done);
        setTimeout(done, Math.max(0, deadline - performance.now()));
      });
    }
    return find();
  }
}

const describe = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** `out` against `ref` over their common frames, at the same frame and one quantum late. */
function check(reference: string, out: Float32Array, ref: Float32Array): Check {
  const frames = Math.min(out.length, ref.length);
  let same = 0;
  let late = 0;
  let largest = 0;
  for (let i = 0; i < frames; i++) {
    if (Object.is(out[i], ref[i])) same++;
    if (i >= QUANTUM && Object.is(out[i], ref[i - QUANTUM])) late++;
    largest = Math.max(largest, Math.abs(out[i]! - ref[i]!));
  }
  return { reference, frames, same, sameOneQuantumLate: late, largestDifference: largest };
}

function processorOptions(variant: Variant, voices: number, tiers: Tiers, frames: number, polyfill?: boolean): ProcessorOptions {
  return { variant, voices, tiers, frames, ...(polyfill === undefined ? {} : { polyfill }) };
}

function makeNode(ctx: BaseAudioContext, options: ProcessorOptions): AudioWorkletNode {
  return new AudioWorkletNode(ctx, 'exp02', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: options,
  });
}

async function offline(spec: OfflineSpec): Promise<OfflineResult> {
  const frames = spec.seconds * SR;
  const base = {
    bundle: spec.bundle,
    variant: spec.variant,
    voices: spec.voices,
    tiers: spec.tiers,
    ...(spec.polyfill === undefined ? {} : { polyfill: spec.polyfill }),
    seconds: spec.seconds,
    warmupSeconds: spec.warmup,
  };
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: frames, sampleRate: SR });
  const loadStart = performance.now();
  let node: AudioWorkletNode;
  try {
    await ctx.audioWorklet.addModule(`./${spec.bundle}/processor.js`);
  } catch (e) {
    return { ...base, addModuleMs: performance.now() - loadStart, loadError: describe(e), errors: [] };
  }
  const addModuleMs = performance.now() - loadStart;
  try {
    node = makeNode(ctx, processorOptions(spec.variant, spec.voices, spec.tiers, frames, spec.polyfill));
  } catch (e) {
    return { ...base, addModuleMs, loadError: describe(e), errors: [] };
  }
  const inbox = new Inbox(node);
  const ready = await inbox.wait('ready', 20_000);
  node.connect(ctx.destination);
  // The timed part runs from the end of the warm-up to the start of the last quantum. The context
  // is suspended at both ends, so the runner reads the CPU time of the browser's threads while the
  // render thread stands still, and the wall clock is read on the page's side of each suspension.
  const cpu = globalThis.exp02Cpu;
  const last = (frames - QUANTUM) / SR;
  const warm = spec.warmup > 0 && spec.warmup < last ? spec.warmup : 0;
  let from: number | undefined;
  let to: number | undefined;
  if (warm > 0) {
    void ctx.suspend(warm).then(async () => {
      await cpu?.('start');
      from = performance.now();
      void ctx.resume();
    });
  }
  void ctx.suspend(last).then(async () => {
    to = performance.now();
    await cpu?.('end');
    void ctx.resume();
  });
  if (warm === 0) await cpu?.('start');
  const start = performance.now();
  if (warm === 0) from = start;
  const buffer = await ctx.startRendering();
  const stats = (await inbox.wait('stats', 5_000))?.stats;
  const out = buffer.getChannelData(0);
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  const timedAudioMs = (last - warm) * 1000;
  const timedMs = (to ?? Number.NaN) - (from ?? Number.NaN);
  let reference: Check | undefined;
  if (spec.variant === 'plain') {
    plainOutputs.set(spec.voices, out.slice());
  } else if (spec.variant === 'engine') {
    const refs = Array.from({ length: spec.voices }, (_, v) => new RefVoice(110 * (1 + v / 8), 2400, 0.7, SR));
    reference = check('refRender', out, refRender(refs, frames, QUANTUM, 1, 1 / spec.voices));
  } else if (spec.variant !== 'empty') {
    const plain = plainOutputs.get(spec.voices);
    if (plain !== undefined) reference = check('plain', out, plain);
  }
  return {
    ...base,
    addModuleMs,
    ...(ready === undefined ? {} : { setupMs: ready.setupMs }),
    ...(ready === undefined || spec.census !== true ? {} : { census: ready.census }),
    ...(warm === 0 || from === undefined ? {} : { warmupMs: from - start, warmupRatio: (from - start) / (warm * 1000) }),
    timedMs,
    timedAudioMs,
    ratio: timedMs / timedAudioMs,
    quantumMs: timedMs / ((timedAudioMs / 1000) * (SR / QUANTUM)),
    ...(stats === undefined ? {} : { stats }),
    errors: inbox.errors,
    ...(reference === undefined ? {} : { check: reference }),
    peak,
  };
}

/** `AudioContext.playbackStats` as plain data, where the browser has it. */
function playbackStats(ctx: AudioContext): unknown {
  const s = (ctx as unknown as { playbackStats?: Record<string, unknown> & { toJSON?(): unknown } }).playbackStats;
  if (s === undefined) return undefined;
  if (typeof s.toJSON === 'function') return s.toJSON();
  const out: Record<string, unknown> = {};
  for (const k in s) if (typeof s[k] !== 'function') out[k] = s[k];
  return out;
}

async function realtime(spec: RealtimeSpec): Promise<RealtimeResult> {
  const base = { variant: spec.variant, voices: spec.voices, seconds: spec.seconds };
  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' });
  } catch (e) {
    return { ...base, error: `new AudioContext(): ${describe(e)}` };
  }
  try {
    await ctx.audioWorklet.addModule(`./${spec.bundle}/processor.js`);
    const node = makeNode(ctx, processorOptions(spec.variant, spec.voices, 'cpu', Number.MAX_SAFE_INTEGER, spec.polyfill));
    const inbox = new Inbox(node);
    await inbox.wait('ready', 20_000);
    node.connect(ctx.destination);
    const resumed = await Promise.race([
      ctx.resume().then(() => true),
      new Promise<boolean>((done) => setTimeout(() => done(false), 5_000)),
    ]);
    if (!resumed || ctx.state !== 'running') {
      return { ...base, state: ctx.state, error: `the context did not start: its state is "${ctx.state}" after resume()` };
    }
    const before = playbackStats(ctx);
    await globalThis.exp02Cpu?.('start');
    const t0 = performance.now();
    const c0 = ctx.currentTime;
    await new Promise((done) => setTimeout(done, spec.seconds * 1000));
    const t1 = performance.now();
    const c1 = ctx.currentTime;
    await globalThis.exp02Cpu?.('end');
    const after = playbackStats(ctx);
    node.port.postMessage('report');
    const stats: Stats | undefined = (await inbox.wait('stats', 5_000))?.stats;
    return {
      ...base,
      wallMs: t1 - t0,
      state: ctx.state,
      baseLatency: ctx.baseLatency,
      outputLatency: ctx.outputLatency,
      clockRatio: (c1 - c0) / ((t1 - t0) / 1000),
      ...(before === undefined ? {} : { playbackStats: { before, after } }),
      ...(stats === undefined ? {} : { stats }),
      ...(inbox.errors.length === 0 ? {} : { error: inbox.errors.join('; ') }),
    };
  } catch (e) {
    return { ...base, state: ctx.state, error: describe(e) };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

globalThis.exp02 = { offline, realtime };
