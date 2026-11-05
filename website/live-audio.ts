import workletUrl from './live.worklet.ts?worker&url';
import type { Patch } from './designer.ts';
const modules=new WeakMap<AudioContext,Promise<void>>();
export class LiveAudio {
  private node:AudioWorkletNode|undefined;
  private gain:GainNode|undefined;
  private analyser:AnalyserNode|undefined;
  private closed=false;
  private context:AudioContext|undefined;
  private wave=new Float32Array(2048);
  private bins=new Float32Array(1024);
  constructor(private onError:(message:string)=>void,private onMeter:(frames:number,revision:number)=>void){}
  async start(context:AudioContext,patch:Patch,repeat:boolean,dry:boolean):Promise<void>{
    this.context=context;
    if(!context.audioWorklet)throw new Error('AudioWorklet is unavailable. Use Render mode in this browser.');
    let loaded=modules.get(context);
    if(!loaded){loaded=context.audioWorklet.addModule(workletUrl);modules.set(context,loaded);loaded.catch(()=>modules.delete(context));}
    await loaded;if(this.closed)throw new Error('Live start cancelled.');
    const node=new AudioWorkletNode(context,'typeaudio-live',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{patch,repeat,dry}});
    this.node=node;
    node.onprocessorerror=()=>this.onError('The live audio processor stopped. Restart Live or reduce the voice count.');
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('The live audio processor did not become ready.')),8000);
      node.port.onmessage=({data})=>{
        if(data.type==='ready'){clearTimeout(timer);resolve();}
        if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));this.onError(data.message);}
        if(data.type==='meter')this.onMeter(data.frames,data.revision);
      };
    });
    if(this.closed){node.port.postMessage({type:'stop'});node.port.close();throw new Error('Live start cancelled.');}
    this.gain=context.createGain();this.gain.gain.setValueAtTime(0,context.currentTime);this.gain.gain.linearRampToValueAtTime(1,context.currentTime+0.02);
    this.analyser=context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=0.65;
    node.connect(this.gain).connect(this.analyser).connect(context.destination);
  }
  update(patch:Patch,repeat:boolean,dry:boolean):void{this.node?.port.postMessage({type:'patch',patch,repeat,dry});}
  retrigger():void{this.node?.port.postMessage({type:'retrigger'});}
  trace():{wave:Float32Array;bins:Float32Array}|undefined{
    if(!this.analyser||this.closed)return;
    this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getFloatFrequencyData(this.bins);return{wave:this.wave,bins:this.bins};
  }
  stop():void{
    if(this.closed)return;this.closed=true;
    const node=this.node,gain=this.gain,analyser=this.analyser,ctx=this.context;
    if(gain&&ctx){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,0.004);}
    setTimeout(()=>{node?.port.postMessage({type:'stop'});node?.disconnect();node?.port.close();gain?.disconnect();analyser?.disconnect();},25);
  }
}
