"use typeshade";
import { DesignerVoice } from "./designer.shade.ts";

/** A synchronous CPU block: one host call per block, never one per sample. */
export class LiveVoice extends DesignerVoice {
  filterBlend: f32 = 1.;
  repeat: u32 = 0;

  configure(hzA: f32, hzB: f32, shapeA: u32, shapeB: u32, blend: f32,
    cutoff: f32, resonance: f32, filterBlend: f32, attack: f32, decay: f32,
    sustain: f32, release: f32, gate: f32, repeat: u32): void {
    this.a.sine.hz(hzA, 48000.); this.a.saw.hz(hzA, 48000.);
    this.b.sine.hz(hzB, 48000.); this.b.saw.hz(hzB, 48000.);
    this.a.shape = shapeA; this.b.shape = shapeB;
    this.blend = blend; this.filter.set(cutoff, resonance, 48000.);
    this.filterBlend = filterBlend; this.attack = attack; this.decay = decay;
    this.sustain = sustain; this.release = release; this.gate = gate; this.repeat = repeat;
  }
  retrigger(): void { this.age = 0; }
  block(frames: u32): array<f32, 128> {
    let out = array<f32, 128>();
    for (let i: u32 = 0; i < frames; i++) {
      if (this.repeat == 1 && f32(this.age) >= (this.gate + this.release) * 48000.) { this.age = 0; }
      const time = f32(this.age) / 48000.; this.age++;
      const a = this.a.tick(); const b = this.b.tick();
      const mixed = a * (1. - this.blend) + b * this.blend;
      const filtered = this.filter.tick(mixed);
      let env: f32 = this.held(time);
      if (this.repeat == 1 && time >= this.gate) {
        env = this.held(this.gate) * max(0., 1. - (time - this.gate) / this.release);
      }
      out[i] = (mixed * (1. - this.filterBlend) + filtered * this.filterBlend) * env;
    }
    return out;
  }
}
