// What experiment 2 reads of the AudioWorkletGlobalScope, typed here and not declared as globals:
// TypeScript's DOM library has no worklet scope, and the rest of the program is not a worklet.
// The census, the voices of every variant, and the counter a processor keeps.

import { QUANTUM, SR, type Census, type Message, type ProcessorOptions, type Stats } from './options.ts';

/** The part of a processor's base class the experiment uses. */
export interface ProcessorBase {
  readonly port: MessagePort;
}

/** The members of `AudioWorkletGlobalScope` the experiment uses. */
export interface WorkletScope {
  readonly AudioWorkletProcessor: new () => ProcessorBase;
  registerProcessor(
    name: string,
    processor: new (options: { readonly processorOptions: ProcessorOptions }) => ProcessorBase,
  ): void;
  readonly currentFrame: number;
}

export const scope = globalThis as unknown as WorkletScope;

/** `process()`'s outputs: one array of channels for each output. */
export type Outputs = readonly (readonly Float32Array[])[];

/** The globals the census reads, with `navigator.gpu` read apart. */
const NAMES = [
  'navigator',
  'document',
  'window',
  'self',
  'OffscreenCanvas',
  'performance',
  'TextDecoder',
  'TextEncoder',
  'queueMicrotask',
  'setTimeout',
  'structuredClone',
  'fetch',
  'MessageChannel',
  'crypto',
  'URL',
  'WebAssembly',
  'SharedArrayBuffer',
  'Atomics',
  'Date',
] as const;

/** What the scope has, by `typeof`: what a module evaluated in it can reach. */
export function census(): Census {
  const g = globalThis as unknown as Record<string, unknown>;
  const out: Census = {};
  for (const name of NAMES) out[name] = typeof g[name];
  out['navigator.gpu'] = typeof (g['navigator'] as { gpu?: unknown } | undefined)?.gpu;
  return out;
}

/** The frequency of voice `v`: harmonics of 110 Hz an eighth apart, as experiment 1's bank. */
export const pitchOf = (v: number): number => 110 * (1 + v / 8);
/** The filter of every voice: a lowpass at 2400 Hz with a quality of 0.7. */
export const CUTOFF = 2400;
export const QUALITY = 0.7;
export { SR };

/** What a processor counts, and posts through its port. */
export class Meter {
  quanta = 0;
  busyMs = 0;
  readonly steps: number[] = Array.from({ length: 11 }, () => 0);
  filledOnReturn = 0;
  unfinished = 0;
  error: string | undefined;

  constructor(
    private readonly port: MessagePort,
    private readonly frames: number,
  ) {}

  /** The work of the quantum that began at `frame`, at `start` by `Date.now()`, is done. */
  done(frame: number, start: number): void {
    const ms = Date.now() - start;
    this.quanta++;
    this.busyMs += ms;
    this.steps[Math.min(ms, 10)]!++;
    // An offline context posts in its last quantum: after it, the scope may run nothing more.
    if (frame + QUANTUM >= this.frames) this.report();
  }

  fail(where: string, e: unknown): void {
    const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    if (this.error === undefined) {
      this.error = `${where}: ${error}`;
      this.post({ type: 'error', where, error });
    }
  }

  report(): void {
    const stats: Stats = {
      quanta: this.quanta,
      busyMs: this.busyMs,
      steps: [...this.steps],
      filledOnReturn: this.filledOnReturn,
      unfinished: this.unfinished,
      ...(this.error === undefined ? {} : { error: this.error }),
    };
    this.post({ type: 'stats', stats });
  }

  post(message: Message): void {
    this.port.postMessage(message);
  }
}

/** Mixes `lanes`, `voices` lanes of `QUANTUM` frames each, into `out` at the gain `gain`, in the
 *  order of the voices, each sum rounded to an `f32` as the variants that tick add theirs. */
export function mixLanes(out: Float32Array, lanes: Float32Array, voices: number, gain: number): void {
  const f = Math.fround;
  for (let n = 0; n < QUANTUM; n++) {
    let s = 0;
    for (let v = 0; v < voices; v++) s = f(s + lanes[v * QUANTUM + n]!);
    out[n] = f(s * gain);
  }
}
