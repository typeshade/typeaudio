import { LiveDsp } from './live-dsp.ts';
import { DEFAULT, SAMPLE_RATE, type Patch } from './designer.ts';
interface ProcessorBase { readonly port:MessagePort; }
const scope=globalThis as unknown as {
  AudioWorkletProcessor:new()=>ProcessorBase;
  sampleRate:number;
  registerProcessor(name:string,constructor:new(options:{processorOptions?:{patch?:Patch;repeat?:boolean;dry?:boolean}})=>ProcessorBase):void;
};
class LiveProcessor extends scope.AudioWorkletProcessor {
  private dsp:LiveDsp;
  private running=true;
  private reported=0;
  constructor(options:{processorOptions?:{patch?:Patch;repeat?:boolean;dry?:boolean}}){
    super();
    if(scope.sampleRate!==SAMPLE_RATE)throw new Error('Live mode requires a 48 kHz audio context.');
    this.dsp=new LiveDsp(options.processorOptions?.patch||DEFAULT);
    this.dsp.repeat=options.processorOptions?.repeat??true;this.dsp.dry=options.processorOptions?.dry??false;
    this.port.onmessage=({data})=>{
      try{
        if(data.type==='patch')this.dsp.update(data.patch,data.repeat,data.dry);
        if(data.type==='retrigger')this.dsp.retrigger();
        if(data.type==='stop')this.running=false;
      }catch(error){this.port.postMessage({type:'error',message:String(error)});}
    };
    this.port.postMessage({type:'ready'});
  }
  process(_inputs:Float32Array[][],outputs:Float32Array[][]):boolean{
    if(!this.running)return false;
    const out=outputs[0]?.[0];if(!out)return true;
    try{
      this.dsp.process(out);
      if(this.dsp.frames-this.reported>=4800){
        this.reported=this.dsp.frames;
        this.port.postMessage({type:'meter',frames:this.dsp.frames,revision:this.dsp.revision});
      }
    }catch(error){out.fill(0);this.port.postMessage({type:'error',message:String(error)});this.running=false;}
    return this.running;
  }
}
scope.registerProcessor('typeaudio-live',LiveProcessor);
