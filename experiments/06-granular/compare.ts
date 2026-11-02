// How two renders of experiment 6 compare, apart from the harness, so that the runner holds the
// tiers to one another without importing a shader module.

/** A grain of a list, as `read()` gives it. */
export interface GrainFields {
  readonly start: number;
  readonly length: number;
  readonly inc: number;
  readonly peak: number;
}

/** How two renders of the same seed compare, value by value. */
export interface Diff {
  readonly values: number;
  /** The values whose bits differ. */
  readonly differ: number;
  /** The largest absolute difference. */
  readonly largest: number;
}

/** The values of `a` and `b` whose bits differ, and the largest difference. */
export function diff(a: Float32Array, b: Float32Array): Diff {
  const n = Math.min(a.length, b.length);
  const ua = new Uint32Array(a.buffer, a.byteOffset, n);
  const ub = new Uint32Array(b.buffer, b.byteOffset, n);
  let differ = Math.abs(a.length - b.length);
  let largest = 0;
  for (let i = 0; i < n; i++) {
    if (ua[i] !== ub[i]) {
      differ++;
      largest = Math.max(largest, Math.abs(a[i]! - b[i]!));
    }
  }
  return { values: Math.max(a.length, b.length), differ, largest };
}

/** The grains of two lists that differ in a field, compared bit for bit in `f32`. */
export function listDiff(a: readonly GrainFields[], b: readonly GrainFields[]): number {
  const f = Math.fround;
  let differ = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i]!;
    const y = b[i]!;
    const same =
      x.start === y.start &&
      x.length === y.length &&
      Object.is(f(x.inc), f(y.inc)) &&
      Object.is(f(x.peak), f(y.peak));
    if (!same) differ++;
  }
  return differ;
}

/** The elements of two logs that differ. */
export function logDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let differ = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) differ++;
  return differ;
}

/** The bytes of `values` in base 64, to carry a render out of a page. */
export function base64(values: ArrayBufferView): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

/** The `f32` values whose bytes `text` holds in base 64. */
export function fromBase64(text: string): Float32Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** The SHA-256 of `values`, in hexadecimal. */
export async function digest(values: ArrayBufferView): Promise<string> {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
