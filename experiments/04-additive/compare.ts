// How close two runs of experiment 4 are: the samples with the same bits, the largest difference
// and the largest distance in units in the last place of an `f32`. It imports no shader module, so
// the runner, Node and the page all read it.

export interface Comparison {
  /** How many values were compared. */
  readonly count: number;
  /** How many have the same bits in both. */
  readonly same: number;
  /** The largest absolute difference. */
  readonly maxAbs: number;
  /** The largest distance in units in the last place of an `f32`, counted across zero. */
  readonly maxUlp: number;
  /** The index of the first value whose bits differ, or -1. */
  readonly firstDiff: number;
  /** The largest magnitude in the reference, the scale of `maxAbs`. */
  readonly refMax: number;
}

/** Compares `a` with the reference `ref`, value by value. */
export function compare(a: Float32Array, ref: Float32Array): Comparison {
  if (a.length !== ref.length) throw new RangeError(`compare(): ${a.length} values against ${ref.length}.`);
  const ia = new Int32Array(a.buffer, a.byteOffset, a.length);
  const ir = new Int32Array(ref.buffer, ref.byteOffset, ref.length);
  let same = 0;
  let maxAbs = 0;
  let maxUlp = 0;
  let firstDiff = -1;
  let refMax = 0;
  for (let i = 0; i < a.length; i++) {
    refMax = Math.max(refMax, Math.abs(ref[i]!));
    if (ia[i] === ir[i]) {
      same++;
      continue;
    }
    if (firstDiff < 0) firstDiff = i;
    maxAbs = Math.max(maxAbs, Math.abs(a[i]! - ref[i]!));
    maxUlp = Math.max(maxUlp, Math.abs(ordered(ia[i]!) - ordered(ir[i]!)));
  }
  return { count: a.length, same, maxAbs, maxUlp, firstDiff, refMax };
}

/** The bits of an `f32` as an integer that counts up with the value, -0 and +0 both 0. */
const ordered = (bits: number): number => (bits < 0 ? -(bits & 0x7fffffff) : bits);

/** A `Float32Array` as base64, to cross from a page to the runner. */
export function toBase64(a: Float32Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** The `Float32Array` that `toBase64` wrote. */
export function fromBase64(s: string): Float32Array {
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
