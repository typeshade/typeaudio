// Experiment 7: what every arm shares and that needs no compiler at run time: the optimizer, the
// statistics of the times.

/** Adam, with the usual defaults: the step the descent takes with each gradient. */
export class Adam {
  readonly #m: number[];
  readonly #v: number[];
  #t = 0;
  constructor(
    count: number,
    readonly rate = 0.01,
    readonly beta1 = 0.9,
    readonly beta2 = 0.999,
    readonly epsilon = 1e-8,
  ) {
    this.#m = new Array<number>(count).fill(0);
    this.#v = new Array<number>(count).fill(0);
  }
  /** Moves `params` in place by one step against `gradient`. */
  step(params: number[], gradient: readonly number[]): void {
    this.#t++;
    const c1 = 1 - this.beta1 ** this.#t;
    const c2 = 1 - this.beta2 ** this.#t;
    for (let i = 0; i < params.length; i++) {
      const g = gradient[i]!;
      this.#m[i] = this.beta1 * this.#m[i]! + (1 - this.beta1) * g;
      this.#v[i] = this.beta2 * this.#v[i]! + (1 - this.beta2) * g * g;
      params[i] = params[i]! - (this.rate * (this.#m[i]! / c1)) / (Math.sqrt(this.#v[i]! / c2) + this.epsilon);
    }
  }
}

/** The times of the runs of one measure, in milliseconds, after its warm-up runs. */
export interface Timing {
  readonly median: number;
  /** The 95th percentile, by nearest rank. */
  readonly p95: number;
  readonly min: number;
  readonly max: number;
  readonly runs: readonly number[];
  /** The untimed runs before them. */
  readonly warmups?: number;
}

export function timingOf(runs: readonly number[]): Timing {
  const sorted = [...runs].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return { median, p95: sorted[Math.max(0, Math.ceil(0.95 * n) - 1)]!, min: sorted[0]!, max: sorted[n - 1]!, runs };
}

/**
 * How often each measure runs. It runs untimed until it has run `warmup` times and for `warmupMs`
 * milliseconds, then `runs` times timed. A JavaScript engine compiles a function again, faster, after
 * it has run for a while, so a measure's first calls are slower than its later ones; each derivative
 * function of forward mode per parameter is a function of its own and warms up on its own.
 */
export interface Repeats {
  readonly warmup: number;
  readonly warmupMs: number;
  readonly runs: number;
}

/** Runs `run` as `r` says and returns the times of the timed runs, with how many warm-up runs it took. */
export function timed(r: Repeats, run: () => void): Timing {
  let warmups = 0;
  const begin = performance.now();
  while (warmups < r.warmup || performance.now() - begin < r.warmupMs) {
    run();
    warmups++;
  }
  const ms: number[] = [];
  for (let i = 0; i < r.runs; i++) {
    const start = performance.now();
    run();
    ms.push(performance.now() - start);
  }
  return { ...timingOf(ms), warmups };
}

/** The asynchronous form of `timed`, for a GPU call that resolves when its read-back is done. */
export async function timedAsync(r: Repeats, run: () => Promise<void>): Promise<Timing> {
  let warmups = 0;
  const begin = performance.now();
  while (warmups < r.warmup || performance.now() - begin < r.warmupMs) {
    await run();
    warmups++;
  }
  const ms: number[] = [];
  for (let i = 0; i < r.runs; i++) {
    const start = performance.now();
    await run();
    ms.push(performance.now() - start);
  }
  return { ...timingOf(ms), warmups };
}

/** How far two gradients are apart: the largest difference over the largest magnitude, and the values whose bits differ. */
export function gradientDistance(a: readonly number[], b: readonly number[]): { relative: number; differ: number } {
  let scale = 0;
  let largest = 0;
  let differ = 0;
  for (let i = 0; i < a.length; i++) {
    scale = Math.max(scale, Math.abs(a[i]!), Math.abs(b[i]!));
    largest = Math.max(largest, Math.abs(a[i]! - b[i]!));
    if (!Object.is(Math.fround(a[i]!), Math.fround(b[i]!))) differ++;
  }
  return { relative: scale === 0 ? 0 : largest / scale, differ };
}
