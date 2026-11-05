import { describe, it, expect } from 'vitest';
import { createDevice } from 'typeshade/runtime';
import { DEFAULT, PRESETS, validatePatch, envelopeAt, delayPcm, reverbPcm, finishPcm, spectrum } from './designer.ts';
import { renderPatch } from './designer-render.ts';

describe('sound designer DSP', () => {
  it('validates every preset and rejects unsafe imported values', () => {
    Object.values(PRESETS).forEach(p => expect(validatePatch(p.patch)).toEqual(p.patch));
    for (const patch of [{...DEFAULT,feedback:1},{...DEFAULT,voices:2.5},{...DEFAULT,cutoff:NaN},{...DEFAULT,shapeA:8},{...DEFAULT,reverb:'yes'}]) expect(()=>validatePatch(patch)).toThrow();
  });
  it('releases from the current attack level when a note ends early', () => {
    const p={...DEFAULT,attack:1,duration:0.5,release:0.5};
    expect(envelopeAt(0,p)).toBe(0);expect(envelopeAt(0.5,p)).toBe(0.5);
    expect(envelopeAt(0.75,p)).toBe(0.25);expect(envelopeAt(1,p)).toBe(0);
  });
  it('places feedback echoes at the selected delay interval', () => {
    const input=new Float32Array(100);input[0]=1;
    const p={...DEFAULT,delayTime:0.1,feedback:0.5,delayMix:0.5};
    const out=delayPcm(input,p,1000);
    expect(out[0]).toBe(0.5);expect(out[99]).toBe(0);expect(out[100]).toBe(0.5);
    expect(out[200]).toBe(0.25);expect(out[300]).toBe(0.125);
  });
  it('produces a finite room tail and an aligned dry/wet comparison', () => {
    const input=new Float32Array(1000);input[0]=0.5;
    const p={...DEFAULT,delay:true,reverb:true};
    const room=reverbPcm(input,p,1000);
    expect(room.slice(100).some(x=>Math.abs(x)>1e-6)).toBe(true);
    expect(room.every(Number.isFinite)).toBe(true);
    const {dry,wet}=finishPcm(input,p,1000);
    expect(dry.length).toBe(wet.length);expect(wet[wet.length-1]).toBe(0);
    expect(dry.slice(input.length).every(x=>x===0)).toBe(true);
    expect(wet).not.toEqual(dry);
  });
  it('finds a sine frequency in the spectrum', () => {
    const bin=32;const input=Float32Array.from({length:4096},(_,i)=>0.25*Math.sin(2*Math.PI*bin*i/2048));
    const bins=spectrum(input);const peak=bins.reduce((best,x,i)=>x>bins[best]!?i:best,0);
    expect(peak).toBe(bin);expect(bins[peak]).toBeCloseTo(20*Math.log10(0.25),1);
  });
});

describe('actual TypeAudio designer voice', () => {
  it('renders different oscillators and responds to the filter and blend', async () => {
    const dev=await createDevice({prefer:['cpu']});
    try{
      const base={...DEFAULT,duration:0.5,release:0.02,voices:1,filter:false,distortion:false,blend:0};
      const results=[];
      for(const shapeA of [0,1,2,3]){
        const {samples}=await renderPatch(dev,{...base,shapeA});
        expect(samples.every(Number.isFinite)).toBe(true);
        expect(samples.some(x=>Math.abs(x)>0.1)).toBe(true);results.push(samples);
      }
      for(let i=1;i<results.length;i++)expect(results[i]).not.toEqual(results[0]);
      const filtered=await renderPatch(dev,{...base,shapeA:1,filter:true,cutoff:100});
      const rms=(a:Float32Array):number=>Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);
      expect(rms(filtered.samples)).toBeLessThan(rms(results[1]!)*0.5);
      const blended=await renderPatch(dev,{...base,shapeA:1,shapeB:0,blend:1});
      expect(blended.samples).not.toEqual(results[1]);
    }finally{await dev.dispose();}
  });
});
