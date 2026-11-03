// The options and the rows of experiment 6, apart from the harness, so that the runner reads them
// without importing a shader module.

/**
 * The ways a run times its blocks, each from the same seed, so each renders the same blocks:
 *
 * - `fenced`: each block is one `fuse` plan, then `dev.wait()`, the fence; the block is timed from
 *   the call to the fence. Nothing is read back.
 * - `again`: `fenced` a second time, on a new device: the second render of the same seed.
 * - `stream`: the blocks are submitted one after another with no fence and no read; the run is
 *   timed from the first timed block to one fence after the last. On WebGPU it runs on a device
 *   the harness requests without `timestamp-query`, so no plan maps its timestamps back.
 * - `stamped`: `stream` on the tier's default device. On WebGPU that device has
 *   `timestamp-query` where the adapter has it, and each plan maps its timestamps back before
 *   `fuse` resolves. On the other tiers it is `stream` again, and the harness skips it.
 */
export const ARMS = ['fenced', 'again', 'stream', 'stamped'] as const;
export type Arm = (typeof ARMS)[number];

/** The tiers of the experiment. On WebGL2 a call it cannot run falls to the CPU tier. */
export type Tier = 'webgpu' | 'webgl2' | 'cpu';

/** The tiers a run on `tier` may use, in order (compiler surface §65, "The tiers"). */
export const tiersOf = (tier: Tier): Tier[] => (tier === 'webgl2' ? ['webgl2', 'cpu'] : [tier]);

export interface Options {
  readonly tier: Tier;
  /** The timed blocks of each arm. */
  readonly blocks: number;
  /** The blocks run before the timed ones, the first among them timed apart as `firstMs`. */
  readonly warmup: number;
  /** The frames of a block. */
  readonly block: number;
  /** The grains a second the cloud starts, on average. */
  readonly density: number;
  /** The grains a list holds. */
  readonly capacity: number;
  /** The seed of the cloud. */
  readonly seed: number;
  /** The sample rate, in hertz. */
  readonly sr: number;
  readonly arms: readonly Arm[];
}

/** The defaults: experiment 6's question, 10,000 grains a second at blocks of 1,024 frames. */
export const DEFAULTS: Omit<Options, 'tier'> = {
  blocks: 1000,
  warmup: 10,
  block: 1024,
  density: 10000,
  capacity: 2048,
  seed: 1,
  sr: 48000,
  arms: ARMS,
};

/** The statistics of a set of numbers: the median and the 99th percentile by nearest rank. */
export interface Stats {
  readonly median: number;
  readonly p99: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
}

export function statsOf(xs: readonly number[]): Stats {
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = (p: number): number => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
  return {
    median: rank(50),
    p99: rank(99),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: sorted.reduce((s, x) => s + x, 0) / sorted.length,
  };
}

/** One arm of a run. */
export interface Row {
  readonly arm: Arm;
  /** The tier of the plans, the fuse report's: the best tier any call of a plan ran on. */
  readonly tier: string;
  readonly blocks: number;
  /** The first block, apart: the pipelines are built on the first plan. */
  readonly firstMs: number;
  /** `fenced` and `again`: each timed block from the call to the fence. `stream`: the time of
   *  each block's `fuse` call alone, with no fence. */
  readonly ms: Stats;
  /** `stream`: the timed blocks from the first call to the fence after the last, over the blocks. */
  readonly streamMs?: number;
  /** The GPU time of a block, the sum of its groups' `gpuTime`, where the device measured one. */
  readonly gpuMs?: Stats;
  /** The mean GPU time of each group of a plan, in milliseconds, in the order of the groups. */
  readonly gpuByGroup?: readonly { readonly calls: string; readonly ms: number }[];
  /** The grains in the list each timed block played: after `spawn`. */
  readonly alive: Stats;
  /** The grains `cull` kept each timed block. */
  readonly kept: Stats;
  /** The grains `spawn` appended each timed block. */
  readonly spawned: Stats;
  /** The grains a second `spawn` appended over the timed blocks. */
  readonly grainsPerSecond: number;
  /** The largest count of a list over every block, against its capacity. */
  readonly largest: number;
  /** Whether the last list holds its grains in the order they started (`start` never falls). */
  readonly ordered: boolean;
  /** The dispatches and submissions of each timed block's plan, the same for each block when one value. */
  readonly dispatches: readonly number[];
  readonly submissions: readonly number[];
  /** The bytes `read()` returned while the timed blocks ran (`dev.statistics.readBytes`). */
  readonly readBytes: number;
  /** The reads of the device the page saw while the timed blocks ran: `mapAsync` on WebGPU,
   *  `readPixels` and `getBufferSubData` on WebGL2. Absent on the CPU tier in Node. */
  readonly deviceReads?: number;
}

/** The cloud of the run: its lengths, pitches and level, beside the density and the seed. */
export const CLOUD = { shortest: 0.02, longest: 0.1, low: 220, high: 1760, level: 0.02 } as const;
