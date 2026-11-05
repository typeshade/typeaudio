import './style.css';
import { LiveAudio } from './live-audio.ts';
import { wav } from './audio.ts';
import { DEFAULT, PRESETS, SAMPLE_RATE, envelopeAt, spectrum, validatePatch, type Patch } from './designer.ts';
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const field = (id: string): HTMLInputElement => el<HTMLInputElement>(id);
const button = (id: string): HTMLButtonElement => el<HTMLButtonElement>(id);
const status = (message: string, error = false): void => { el('status').textContent = message; el('status').classList.toggle('error',error); };
const STORE = 'typeaudio.designer.saved.v1';
let patch = { ...DEFAULT }, history: Patch[] = [{ ...DEFAULT }];
let clip: { dry: Float32Array; wet: Float32Array } | undefined;
let monitor: 'dry' | 'wet' = 'wet', view: 'wave' | 'spectrum' = 'wave';
let worker: Worker | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
let context: AudioContext | undefined, source: AudioBufferSourceNode | undefined;
let playbackId = 0, renderId = 0, playing = false, dirty = true;
let renderedName = 'typeaudio';
let mode: 'live' | 'render' = 'live';
let live: LiveAudio | undefined;
let liveStarting = false, liveGeneration = 0, animation = 0;
function stopLive(): void {
  liveGeneration++; live?.stop(); live = undefined; liveStarting = false; cancelAnimationFrame(animation);
  button('live-start').disabled = false; button('live-stop').disabled = true; button('live-retrigger').disabled = true;
  el('live-indicator').textContent = 'CPU · AudioWorklet'; refreshTransport();
}
function liveDraw(): void {
  const trace=live?.trace();if(!trace)return;
  const canvas=el<HTMLCanvasElement>('waveform'),g=canvas.getContext('2d')!;
  g.clearRect(0,0,canvas.width,canvas.height);g.strokeStyle='#75e3bd';g.lineWidth=1.5;g.beginPath();
  if(view==='wave'){
    for(let x=0;x<canvas.width;x++){const value=trace.wave[Math.floor(x/canvas.width*trace.wave.length)]!;const y=130-value*120;if(x)g.lineTo(x,y);else g.moveTo(x,y);}
    el('axis-start').textContent='0 ms';el('axis-end').textContent='43 ms';el('axis-caption').textContent='LIVE AMPLITUDE';
  }else{
    for(let x=0;x<canvas.width;x++){const hz=30*(16000/30)**(x/canvas.width),bin=Math.min(trace.bins.length-1,Math.round(hz/SAMPLE_RATE*2048));const y=250-Math.max(0,Math.min(1,(trace.bins[bin]!+90)/90))*235;if(x)g.lineTo(x,y);else g.moveTo(x,y);}
    el('axis-start').textContent='30 Hz';el('axis-end').textContent='16 kHz';el('axis-caption').textContent='LIVE SPECTRUM';
  }
  g.stroke();el('metric-peak').textContent=trace.wave.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0).toFixed(3);
  animation=requestAnimationFrame(liveDraw);
}
async function startLive(): Promise<void> {
  stopLive();stopWorker();stopPlayback();clearTimeout(debounce);field('auto-preview').checked=false;
  const generation=++liveGeneration;liveStarting=true;
  button('live-start').disabled=true;button('live-stop').disabled=false;
  status('Starting live audio…');
  const session=new LiveAudio(message=>{
    if(generation!==liveGeneration)return;stopLive();status(message,true);
  },(frames,revision)=>{
    if(generation!==liveGeneration)return;
    el('clip-label').textContent=`LIVE · ${(frames/SAMPLE_RATE).toFixed(1)} s`;
    el('live-indicator').dataset.frames=String(frames);el('live-indicator').dataset.revision=String(revision);
  });live=session;
  try{
    const ctx=await audioContext();if(generation!==liveGeneration)return;
    await session.start(ctx,patch,field('live-repeat').checked,monitor==='dry');
    if(generation!==liveGeneration){session.stop();return;}
    liveStarting=false;session.update(patch,field('live-repeat').checked,monitor==='dry');
    button('live-retrigger').disabled=false;el('live-indicator').textContent='LIVE · CPU · 48 kHz';
    el('metric-backend').textContent='CPU live';el('metric-time').textContent='Continuous';el('timing-label').textContent='Mode';
    el('empty-wave').style.display='none';
    el('report').textContent=`Continuous CPU AudioWorklet processing.
TypeAudio oscillator and filter units run in synchronous blocks.
Delay and reverb preserve their state between blocks.
No offline render or GPU round trip fills the audio callback.`;
    el('edit-status').textContent='Live: move sliders to change the running sound. Retrigger restarts the envelope.';
    status('Live on CPU. Controls update the running sound.');refreshTransport();liveDraw();
  }catch(error){if(generation!==liveGeneration)return;stopLive();status(`Live audio failed: ${String(error)}. Render mode remains available.`,true);}
}
function setMode(next:'live'|'render'): void {
  clearTimeout(debounce);stopLive();stopWorker();stopPlayback();field('auto-preview').checked=false;mode=next;
  el('render-toolbar').hidden=next!=='render';el('render-transport').hidden=next!=='render';el('live-toolbar').hidden=next!=='live';
  button('mode-live').setAttribute('aria-pressed',String(next==='live'));button('mode-render').setAttribute('aria-pressed',String(next==='render'));
  el('edit-status').textContent=next==='live'?'Press Start live, then move any slider. The running sound changes without re-rendering.':'Render a finite clip on CPU or WebGPU. Auto audition re-renders after edits.';
  el('timing-label').textContent=next==='live'?'Mode':'Render';
  status(next==='live'?'Ready for continuous live sound. Press Start live.':'Render mode. Choose CPU or WebGPU and render a clip.');
  if(clip){el('clip-label').textContent=`${(clip.wet.length/SAMPLE_RATE).toFixed(2)} SEC`;draw();}else{el('clip-label').textContent='NO CLIP YET';}
  refreshTransport();
}
button('live-start').addEventListener('click',()=>void startLive());
button('live-stop').addEventListener('click',()=>{stopLive();status('Live audio stopped.');});
button('live-retrigger').addEventListener('click',()=>live?.retrigger());
field('live-repeat').addEventListener('change',()=>{live?.update(patch,field('live-repeat').checked,monitor==='dry');el('edit-status').textContent=field('live-repeat').checked?'The envelope repeats using Note hold and Release.':'The note sustains until stopped. Retrigger restarts the attack.';});
button('mode-live').addEventListener('click',()=>setMode('live'));button('mode-render').addEventListener('click',()=>setMode('render'));

