/** Compare only processed frames, including offset views of the same buffer. */
export function buffersOverlap(a: Float32Array, b: Float32Array, frames: number): boolean {
  return a.buffer === b.buffer && a.byteOffset < b.byteOffset + frames * 4 && b.byteOffset < a.byteOffset + frames * 4;
}
