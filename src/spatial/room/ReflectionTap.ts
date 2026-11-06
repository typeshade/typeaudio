/** Fractional delay with queued crossfades, smoothed gain and a material lowpass. */
export class ReflectionTap {
  left = 0;
  right = 0;
  private pole = 0;
  private filtered = 0;
  private targetLeft = 0;
  private targetRight = 0;
  private targetPole = 0;
  private targetDelay = 0;
  private fromDelay = 0;
  private toDelay = 0;
  private phase: number;
  constructor(private readonly smoothing: number, private readonly transitionFrames: number) {
    this.phase = transitionFrames;
  }
  set(delay: number, left: number, right: number, pole: number): void {
    this.targetDelay = delay; this.targetLeft = left; this.targetRight = right; this.targetPole = pole;
  }
  mute(): void { this.targetLeft = this.targetRight = 0; }
  reset(): void {
    this.left = this.targetLeft; this.right = this.targetRight; this.pole = this.targetPole;
    this.fromDelay = this.toDelay = this.targetDelay;
    this.phase = this.transitionFrames; this.filtered = 0;
  }
  private read(buffer: Float32Array, index: number, delay: number): number {
    let position = index - delay;
    if (position < 0) position += buffer.length;
    const at = Math.floor(position), fraction = position - at;
    const next = at + 1 === buffer.length ? 0 : at + 1;
    return buffer[at] + (buffer[next] - buffer[at]) * fraction;
  }
  tick(buffer: Float32Array, index: number): number {
    if (this.phase === this.transitionFrames && this.toDelay !== this.targetDelay) {
      this.fromDelay = this.toDelay; this.toDelay = this.targetDelay; this.phase = 0;
    }
    let value = this.read(buffer, index, this.toDelay);
    if (this.phase < this.transitionFrames) {
      const fraction = ++this.phase / this.transitionFrames;
      value = this.read(buffer, index, this.fromDelay) * (1 - fraction) + value * fraction;
    }
    this.left += (this.targetLeft - this.left) * this.smoothing;
    this.right += (this.targetRight - this.right) * this.smoothing;
    this.pole += (this.targetPole - this.pole) * this.smoothing;
    this.filtered += (value - this.filtered) * (1 - this.pole);
    if (Math.abs(this.filtered) < 1e-30) this.filtered = 0;
    return this.filtered;
  }
}
