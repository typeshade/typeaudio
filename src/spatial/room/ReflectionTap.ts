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
  private targetOffset = 0;
  private targetFraction = 0;
  private fromOffset = 0;
  private fromFraction = 0;
  private toOffset = 0;
  private toFraction = 0;
  private phase: number;
  constructor(private readonly smoothing: number, private readonly transitionFrames: number) {
    this.phase = transitionFrames;
  }
  set(delay: number, left: number, right: number, pole: number): void {
    this.targetDelay = delay; this.targetLeft = left; this.targetRight = right; this.targetPole = pole;
    // The delay stays fixed during each crossfade. Split its address once per control update.
    this.targetOffset = Math.ceil(delay); this.targetFraction = this.targetOffset - delay;
  }
  mute(): void { this.targetLeft = this.targetRight = 0; }
  reset(): void {
    this.left = this.targetLeft; this.right = this.targetRight; this.pole = this.targetPole;
    this.fromDelay = this.toDelay = this.targetDelay;
    this.fromOffset = this.toOffset = this.targetOffset;
    this.fromFraction = this.toFraction = this.targetFraction;
    this.phase = this.transitionFrames; this.filtered = 0;
  }
  private read(buffer: Float32Array, index: number, offset: number, fraction: number): number {
    let at = index - offset;
    if (at < 0) at += buffer.length;
    const next = at + 1 === buffer.length ? 0 : at + 1;
    return buffer[at] + (buffer[next] - buffer[at]) * fraction;
  }
  tick(buffer: Float32Array, index: number): number {
    if (this.phase === this.transitionFrames && this.toDelay !== this.targetDelay) {
      this.fromDelay = this.toDelay; this.toDelay = this.targetDelay; this.phase = 0;
      this.fromOffset = this.toOffset; this.fromFraction = this.toFraction;
      this.toOffset = this.targetOffset; this.toFraction = this.targetFraction;
    }
    let value = this.read(buffer, index, this.toOffset, this.toFraction);
    if (this.phase < this.transitionFrames) {
      const fraction = ++this.phase / this.transitionFrames;
      value = this.read(buffer, index, this.fromOffset, this.fromFraction) * (1 - fraction) + value * fraction;
    }
    this.left += (this.targetLeft - this.left) * this.smoothing;
    this.right += (this.targetRight - this.right) * this.smoothing;
    this.pole += (this.targetPole - this.pole) * this.smoothing;
    this.filtered += (value - this.filtered) * (1 - this.pole);
    if (Math.abs(this.filtered) < 1e-30) this.filtered = 0;
    return this.filtered;
  }
}
