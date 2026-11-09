/**
 * The correlation of a stereo pair at zero lag, from -1 to 1: 1 for identical channels, 0 for
 * independent ones, -1 for inverted ones. A silent channel reads 0.
 */
export function channelCorrelation(left: Float32Array, right: Float32Array): number {
  const n = Math.min(left.length, right.length);
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let i = 0; i < n; i++) {
    lr += left[i]! * right[i]!;
    ll += left[i]! * left[i]!;
    rr += right[i]! * right[i]!;
  }
  const d = Math.sqrt(ll * rr);
  return d > 0 ? lr / d : 0;
}
