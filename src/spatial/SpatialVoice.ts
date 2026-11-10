/** Fixed per-source state. No geometry, allocations or transcendental functions in mix(). */
export class SpatialVoice {
  left = 0;
  right = 0;
  pole = 0;
  targetLeft = 0;
  targetRight = 0;
  targetPole = 0;
  filtered = 0;
  invalidSamples = 0;
  prepared = false;
  constructor(private readonly smoothing: number) {}
  reset(): void {
    this.left = this.targetLeft;
    this.right = this.targetRight;
    this.pole = this.targetPole;
    this.filtered = 0;
    this.invalidSamples = 0;
  }
  mix(input: Float32Array | null | undefined, left: Float32Array, right: Float32Array, frames: number): void {
    if (this.targetLeft === 0 && this.targetRight === 0 && this.left === 0 && this.right === 0) return;
    let l = this.left, r = this.right, pole = this.pole, z = this.filtered;
    for (let i = 0; i < frames; i++) {
      let x = input ? input[i] : 0;
      if (!Number.isFinite(x)) { x = 0; this.invalidSamples++; }
      l += (this.targetLeft - l) * this.smoothing;
      r += (this.targetRight - r) * this.smoothing;
      pole += (this.targetPole - pole) * this.smoothing;
      z += (x - z) * (1 - pole);
      left[i] += z * l;
      right[i] += z * r;
    }
    this.left = l; this.right = r; this.pole = pole; this.filtered = z;
  }
}
