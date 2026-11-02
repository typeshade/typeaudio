// The options, the messages and the rows of experiment 2, apart from the worklet code, so that the
// runner and the page read them without importing a shader module.

/** The frames of one render quantum of the Web Audio API. */
export const QUANTUM = 128;
/** The sample rate of every context of the experiment. */
export const SR = 48000;
/** The voice counts of `docs/experiments.md`, section 2. */
export const VOICES = [1, 8, 32, 64, 128, 256, 512] as const;

/**
 * How a processor produces its 128 frames in `process()`:
 *
 * - `empty`: it writes nothing, the cost of the render loop and of the call of `process()` alone;
 * - `kernel`: variant (a), the kernel function `synth` called on the CPU tier with a host
 *   `Float32Array` and an array of `Voice` instances, the lanes mixed when its promise settles;
 * - `host`: variant (b), a JavaScript loop over `Voice` instances built with `new`, which calls
 *   `tick()` once per voice and per frame (compiler change 0109);
 * - `plain`: the plain-JavaScript reference of the tests (`test/reference.ts`), the same `f32`
 *   math with no TypeShade, the ceiling of a JavaScript loop;
 * - `engine`: the engine's own block, `render()` of a bank of voices, one `fuse` plan per quantum
 *   on a device of the CPU tier; it needs the `engine` bundle.
 */
export const VARIANTS = ['empty', 'kernel', 'host', 'plain', 'engine'] as const;
export type Variant = (typeof VARIANTS)[number];

/** The tiers a processor lets its kernel calls try: `default` sets none (WebGPU, WebGL2, then the
 *  CPU tier), `cpu` and `webgpu` set one with `configure({ prefer })`. */
export type Tiers = 'default' | 'cpu' | 'webgpu';

/** The bundles of the worklet: what `run.ts` builds and the page loads with `addModule`. */
export const BUNDLES = {
  /** `processor.ts`, its dynamic imports inlined. */
  kernel: { entry: 'experiments/02-worklet/processor.ts', split: false },
  /** `processor.ts`, each dynamic import left as a chunk of its own. */
  'kernel-split': { entry: 'experiments/02-worklet/processor.ts', split: true },
  /** `engine.ts`, its dynamic imports inlined. */
  engine: { entry: 'experiments/02-worklet/engine.ts', split: false },
  /** `engine.ts`, each dynamic import left as a chunk of its own. */
  'engine-split': { entry: 'experiments/02-worklet/engine.ts', split: true },
} as const;
export type BundleName = keyof typeof BUNDLES;

/** What the page hands a processor through `processorOptions`. */
export interface ProcessorOptions {
  readonly variant: Variant;
  readonly voices: number;
  readonly tiers: Tiers;
  /** The frames the context renders: the processor posts its statistics in the last quantum. */
  readonly frames: number;
  /** `engine`: install the harness's `structuredClone` first, which the scope lacks. */
  readonly polyfill?: boolean;
}

/** What `AudioWorkletGlobalScope` has, by `typeof`, read when the bundle is evaluated. */
export type Census = Record<string, string>;

/** What a processor posts through its port. */
export type Message =
  | { readonly type: 'ready'; readonly census: Census; readonly setupMs: number }
  | { readonly type: 'error'; readonly where: string; readonly error: string }
  | { readonly type: 'stats'; readonly stats: Stats };

/** What a processor counted over a render. */
export interface Stats {
  readonly quanta: number;
  /** The sum, over the quanta, of `Date.now()` from the start of `process()` to the end of the
   *  quantum's work (the scope has no `performance`, so the clock steps by 1 ms). */
  readonly busyMs: number;
  /** How many quanta read each step of `Date.now()`: index `i` counts the steps of `i` ms, the
   *  last index the steps of 10 ms or more. */
  readonly steps: number[];
  /** `kernel` and `engine`: the quanta in which the call had filled its output array when it
   *  returned, before `process()` returned. */
  readonly filledOnReturn: number;
  /** `kernel` and `engine`: the quanta that began while the call of the quantum before was still
   *  pending. */
  readonly unfinished: number;
  /** The first error a call settled with, or none. */
  readonly error?: string;
}

/** The result of one offline render, as the page returns it. */
export interface OfflineResult {
  /** The repetition of the same variant and voice count, from 1. */
  readonly repetition?: number;
  readonly bundle: BundleName;
  readonly variant: Variant;
  readonly voices: number;
  readonly tiers: Tiers;
  /** `engine`: whether the processor installed the harness's `structuredClone`. */
  readonly polyfill?: boolean;
  readonly seconds: number;
  readonly warmupSeconds: number;
  /** `addModule` of the bundle, in milliseconds. */
  readonly addModuleMs: number;
  /** `addModule` failed: its error, and nothing below ran. */
  readonly loadError?: string;
  /** The processor's constructor, in milliseconds by `Date.now()`, as it reported it. */
  readonly setupMs?: number;
  /** `census`: what the scope has, as the bundle read it when it was evaluated. */
  readonly census?: Census;
  /** The wall time of the warm-up seconds and of the timed seconds after them, by the page's
   *  `performance.now()`, and the real-time ratio of each: render time over audio time. */
  readonly warmupMs?: number;
  readonly timedMs?: number;
  /** The audio time of the timed part: from the end of the warm-up to the start of the last
   *  quantum, in milliseconds. */
  readonly timedAudioMs?: number;
  readonly warmupRatio?: number;
  readonly ratio?: number;
  /** The timed part's cost of one quantum, in milliseconds. */
  readonly quantumMs?: number;
  /** The CPU time of the timed part, where the runner could read it (`cpu.ts`). */
  readonly cpu?: Cpu;
  readonly stats?: Stats;
  readonly errors: readonly string[];
  /** The output against the `plain` run of the same voices, where there is one. */
  readonly check?: Check;
  /** The largest magnitude of the output. */
  readonly peak?: number;
}

/**
 * The CPU time of the browser's threads over the timed part of a run, from `/proc` (`cpu.ts`):
 * the thread that spent the most, which is the render thread, and the sum over every thread of
 * the processes the runner started. `ratio` is the busiest thread's CPU time over the audio time
 * of an offline run, or over the wall time of a real-time one.
 */
export interface Cpu {
  readonly thread: string;
  readonly threadMs: number;
  readonly allMs: number;
  readonly ratio: number;
}

/** The output of a run held to a reference over their common frames. */
export interface Check {
  readonly reference: string;
  readonly frames: number;
  /** The frames whose bits are the reference's. */
  readonly same: number;
  /** The frames whose bits are the reference's one quantum earlier: the output a quantum late. */
  readonly sameOneQuantumLate: number;
  readonly largestDifference: number;
}

/** The result of a run in a real-time `AudioContext`. */
export interface RealtimeResult {
  readonly variant: Variant;
  readonly voices: number;
  readonly seconds: number;
  readonly error?: string;
  /** The wall time the context played, by the page's `performance.now()`. */
  readonly wallMs?: number;
  readonly state?: string;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  /** The audio clock over the wall clock: `currentTime` gained per second of `performance.now()`. */
  readonly clockRatio?: number;
  /** `AudioContext.playbackStats`, where the browser has it, before and after. */
  readonly playbackStats?: { readonly before: unknown; readonly after: unknown };
  readonly stats?: Stats;
  /** The CPU time of the browser's threads while the context played, where the runner could
   *  read it (`cpu.ts`). */
  readonly cpu?: Cpu;
}
