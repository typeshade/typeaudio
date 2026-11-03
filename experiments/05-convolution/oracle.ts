// Experiment 5 on the compiler's oracle: the partitioned convolution of `harness.ts`, block by
// block, with each call run where the oracle runs it. `dispatch` of `compileModuleJs` at `f32`
// precision runs the FFT entry, which reaches a barrier, in the passes the WebGL2 tier runs
// (compiler surface §25): the answer change 0092 will give the host's CPU tier, which at the pin
// refuses the entry. The kernel functions run as written, through `fns` (surface §25, "A kernel
// with no barrier may still be run one invocation at a time through `fns`"), which is the CPU tier
// of Rule 11.7. The oracle needs the compiler's front end, `compile()`, so it runs where the
// compiler loads: on Bun, which loads the pinned tarball's TypeScript (docs/compiler-asks.md, Q).

import { compile, compileModuleJs, type CpuModule, type CpuValue, type DeterminismEntry } from 'typeshade';
import { FORWARD, FRAMES, INVERSE, PARTITIONS, POINTS } from './signals.ts';

/** An `f32` array of complex points as the oracle holds an `array<vec2>`: one pair for each point. */
const pairs = (xs: ArrayLike<number>): number[][] =>
  Array.from({ length: xs.length / 2 }, (_, i) => [xs[2 * i]!, xs[2 * i + 1]!]);
const zeros = (n: number): number[][] => Array.from({ length: n }, () => [0, 0]);

/** The module `source` compiled for the oracle at `f32` precision, and its determinism rows. */
function oracleModule(name: string, source: string): { cpu: CpuModule; determinism: readonly DeterminismEntry[] } {
  const compiled = compile(source);
  const errors = compiled.diagnostics.filter((d) => d.category === 'error');
  if (errors.length > 0) {
    throw new Error(`${name} does not compile: ${errors.map((d) => d.message).join('; ')}`);
  }
  return { cpu: compileModuleJs(compiled.module, { precision: 'f32' }), determinism: compiled.determinism };
}

export interface Oracle {
  /** The rows of `compile().determinism` of the two modules. */
  readonly determinism: { readonly fft: readonly DeterminismEntry[]; readonly convolution: readonly DeterminismEntry[] };
  /** Transforms the padded partitions with the FFT entry, one workgroup each, and keeps their spectra. */
  prepare(padded: Float32Array, twiddles: Float32Array): Float32Array;
  /** Zeros the delay line and the overlap-add's tail. */
  reset(): void;
  /** Runs block `k` of input `x` and returns its output. */
  block(k: number, x: Float32Array): Float32Array;
  /** The kernel functions, for the kernel check: called by name with the oracle's values. */
  call(name: string, ...args: unknown[]): void;
}

/** The oracle of the FFT module `fftSource` and the convolution module `convolutionSource`. */
export function oracleOf(fftSource: string, convolutionSource: string): Oracle {
  const fft = oracleModule('fft.shade.ts', fftSource);
  const conv = oracleModule('convolution.shade.ts', convolutionSource);
  const bind = (name: string, value: unknown): void => fft.cpu.setBinding(name, value as CpuValue);
  const kernel = (name: string, ...args: unknown[]): void => {
    conv.cpu.fns[name]!(...(args as CpuValue[]));
  };
  let spectra: number[][] = [];
  let twiddlePairs: number[][] = [];
  let line = zeros(PARTITIONS * POINTS);
  let tail: number[] = new Array<number>(FRAMES).fill(0);
  /** One call of the FFT entry over `workgroups` transforms of `src`, into a new array. */
  const transform = (direction: typeof FORWARD | typeof INVERSE, src: number[][], workgroups: number): number[][] => {
    const dst = zeros(workgroups * POINTS);
    bind('transform', { sign: Math.fround(direction.sign), scale: Math.fround(direction.scale) });
    bind('src', src);
    bind('dst', dst);
    bind('twiddles', twiddlePairs);
    fft.cpu.dispatch('fftMediumTable', workgroups);
    return dst;
  };
  return {
    determinism: { fft: fft.determinism, convolution: conv.determinism },
    prepare(padded, twiddles) {
      twiddlePairs = pairs(twiddles);
      spectra = transform(FORWARD, pairs(padded), PARTITIONS);
      return Float32Array.from(spectra.flat());
    },
    reset() {
      line = zeros(PARTITIONS * POINTS);
      tail = new Array<number>(FRAMES).fill(0);
    },
    block(k, x) {
      const slot = k % PARTITIONS;
      const padded = zeros(POINTS);
      kernel('pad', padded, Array.from(x));
      const spectrum = transform(FORWARD, padded, 1);
      kernel('store', line, spectrum, slot);
      const sum = zeros(POINTS);
      kernel('accumulate', sum, line, spectra, slot, PARTITIONS);
      const frames = transform(INVERSE, sum, 1);
      const out = new Array<number>(FRAMES).fill(0);
      kernel('overlapAdd', out, tail, frames);
      return Float32Array.from(out);
    },
    call: kernel,
  };
}

export { pairs };