interface SavedPatch { name: string; patch: Patch; }
let saved: SavedPatch[] = [];
function libraryMessage(message: string): void { el('library-status').textContent = message; }
function selectedSamples(): Float32Array | undefined { return clip?.[monitor]; }
function refreshTransport(): void {
  button('play').disabled = mode === 'live' || !clip || !!worker || playing;
  button('download').disabled = mode === 'live' || !clip || !!worker;
  button('stop').disabled = !worker && !playing && !live;
  button('render').disabled = !!worker;
}
function stopPlayback(): void {
  playbackId++;
  if (source) { source.onended = null; source.stop(); source.disconnect(); }
  source = undefined; playing = false; refreshTransport();
}
function stopWorker(): void {
  renderId++; clearTimeout(timeout); worker?.terminate(); worker = undefined; refreshTransport();
}
async function audioContext(): Promise<AudioContext> {
  if (!context || context.state === 'closed') context = new AudioContext({ sampleRate: SAMPLE_RATE });
  await context.resume(); return context;
}
async function playClip(): Promise<void> {
  const samples = selectedSamples(); if (!samples) return;
  stopPlayback(); const id = ++playbackId; playing = true; refreshTransport();
  try {
    const ctx = await audioContext(); if (id !== playbackId) return;
    const buffer = ctx.createBuffer(1,samples.length,SAMPLE_RATE); buffer.copyToChannel(new Float32Array(samples),0);
    source = ctx.createBufferSource(); source.buffer = buffer; source.loop = field('loop').checked;
    source.connect(ctx.destination);
    source.onended = () => {
      if (id !== playbackId) return;
      source?.disconnect(); source = undefined; playing = false; refreshTransport();
      status(dirty ? 'Playback finished. Render to hear your latest edits.' : 'Playback finished. Adjust a control or try another preset.');
    };
    source.start(); status(`Render complete. ${source.loop ? 'Looping' : 'Playing'} ${monitor === 'dry' ? 'before' : 'after'} delay and reverb.${dirty ? ' This is the previous render.' : ''}`);
  } catch (error) { playing = false; refreshTransport(); status(`Playback failed: ${String(error)}`,true); }
}
function displayValues(): void {
  const percents = ['blend','sustain','feedback','delayMix','reverbMix','room','volume'];
  const seconds = ['attack','decay','release','delayTime'];
  for (const key of Object.keys(DEFAULT) as (keyof Patch)[]) {
    const output = document.getElementById(`${key}-value`); if (!output) continue;
    const v = patch[key] as number;
    output.textContent = percents.includes(key) ? `${Math.round(v*100)}%` : seconds.includes(key) ? `${Math.round(v*1000)} ms` :
      ['frequency','cutoff'].includes(key) ? `${v < 1000 ? Math.round(v*10)/10 : (v/1000).toFixed(1)+'k'} Hz` :
      ['detune','spread'].includes(key) ? `${v} ct` : key === 'duration' ? `${v.toFixed(1)} s` :
      key === 'transpose' ? `${v > 0 ? '+' : ''}${v} st` : key === 'drive' ? `${v.toFixed(1)}×` : `${v}`;
  }
  document.querySelectorAll<HTMLElement>('[data-effect]').forEach(group => {
    const enabled = patch[group.dataset.effect as keyof Patch] as boolean;
    group.closest('.module')!.classList.toggle('is-bypassed', !enabled);
    group.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = !enabled; });
  });
  const total = patch.duration + patch.release;
  const points = Array.from({length:101},(_,i) => `${i*5},${70-envelopeAt(i/100*total,patch)*60}`);
  el('envelope-path').setAttribute('d',`M0,70 L${points.join(' L')} L500,70 Z`);
  button('undo').disabled = history.length <= 1;
}
function writeControls(): void {
  for (const key of Object.keys(DEFAULT) as (keyof Patch)[]) {
    const input = field(key);
    if (typeof patch[key] === 'boolean') input.checked = patch[key] as boolean;
    else input.value = String(patch[key]);
  }
  displayValues();
}
function remember(): void {
  if (JSON.stringify(history[history.length-1]) !== JSON.stringify(patch)) history.push({...patch});
  if (history.length > 40) history.shift();
  button('undo').disabled = history.length <= 1;
}
function markEdited(): void {
  dirty = true;
  if(mode==='live'){
    live?.update(patch,field('live-repeat').checked,monitor==='dry');
    el('edit-status').textContent=live?'Live parameters updated. Audio continues with its existing phase and effect tails.':'Patch changed. Press Start live to hear it continuously.';
    document.querySelectorAll('.preset-card').forEach(card=>card.setAttribute('aria-pressed','false'));
    return;
  }
  el('edit-status').textContent = field('auto-preview').checked ? 'Edits will render and play after a short pause.' : 'Patch changed. Render to hear the latest version, or turn on Auto audition.';
  document.querySelectorAll('.preset-card').forEach(card => card.setAttribute('aria-pressed','false'));
  clearTimeout(debounce);
  // Invalidate an in-flight render immediately, so an older patch cannot publish after an edit.
  if (worker) { stopWorker(); el('empty-wave').textContent = 'Patch changed. Ready to render.'; }
  else renderId++;
  if (field('auto-preview').checked) debounce = setTimeout(() => void renderSound(true),400);
}
function applyPatch(next: Patch, name?: string): void {
  patch = validatePatch(next); remember(); writeControls(); markEdited();
  if (name) field('patch-name').value = name;
  if(mode==='live')live?.retrigger();
  field('saved-patches').value = '';
}
function draw(): void {
  const canvas = el<HTMLCanvasElement>('waveform'), g = canvas.getContext('2d')!;
  g.clearRect(0,0,canvas.width,canvas.height);
  const samples = selectedSamples(); if (!samples) return;
  g.strokeStyle='#75e3bd'; g.lineWidth=1.5; g.beginPath();
  if (view === 'wave') {
    for (let x=0;x<canvas.width;x++) {
      const a=Math.floor(x*samples.length/canvas.width),b=Math.max(a+1,Math.floor((x+1)*samples.length/canvas.width));
      let low=1,high=-1;
      for(let i=a;i<b;i++){low=Math.min(low,samples[i]!);high=Math.max(high,samples[i]!);}
      g.moveTo(x,130-low*120);g.lineTo(x,130-high*120);
    }
    el('axis-start').textContent='0 s'; el('axis-end').textContent=`${(samples.length/SAMPLE_RATE).toFixed(2)} s`;el('axis-caption').textContent='AMPLITUDE ±1';
    canvas.setAttribute('aria-label',`Waveform ${monitor === 'dry' ? 'before' : 'after'} delay and reverb`);
  } else {
    const bins=spectrum(samples);
    for(let x=0;x<canvas.width;x++){
      const hz=30*(16000/30)**(x/canvas.width),bin=Math.min(bins.length-1,Math.round(hz/SAMPLE_RATE*2048));
      const y=250-Math.max(0,Math.min(1,(bins[bin]!+90)/90))*235;
      if(x===0)g.moveTo(x,y);else g.lineTo(x,y);
    }
    el('axis-start').textContent='30 Hz';el('axis-end').textContent='16 kHz';el('axis-caption').textContent='−90 TO 0 dBFS';
    canvas.setAttribute('aria-label','Spectrum of a window near the start of the rendered sound');
  }
  g.stroke();
}
async function renderSound(autoplay=false): Promise<void> {
  clearTimeout(debounce); stopWorker(); stopPlayback();
  const backend=field('backend').value;
  if(backend==='webgpu' && !('gpu' in navigator && navigator.gpu)) { status('WebGPU is unavailable in this browser. Select CPU to render here.',true);return; }
  const requested = {...patch};
  const name=field('patch-name').value.trim() || 'typeaudio';
  const id=++renderId;
  // Unlock during the user's gesture, before the worker returns its audio.
  if(autoplay) { try { await audioContext(); } catch(error) {status(`Audio could not start: ${String(error)}`,true);return;} }
  if(id!==renderId)return;
  clip=undefined;draw();el('empty-wave').style.display='grid';el('empty-wave').textContent='Rendering your patch…';
  el('clip-label').textContent='RENDERING';
  for(const key of ['metric-backend','metric-time','metric-peak'])el(key).textContent='—';
  el('report').textContent='Waiting for the engine…';status(`Rendering on ${backend === 'cpu' ? 'CPU' : 'WebGPU'}… Stop cancels.`);
  const fail=(message:string):void=>{
    if(id!==renderId)return;
    stopWorker();el('clip-label').textContent='RENDER FAILED';el('empty-wave').textContent='No audio rendered.';
    el('report').textContent=message;status(message+(backend==='webgpu'?' Select CPU explicitly to try the reference backend.':''),true);
  };
  try{
    worker=new Worker(new URL('./render.worker.ts',import.meta.url),{type:'module'});refreshTransport();
    worker.onmessage=({data})=>{
      if(id!==renderId)return;
      if(data.error){fail(data.error);return;}
      clip={dry:data.dry,wet:data.wet};renderedName=name;dirty=false;
      el('metric-backend').textContent=data.tier==='cpu'?'CPU':'WebGPU';
      el('metric-time').textContent=`${Math.round(data.milliseconds)} ms`;el('metric-peak').textContent=data.peak.toFixed(3);
      el('clip-label').textContent=`${(data.wet.length/SAMPLE_RATE).toFixed(2)} SEC`;
      el('report').textContent=data.report;el('empty-wave').style.display='none';
      stopWorker();draw();el('edit-status').textContent=data.peak>1?'Output clips above full scale. Lower Output level or resonance.':'Rendered patch is up to date. Compare Before FX and After FX.';
      status('Render complete. Press Play to listen, or download the WAV.');
      if(autoplay)void playClip();
    };
    worker.onerror=e=>fail(e.message||'The audio worker failed.');
    timeout=setTimeout(()=>fail('Render timed out. Reduce the voice count or note hold.'),90000);
    worker.postMessage({patch:requested,backend});
  }catch(error){fail(String(error));}
}
for(const input of document.querySelectorAll<HTMLInputElement>('[data-patch]')){
  input.addEventListener('input',()=>{
    (patch as unknown as Record<string,unknown>)[input.id]=input.type==='checkbox'?input.checked:Number(input.value);
    displayValues();markEdited();
  });
  input.addEventListener('change',remember);
}
field('backend').addEventListener('change',markEdited);
field('auto-preview').addEventListener('change',()=>{
  clearTimeout(debounce);
  if(field('auto-preview').checked)void renderSound(true);
  else {stopWorker();stopPlayback();status('Auto audition off. Render and Play when you are ready.');}
});
field('loop').addEventListener('change',()=>{if(source)source.loop=field('loop').checked;});
el<HTMLFormElement>('controls').addEventListener('submit',e=>{e.preventDefault();void renderSound(false);});
button('play').addEventListener('click',()=>void playClip());
button('stop').addEventListener('click',()=>{
  clearTimeout(debounce);const rendering=!!worker;stopWorker();stopPlayback();stopLive();
  if(rendering){el('empty-wave').textContent='Render cancelled.';el('clip-label').textContent='CANCELLED';el('report').textContent='Render cancelled before completion.';}
  status(rendering?'Render cancelled. Adjust the patch and try again.':'Playback stopped.');
});
for(const control of document.querySelectorAll<HTMLButtonElement>('[data-view]'))control.addEventListener('click',()=>{
  view=control.dataset.view as typeof view;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===control)));draw();
});
for(const control of document.querySelectorAll<HTMLButtonElement>('[data-monitor]'))control.addEventListener('click',()=>{
  monitor=control.dataset.monitor as typeof monitor;
  document.querySelectorAll<HTMLButtonElement>('[data-monitor]').forEach(b=>b.setAttribute('aria-pressed',String(b===control)));draw();
  const current=selectedSamples();if(current)el('metric-peak').textContent=current.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0).toFixed(3);
  if(live)live.update(patch,field('live-repeat').checked,monitor==='dry');
  else if(playing)void playClip();
});
for(const [key,preset] of Object.entries(PRESETS)){
  const b=document.createElement('button');b.type='button';b.className='preset-card';b.dataset.preset=key;
  b.setAttribute('aria-pressed',String(key==='warm'));
  const title=document.createElement('span');title.textContent=preset.name;
  const desc=document.createElement('small');desc.textContent=preset.description;b.append(title,desc);
  b.addEventListener('click',()=>{applyPatch(preset.patch,preset.name);b.setAttribute('aria-pressed','true');});el('preset-strip').append(b);
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-note]'))b.addEventListener('click',()=>{applyPatch({...patch,frequency:Number(b.dataset.note)});});
button('reset').addEventListener('click',()=>applyPatch(DEFAULT,'Warm lead'));
button('undo').addEventListener('click',()=>{
  if(history.length<2)return;history.pop();patch={...history[history.length-1]!};writeControls();markEdited();
});
button('randomize').addEventListener('click',()=>{
  const notes=[65.4,110,130.81,164.81,220,261.63,329.63,440];
  applyPatch({...DEFAULT,shapeA:Math.floor(Math.random()*4),shapeB:Math.floor(Math.random()*4),
    frequency:notes[Math.floor(Math.random()*notes.length)]!,transpose:[-12,0,7,12][Math.floor(Math.random()*4)]!,
    blend:Math.round(Math.random()*80)/100,detune:Math.round(Math.random()*30-15),cutoff:Math.round((500+Math.random()*5500)/10)*10,
    resonance:Math.round((0.6+Math.random()*2.5)*10)/10,attack:Math.round((0.005+Math.random()*0.3)*1000)/1000,
    decay:Math.round((0.1+Math.random()*0.7)*100)/100,sustain:Math.round(Math.random()*80)/100,
    delay:Math.random()>0.5,reverb:Math.random()>0.5},'Random patch');
});
function download(blob:Blob,name:string):void{
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
button('download').addEventListener('click',()=>{
  const samples=selectedSamples();if(samples)download(new Blob([wav(samples,SAMPLE_RATE)],{type:'audio/wav'}),`${renderedName.replace(/[^a-z0-9_-]/gi,'-')}-${monitor}.wav`);
});
function showSaved():void{
  el('saved-patches').replaceChildren(new Option('Your saved patches…',''));
  saved.forEach((item,i)=>el('saved-patches').append(new Option(item.name,String(i))));
}
try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'[]');
  if(Array.isArray(raw))saved=raw.slice(0,30).map((item:SavedPatch)=>({name:String(item.name).slice(0,40),patch:validatePatch(item.patch)}));
}catch{libraryMessage('Saved patches could not be read. You can still export JSON.');}
showSaved();
button('save-patch').addEventListener('click',()=>{
  const name=field('patch-name').value.trim();if(!name){libraryMessage('Give this sound a name first.');field('patch-name').focus();return;}
  const next=saved.filter(item=>item.name!==name);next.unshift({name,patch:{...patch}});next.splice(30);
  try{localStorage.setItem(STORE,JSON.stringify(next));saved=next;showSaved();libraryMessage(`Saved “${name}” in this browser.`);}catch{libraryMessage('Browser storage is unavailable. Export JSON to keep this patch.');}
});
field('saved-patches').addEventListener('change',()=>{
  if(field('saved-patches').value==='')return;const item=saved[Number(field('saved-patches').value)];if(item)applyPatch(item.patch,item.name);
});
button('export-patch').addEventListener('click',()=>download(new Blob([JSON.stringify({version:1,name:field('patch-name').value,patch},null,2)],{type:'application/json'}),'typeaudio-patch.json'));
button('import-patch').addEventListener('click',()=>field('patch-file').click());
field('patch-file').addEventListener('change',async()=>{
  const file=field('patch-file').files?.[0];if(!file)return;
  try{
    if(file.size>20000)throw new Error('Patch files must be smaller than 20 KB.');
    const data=JSON.parse(await file.text());if(data.version!==1)throw new Error('This patch version is not supported.');
    applyPatch(validatePatch(data.patch),String(data.name||'Imported patch').slice(0,40));libraryMessage('Patch imported. Render to hear it.');
  }catch(error){libraryMessage(`Import failed: ${error instanceof Error?error.message:String(error)}`);}finally{field('patch-file').value='';}
});
window.addEventListener('pagehide',()=>{stopLive();clearTimeout(debounce);stopWorker();stopPlayback();void context?.close();context=undefined;});
field('patch-name').value='Warm lead';writeControls();refreshTransport();
