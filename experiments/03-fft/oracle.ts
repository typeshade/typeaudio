// Experiment 3 on the compiler's oracle. `dispatch` of `compileModuleJs` at `f32` precision runs
// an entry that reaches a barrier in the passes the WebGL2 tier runs (compiler surface §25): the
// answer change 0092 will give the host's CPU tier, which at the pin refuses such an entry. The
// oracle needs the compiler's front end, `compile()`, so it runs where the compiler loads: on Bun,
// which loads the pinned tarball's TypeScript (docs/compiler-asks.md, Q).

import { compile, compileModuleJs, type CpuValue, type DeterminismEntry } from 'typeshade';
import { transformOf, type Direction, type EntryName } from './signals.ts';

/** An `f32` array of complex points as the oracle holds an `array<vec2>`: one pair for each point. */
const pairs = (xs: Float32Array): number[][] =>
  Array.from({ length: xs.length / 2 }, (_, i) => [xs[2 * i]!, xs[2 * i + 1]!]);

export interface Oracle {
  /** The rows of `compile().determinism` for the module. */
  readonly determinism: readonly DeterminismEntry[];
  /**
   * Runs `entry` over `workgroups` transforms of `n` points of `src` in `direction`, and returns
   * its output as `f32`s. `twiddles` is variant B's table; variant A's entries do not read it.
   */
  run(
    entry: EntryName,
    direction: Direction,
    n: number,
    workgroups: number,
    src: Float32Array,
    twiddles: Float32Array,
  ): Float32Array;
}

/** The oracle of the module `source`, compiled once. */
export function oracleOf(source: string): Oracle {
  const compiled = compile(source);
  const errors = compiled.diagnostics.filter((d) => d.category === 'error');
  if (errors.length > 0) {
    throw new Error(`fft.shade.ts does not compile: ${errors.map((d) => d.message).join('; ')}`);
  }
  const cpu = compileModuleJs(compiled.module, { precision: 'f32' });
  const bind = (name: string, value: unknown): void => cpu.setBinding(name, value as CpuValue);
  return {
    determinism: compiled.determinism,
    run(entry, direction, n, workgroups, src, twiddles) {
      const { sign, scale } = transformOf(direction, n);
      const dst = pairs(new Float32Array(src.length));
      bind('transform', { sign: Math.fround(sign), scale: Math.fround(scale) });
      bind('src', pairs(src));
      bind('dst', dst);
      bind('twiddles', pairs(twiddles));
      cpu.dispatch(entry, workgroups);
      return Float32Array.from(dst.flat());
    },
  };
}
