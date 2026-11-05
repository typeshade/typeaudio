import type { Device, FuseReport } from 'typeshade/runtime';
import { bank, mixdown, gain, drive } from '../src/index.ts';
import { DesignerVoice, designerSynth } from './designer.shade.ts';
import { SAMPLE_RATE, type Patch } from './designer.ts';
export async function renderPatch(dev: Device, p: Patch): Promise<{ samples: Float32Array; reports: FuseReport[] }> {
  const instances = Array.from({ length: p.voices }, (_, i) => {
    const cents = p.voices === 1 ? 0 : (i / (p.voices - 1) - 0.5) * p.spread;
    const a = p.frequency * 2 ** (cents / 1200);
    const b = a * 2 ** (p.transpose / 12 + p.detune / 1200);
    return new DesignerVoice(a,b,p.shapeA,p.shapeB,i * 0.11,p.blend,p.cutoff,p.resonance,
      p.filter ? 1 : 0,p.attack,p.decay,p.sustain,p.release,p.duration);
  });
  const voices = bank(dev, instances);
  const frames = Math.ceil((p.duration + p.release) * SAMPLE_RATE);
  const samples = new Float32Array(frames);
  const master = dev.array(1024, 'f32');
  const reports: FuseReport[] = [];
  try {
    for (let at = 0; at < frames; at += 1024) {
      const n = Math.min(1024, frames - at);
      const report = await dev.fuse(scope => {
        const lanes = scope.scratch(p.voices * 1024), mixed = scope.scratch(1024);
        const averaged = scope.scratch(1024), driven = scope.scratch(1024);
        designerSynth(lanes, voices.instances, 1024);
        mixdown(mixed, lanes, p.voices, 1024);
        gain(averaged, mixed, 1 / p.voices);
        if (p.distortion) drive(driven, averaged, p.drive);
        else gain(driven, averaged, 1);
        gain(master, driven, 0.7);
      });
      samples.set((await master.read()).subarray(0,n), at);
      reports.push(report);
    }
    return { samples, reports };
  } finally { dev.release(master); dev.release(voices.instances); }
}
