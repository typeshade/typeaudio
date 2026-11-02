// The options, the rows and the bank of experiment 4, apart from the harness, so that the runner
// and the reference read them without importing a shader module.

/**
 * The variants of a block (docs/records/04-additive-container.md, "The method"). The first three
 * differ in the sum of the partials, with the filters' coefficients designed on the device in `f32`:
 *
 * - `gather`: the engine's `mixdown`, shape G: one invocation per frame adds the lanes one after
 *   another;
 * - `tree`: `sumFrame` once per frame, a reduction in the tree order of Rule 7.2;
 * - `scatter`: `sumScatter`, the lanes added into the block, which the proof refuses for the GPU.
 *
 * The last two differ from `gather` in where the coefficients come from (ask D):
 *
 * - `host`: the host designs them in JavaScript doubles and writes them to the device each block;
 * - `f64`: the device designs them in the emulated `f64` of surface §39.
 *
 * The last differs from `gather` in where the lanes live:
 *
 * - `resident`: a `Resident` the device makes once and every block writes again, instead of a
 *   scratch array of the scope, which a plan makes and frees each block when two of its groups
 *   share it.
 */
export const VARIANTS = ['gather', 'tree', 'scatter', 'host', 'f64', 'resident'] as const;
export type Variant = (typeof VARIANTS)[number];

/**
 * The tiers of the experiment. On WebGPU and on WebGL2 a call the tier cannot run falls to the CPU
 * tier, as it does for a device the engine opens: `sumScatter` has no GPU form at all.
 */
export type Tier = 'webgpu' | 'webgl2' | 'cpu';

/** The tiers a run on `tier` may use, in order (compiler surface §65, "The tiers"). */
export const tiersOf = (tier: Tier): Tier[] => (tier === 'cpu' ? ['cpu'] : [tier, 'cpu']);

/** The sample rate of the experiment, in hertz. */
export const SR = 48000;

/** The master gain after the sum, an exact power of two. */
export const MASTER = 0.5;

export interface Options {
  readonly tier: Tier;
  /** The partials of the bank, one lane each. */
  readonly partials: number;
  /** The frames of one block. */
  readonly frames: number;
  /** The timed blocks of each variant. */
  readonly blocks: number;
  /** The blocks run before the timed ones, the first among them timed apart as `firstMs`. */
  readonly warmup: number;
  readonly variants: readonly Variant[];
  /** Whether to run the sums' check on fixed lanes after the variants (`sumCheck`). */
  readonly sums: boolean;
}

export interface Row {
  readonly variant: Variant;
  /** The tier of the plan, the fuse report's `tier`: the best tier any call of it ran on. */
  readonly tier: string;
  readonly partials: number;
  readonly frames: number;
  readonly blocks: number;
  /** The first block, apart: the pipelines are built on the first call. */
  readonly firstMs: number;
  readonly medianMs: number;
  readonly p99Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly meanMs: number;
  /** The mean GPU time of a timed block, the sum of its groups' `gpuTime`, where the device measured it. */
  readonly gpuMs?: number;
  /** The mean GPU time of each group of the plan over the timed blocks, in milliseconds, where the device measured it. */
  readonly groupGpuMs?: readonly number[];
  /** The dispatches of each timed block's plan: the smallest and the largest. */
  readonly dispatches: readonly [number, number];
  /** The submissions of each timed block's plan: the smallest and the largest. */
  readonly submissions: readonly [number, number];
}

/** The settings of one partial, as `new Partial(...)` takes them. */
export interface PartialSpec {
  readonly f: number;
  readonly level: number;
  readonly cutoff: number;
  readonly q: number;
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
}

/**
 * The bank: `count` partials spaced evenly in pitch from 20 Hz to 20 kHz, each at the level
 * `0.25 / sqrt(count)`, its filter's cutoff an octave above it, its envelope rising in 5 to 15 ms
 * and falling in 4 s (the lowest) to 0.2 s (the highest) toward a sustain of 0.2 to 0.5.
 */
export function spec(count: number): PartialSpec[] {
  return Array.from({ length: count }, (_, k) => {
    const f = 20 * 1000 ** (k / count);
    return {
      f,
      level: 0.25 / Math.sqrt(count),
      cutoff: 2 * f,
      q: 0.707,
      attack: 0.005 + (0.01 * (k % 7)) / 6,
      decay: 0.2 + 3.8 * (1 - k / count),
      sustain: 0.2 + 0.3 * ((k * 0.6180339887498949) % 1),
    };
  });
}

/** The sweep of block `b`: the filters' cutoffs move between a quarter and four times their own, over 256 blocks. */
export const sweepAt = (b: number): number => 2 ** (2 * Math.sin((2 * Math.PI * b) / 256));

/**
 * The input of the sums' check: `count * frames` values in [-1, 1), the same on every host, from a
 * multiplicative hash of the index. Each is an `f32`, so a tier that uploads them keeps their bits.
 */
export function lanesInput(count: number, frames: number): Float32Array {
  const out = new Float32Array(count * frames);
  for (let i = 0; i < out.length; i++) out[i] = (Math.imul(i + 1, 2654435761) >>> 0) / 2 ** 31 - 1;
  return out;
}
