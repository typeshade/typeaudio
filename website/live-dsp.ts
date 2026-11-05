import { LiveVoice } from './live-voice.shade.ts';
import { DEFAULT, SAMPLE_RATE, validatePatch, type Patch } from './designer.ts';
const SMOOTH_KEYS = ['frequency','blend','detune','spread','cutoff','resonance','attack','decay','sustain','release','duration','drive','delayTime','feedback','delayMix','room','reverbMix','volume'] as const;
/** Stateful effects. Delay reads interpolate as their times move; buffers never reset on edits. */
class LiveEffects {
  private frame=0;
  private delay=new Float32Array(Math.ceil(SAMPLE_RATE*0.8));
  private combs=[0.0297,0.0371,0.0411,0.0437].map(t=>({seconds:t,line:new Float32Array(Math.ceil(t*SAMPLE_RATE*1.5)+2),damp:0}));
  private allpasses=[0.005,0.0017].map(t=>new Float32Array(Math.round(t*SAMPLE_RATE)));
  private read(line:Float32Array,offset:number):number{
    const pos=((this.frame-offset)%line.length+line.length)%line.length,a=Math.floor(pos),mix=pos-a;
    return line[a]!*(1-mix)+line[(a+1)%line.length]!*mix;
  }
  tick(input:number,p:Patch,delayMix:number,reverbMix:number):number{
    const echo=this.read(this.delay,p.delayTime*SAMPLE_RATE);
    this.delay[this.frame%this.delay.length]=input+echo*p.feedback;
    const delayed=input*(1-delayMix)+echo*delayMix;
    let wet=0;
    for(const comb of this.combs){
      const tap=this.read(comb.line,Math.round(comb.seconds*SAMPLE_RATE*(0.6+p.room)));
      comb.damp=tap*0.65+comb.damp*0.35;
      comb.line[this.frame%comb.line.length]=delayed+comb.damp*(0.55+p.room*0.35);
      wet+=tap*0.25;
    }
    for(const line of this.allpasses){const at=this.frame%line.length,tap=line[at]!;const next=tap-wet*0.5;line[at]=wet+tap*0.5;wet=next;}
    this.frame++;
    return delayed*(1-reverbMix)+wet*reverbMix;
  }
}
/** All output is filled before this synchronous process call returns. */
export class LiveDsp {
  private target:Patch;
  private current:Patch;
  private voices:LiveVoice[];
  private weights=new Float32Array(8);
  private effects=new LiveEffects();
  private scratch=new Float32Array(128);
  private filterBlend:number;
  private distortionBlend:number;
  private delayBlend:number;
  private reverbBlend:number;
  private monitorBlend=1;
  repeat=true;
  dry=false;
  frames=0;
  revision=0;
  constructor(patch:Patch=DEFAULT){
    this.target=validatePatch(patch);this.current={...this.target};
    this.filterBlend=patch.filter?1:0;this.distortionBlend=patch.distortion?1:0;
    this.delayBlend=patch.delay?patch.delayMix:0;this.reverbBlend=patch.reverb?patch.reverbMix:0;
    this.voices=Array.from({length:8},(_,i)=>new LiveVoice(patch.frequency,patch.frequency,patch.shapeA,patch.shapeB,i*0.11,patch.blend,patch.cutoff,patch.resonance,1,patch.attack,patch.decay,patch.sustain,patch.release,patch.duration));
    for(let i=0;i<patch.voices;i++)this.weights[i]=1;
  }
  update(patch:Patch,repeat=this.repeat,dry=this.dry):void{this.target=validatePatch(patch);this.repeat=repeat;this.dry=dry;this.revision++;}
  retrigger():void{for(const voice of this.voices)voice.retrigger();}
  process(out:Float32Array):void{
    for(let offset=0;offset<out.length;offset+=128){
      const count=Math.min(128,out.length-offset),smooth=1-Math.exp(-count/(SAMPLE_RATE*0.012));
      const p=this.current,t=this.target;
      for(const key of SMOOTH_KEYS)p[key]+=(t[key]-p[key])*smooth;
      p.shapeA=t.shapeA;p.shapeB=t.shapeB;p.transpose=t.transpose;p.voices=t.voices;
      this.filterBlend+=((t.filter?1:0)-this.filterBlend)*smooth;
      this.distortionBlend+=((t.distortion?1:0)-this.distortionBlend)*smooth;
      this.delayBlend+=((t.delay?p.delayMix:0)-this.delayBlend)*smooth;
      this.reverbBlend+=((t.reverb?p.reverbMix:0)-this.reverbBlend)*smooth;
      this.monitorBlend+=((this.dry?0:1)-this.monitorBlend)*smooth;
      this.scratch.fill(0);let weightSum=0;
      for(let i=0;i<8;i++){
        this.weights[i]!+=((i<t.voices?1:0)-this.weights[i]!)*smooth;
        const weight=this.weights[i]!;if(weight<0.00001)continue;
        weightSum+=weight;
        const cents=t.voices===1?0:(i/(t.voices-1)-0.5)*p.spread;
        const a=p.frequency*2**(cents/1200),b=a*2**(p.transpose/12+p.detune/1200);
        const voice=this.voices[i]!;
        voice.configure(a,b,p.shapeA,p.shapeB,p.blend,p.cutoff,p.resonance,this.filterBlend,p.attack,p.decay,p.sustain,p.release,p.duration,this.repeat?1:0);
        const samples=voice.block(count);
        for(let n=0;n<count;n++)this.scratch[n]!+=samples[n]!*weight;
      }
      for(let n=0;n<count;n++){
        const mixed=this.scratch[n]!/Math.max(1e-6,weightSum);
        const driven=(mixed*(1-this.distortionBlend)+Math.tanh(mixed*p.drive)*this.distortionBlend)*0.7;
        const wet=this.effects.tick(driven,p,this.delayBlend,this.reverbBlend);
        const value=(driven*(1-this.monitorBlend)+wet*this.monitorBlend)*p.volume;
        if(!Number.isFinite(value))throw new Error('Live DSP produced a non-finite sample. Reset the patch and restart.');
        out[offset+n]=value;
      }
      this.frames+=count;
    }
  }
}
