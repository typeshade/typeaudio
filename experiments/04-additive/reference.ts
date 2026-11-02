// The plain-JavaScript reference of experiment 4: the partial of `additive.shade.ts` and the three
// sums, each operation rounded to an `f32` with `Math.fround`, as the CPU tier computes (compiler
// Rule 11.7). It builds on the units' reference of the tests (`test/reference.ts`) and imports
// nothing of TypeShade.

import { RefEnvelope, RefLowpass, refSine } from '../../test/reference.ts';
import { design64, sweptCutoff } from './design.ts';
import { MASTER, type PartialSpec, type Variant } from './options.ts';

const f = Math.fround;

/**
 * Where a partial's filter gets the coefficients of a new cutoff: `f32`, designed as `Lowpass`
 * designs them (the `gather`, `tree` and `scatter` variants), or `f64`, designed in doubles from
 * the `f32` angle (the `host` and `f64` variants, `design.ts`).
 */
export type Design = 'f32' | 'f64';

/** The design a variant's partials use. */
export const designOf = (variant: Variant): Design => (variant === 'host' || variant === 'f64' ? 'f64' : 'f32');

export class RefPartial {
  readonly osc = refSine();
  readonly env = new RefEnvelope();
  readonly filter = new RefLowpass();
  readonly level: number;
  readonly cutoff: number;
  readonly q: number;
  readonly sr: number;
  constructor(
    s: PartialSpec,
    sr: number,
    readonly mode: Design = 'f32',
  ) {
    this.osc.hz(s.f, sr);
    this.env.times(s.attack, s.decay, s.sustain, sr);
    this.level = f(s.level);
    this.cutoff = f(s.cutoff);
    this.q = f(s.q);
    this.sr = f(sr);
    this.filter.set(s.cutoff, s.q, sr);
  }
  retune(sweep: number): void {
    const cutoff = sweptCutoff(this.cutoff, sweep, this.sr);
    if (this.mode === 'f32') {
      this.filter.set(cutoff, this.q, this.sr);
      return;
    }
    const [b0, b1, b2, a1, a2] = design64(cutoff, this.q, this.sr);
    Object.assign(this.filter, { b0, b1, b2, a1, a2 });
  }
  tick(): number {
    const x = this.filter.tick(this.osc.tick());
    return f(f(x * this.env.tick()) * this.level);
  }
}

/** The tree order of a reduction (Rule 7.2): blocks of 256, each folded at strides 128 to 1, then the partials the same way. */
export function treeSum(values: ArrayLike<number>): number {
  let level: number[] = Array.from(values);
  if (level.length === 0) return -0;
  do {
    const next: number[] = [];
    for (let b = 0; b < level.length; b += 256) {
      const slot = Array.from({ length: 256 }, (_, t) => (b + t < level.length ? level[b + t]! : -0));
      for (let s = 128; s > 0; s >>= 1) for (let t = 0; t < s; t++) slot[t] = f(slot[t]! + slot[t + s]!);
      next.push(slot[0]!);
    }
    level = next;
  } while (level.length > 1);
  return level[0]!;
}

/**
 * Renders `blocks` blocks of `frames` frames of the bank `specs` and resolves to them, one render of
 * each variant in `variants`, after the gain and in order: the block `b` retunes every partial to
 * `sweepAt(b)` first. The partials of each design that a variant needs tick once per block, and
 * each variant sums the lanes of its design in its own order. `progress` sees each block when it is
 * done. It returns the partials of each design too, as they are after the last block.
 */
export function refRender(
  specs: readonly PartialSpec[],
  sr: number,
  frames: number,
  blocks: number,
  sweepAt: (b: number) => number,
  variants: readonly Variant[],
  progress: (b: number) => void = () => {},
): { out: Record<Variant, Float32Array>; partials: Partial<Record<Design, RefPartial[]>> } {
  const out = {} as Record<Variant, Float32Array>;
  for (const v of variants) out[v] = new Float32Array(frames * blocks);
  const designs = [...new Set(variants.map(designOf))];
  const partials: Partial<Record<Design, RefPartial[]>> = {};
  const lanes: Partial<Record<Design, Float32Array[]>> = {};
  for (const d of designs) {
    partials[d] = specs.map((s) => new RefPartial(s, sr, d));
    lanes[d] = specs.map(() => new Float32Array(frames));
  }
  const column = new Float32Array(specs.length);
  const gain = f(MASTER);
  for (let b = 0; b < blocks; b++) {
    const sweep = sweepAt(b);
    for (const d of designs) {
      partials[d]!.forEach((p, v) => {
        p.retune(sweep);
        const lane = lanes[d]![v]!;
        for (let n = 0; n < frames; n++) lane[n] = p.tick();
      });
    }
    for (const variant of variants) {
      const ls = lanes[designOf(variant)]!;
      const into = out[variant];
      for (let n = 0; n < frames; n++) {
        let s: number;
        if (variant === 'tree' || variant === 'scatter') {
          for (let v = 0; v < ls.length; v++) column[v] = ls[v]![n]!;
          // `let s = 0.` then the loop's fold: the variable is combined with the tree's result.
          s = f(f(0) + treeSum(column));
        } else {
          s = 0;
          for (const lane of ls) s = f(s + lane[n]!);
        }
        into[b * frames + n] = f(s * gain);
      }
    }
    progress(b);
  }
  return { out, partials };
}

/** The state of a partial as the bank holds it: the fields of `Partial`, flat, in a fixed order. */
export function refState(p: RefPartial): number[] {
  return [
    p.osc.phase,
    p.osc.inc,
    p.env.rise,
    p.env.fall,
    p.filter.b0,
    p.filter.b1,
    p.filter.b2,
    p.filter.a1,
    p.filter.a2,
    p.filter.z1,
    p.filter.z2,
  ];
}

/** The plain-JavaScript sums of one block of `lanes`: one after another (`gather`), and in the tree order (`tree`, `scatter`). */
export function refSums(lanes: Float32Array, count: number, frames: number): { gather: Float32Array; tree: Float32Array } {
  const gather = new Float32Array(frames);
  const tree = new Float32Array(frames);
  const column = new Float32Array(count);
  for (let n = 0; n < frames; n++) {
    let s = 0;
    for (let v = 0; v < count; v++) {
      s = f(s + lanes[v * frames + n]!);
      column[v] = lanes[v * frames + n]!;
    }
    gather[n] = s;
    tree[n] = f(f(0) + treeSum(column));
  }
  return { gather, tree };
}
