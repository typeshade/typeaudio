// The options and the rows of experiment 1, apart from the harness, so that the runner reads them
// without importing a shader module.

export const SIZES = [128, 256, 512, 1024, 2048, 4096] as const;
export const VARIANTS = ['call', 'resident', 'budget', 'engine'] as const;
export type Variant = (typeof VARIANTS)[number];

export interface Options {
  readonly tier: 'webgpu' | 'cpu';
  /** The timed blocks of each size. */
  readonly blocks: number;
  /** The blocks run before the timed ones, the first among them timed apart as `firstMs`. */
  readonly warmup: number;
  readonly sizes: readonly number[];
  readonly variants: readonly Variant[];
  /** The time budget of the `budget` variant's device, in milliseconds. */
  readonly budgetMs: number;
  /** The voices of the `engine` variant's bank. */
  readonly voices: number;
}

export interface Row {
  readonly variant: Variant;
  /** The tier the call ran on: the device's tier, or the report's for `engine`. */
  readonly tier: string;
  readonly frames: number;
  readonly blocks: number;
  /** The first block of the size, apart: the pipeline is built on the first call. */
  readonly firstMs: number;
  readonly medianMs: number;
  readonly p99Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly meanMs: number;
  /** `budget`: what the device learned a block costs, fenced, from `chunkRates`. */
  readonly chunkMs?: number;
  /** `engine`: the mean GPU time of a block, where the device measured one (`gpuTime`). */
  readonly gpuMs?: number;
  /** `engine`: the dispatches of the last block's plan. */
  readonly dispatches?: number;
}
