// The options and the helpers of experiment 8, apart from the harness, so that the runner reads
// them without importing a shader module.

/** The tiers of the experiment. On WebGL2 a call it cannot run falls to the CPU tier. */
export type Tier = 'webgpu' | 'webgl2' | 'cpu';

/** The tiers a run on `tier` may use, in order (compiler surface §65, "The tiers"). */
export const tiersOf = (tier: Tier): Tier[] => (tier === 'webgl2' ? ['webgl2', 'cpu'] : [tier]);

export interface Options {
  readonly tier: Tier;
  /** The blocks of the timed render of the plan, from the first; 0 is every block of the clip. */
  readonly blocks: number;
  /** The blocks rendered twice to count the values that differ. */
  readonly repeatBlocks: number;
  /** The seconds of each of the two variants of the A/B step. */
  readonly variantSeconds: number;
  /** Whether to return the mix as base64, for the runner's comparison across tiers. */
  readonly returnMix: boolean;
}

export const DEFAULTS: Omit<Options, 'tier'> = {
  blocks: 0,
  repeatBlocks: 150,
  variantSeconds: 15,
  returnMix: true,
};

/** The statistics of a set of numbers: the median and the 95th percentile by nearest rank. */
export interface Stats {
  readonly median: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
}

export function statsOf(xs: readonly number[]): Stats {
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = (p: number): number =>
    sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
  return {
    median: rank(50),
    p95: rank(95),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: sorted.reduce((s, x) => s + x, 0) / sorted.length,
  };
}

/** The tier's time per block against the budget of a block. */
export interface BlockTiming {
  readonly blocks: number;
  readonly budgetMs: number;
  readonly ms: Stats;
  /** The first block, apart: the pipelines are built on it. */
  readonly firstMs: number;
  /** The blocks over the budget, the first excluded. */
  readonly over: number;
  /** The seconds of audio rendered per second of host time over the blocks. */
  readonly realTime: number;
}

export function timingOf(blockMs: readonly number[], budgetMs: number): BlockTiming {
  const rest = blockMs.slice(1);
  const total = blockMs.reduce((s, x) => s + x, 0);
  return {
    blocks: blockMs.length,
    budgetMs,
    ms: statsOf(rest.length > 0 ? rest : blockMs),
    firstMs: blockMs[0]!,
    over: rest.filter((x) => x > budgetMs).length,
    realTime: (blockMs.length * budgetMs) / total,
  };
}
