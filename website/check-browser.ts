import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';
import { SOFTWARE_GPU_FLAGS } from '../scripts/browser.ts';
import { mkdir, readFile } from 'node:fs/promises';
const server = await preview({ configFile: 'website/vite.config.ts', preview: { host: '127.0.0.1', port: 4178, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env['TYPESHADE_CHROMIUM'] || chromium.executablePath(), args: [...SOFTWARE_GPU_FLAGS, '--no-sandbox'] });
async function rendered(page:Page,backend='CPU'):Promise<void>{
  await page.waitForFunction(()=>document.querySelector('#metric-backend')!.textContent!=='—'||document.querySelector('#status')!.classList.contains('error'),undefined,{timeout:90000});
  assert.equal(await page.locator('#metric-backend').textContent(),backend,await page.locator('#status').textContent()??'');
  assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false);
}
async function render(page:Page,backend='CPU'):Promise<void>{await page.locator('#render').click();await rendered(page,backend);}
async function range(page:Page,id:string,value:number):Promise<void>{
  await page.locator(`#${id}`).evaluate((node,v)=>{const input=node as HTMLInputElement;input.value=String(v);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
async function downloadWav(page:Page):Promise<Buffer>{
  const waiting=page.waitForEvent('download');await page.locator('#download').click();const d=await waiting;return readFile((await d.path())!);
}
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4178/');await page.locator('#mode-render').click();
  assert.equal(await page.locator('.preset-card').count(),6);
  await range(page,'duration',0.5);await render(page);
  assert.ok(Number(await page.locator('#metric-peak').textContent())>0.01);
  const cpu=await downloadWav(page);assert.equal(cpu.toString('ascii',0,4),'RIFF');
  assert.equal(cpu.length,44+Math.ceil((0.5+0.35)*48000)*2);
  await page.locator('#loop').check();await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#status')!.textContent!.includes('Looping'));
  await page.locator('#stop').click();assert.match(await page.locator('#status').textContent()??'',/stopped/);
  await page.locator('#loop').uncheck();
  await page.selectOption('#backend','webgpu');await render(page,'WebGPU');
  const gpu=await downloadWav(page);assert.equal(gpu.length,cpu.length);
  let largest=0;for(let i=44;i<cpu.length;i+=2)largest=Math.max(largest,Math.abs(cpu.readInt16LE(i)-gpu.readInt16LE(i)));
  assert.ok(largest<=66,`CPU/WebGPU PCM difference ${largest}/32768`);
  console.log(`PASS CPU/WebGPU actual PCM parity (max ${largest}/32768), WAV, loop playback, and stop`);
  await page.locator('#render').click();await page.locator('#stop').click();
  assert.match(await page.locator('#status').textContent()??'',/cancelled/);
  await page.selectOption('#backend','cpu');
  for(const shape of ['0','1','2','3']){await page.selectOption('#shapeA',shape);await render(page);assert.ok(Number(await page.locator('#metric-peak').textContent())>0.001);}
  await page.locator('[data-preset="glass"]').click();await range(page,'duration',0.5);await render(page);
  assert.match(await page.locator('#report').textContent()??'',/CPU post-processing: feedback delay → Schroeder reverb/);
  const wet=await downloadWav(page);await page.locator('#monitor-dry').click();const dry=await downloadWav(page);
  assert.equal(wet.length,dry.length);assert.notDeepEqual(wet,dry);
  assert.equal(dry.readInt16LE(dry.length-100),0);
  await page.locator('[data-view="spectrum"]').click();assert.equal(await page.locator('#axis-end').textContent(),'16 kHz');
  await page.locator('#monitor-wet').click();
  console.log('PASS oscillator shapes, effects, aligned dry/wet comparison, and spectrum');
  await page.locator('#patch-name').fill('Browser regression patch');await page.locator('#save-patch').click();
  assert.match(await page.locator('#library-status').textContent()??'',/Saved/);
  const cutoff=await page.locator('#cutoff').inputValue();await page.locator('#randomize').click();
  await page.selectOption('#saved-patches','0');assert.equal(await page.locator('#cutoff').inputValue(),cutoff);
  const exportWaiting=page.waitForEvent('download');await page.locator('#export-patch').click();
  const exported=JSON.parse(await readFile((await (await exportWaiting).path())!,'utf8'));
  assert.equal(exported.version,1);assert.equal(exported.patch.cutoff,Number(cutoff));
  await page.locator('#patch-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"patch":{"feedback":10}}')});
  await page.waitForFunction(()=>document.querySelector('#library-status')!.textContent!.startsWith('Import failed'));
  await page.locator('#reset').click();await page.locator('#patch-file').setInputFiles({name:'patch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.waitForFunction(()=>document.querySelector('#library-status')!.textContent!.includes('Patch imported'));
  assert.equal(await page.locator('#cutoff').inputValue(),cutoff);
  await page.reload();await page.locator('#mode-render').click();await page.selectOption('#saved-patches','0');assert.equal(await page.locator('#cutoff').inputValue(),cutoff);
  await page.locator('#reset').click();const original=await page.locator('#cutoff').inputValue();
  await range(page,'cutoff',500);await page.locator('#undo').click();assert.equal(await page.locator('#cutoff').inputValue(),original);
  console.log('PASS named patch persistence, JSON round trip, invalid import rejection, randomize, and undo');
  await range(page,'duration',0.5);await page.locator('#auto-preview').check();await rendered(page);
  await page.waitForFunction(()=>document.querySelector('#status')!.textContent!.includes('Playing'));
  await range(page,'cutoff',800);await page.waitForFunction(()=>document.querySelector('#clip-label')!.textContent==='RENDERING');await rendered(page);
  assert.equal(await page.locator('#cutoff').inputValue(),'800');
  await page.locator('#auto-preview').uncheck();
  console.log('PASS automatic audition after edits and explicit stop');
  await page.locator('[data-preset="pad"]').click();await render(page);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/designer-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'artifacts/designer-mobile.png',fullPage:true});
  for(const name of ['vision','architecture','experiments','compiler-asks']){const response=await page.goto(`http://127.0.0.1:4178/docs/${name}/`);assert.equal(response?.status(),200);}
  assert.equal(errors.length,0,errors.join('\n'));
  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await unsupported.goto('http://127.0.0.1:4178/');await unsupported.locator('#mode-render').click();await unsupported.selectOption('#backend','webgpu');await unsupported.locator('#render').click();
  assert.match(await unsupported.locator('#status').textContent()??'',/unavailable/);
  const versioned=await browser.newPage();
  await versioned.addInitScript(()=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url:string|URL,options?:WorkerOptions){const entry=new URL(String(url),location.href);entry.searchParams.set('entry','regression');super(entry,options);}};});
  await versioned.goto('http://127.0.0.1:4178/');await versioned.locator('#mode-render').click();await range(versioned,'duration',0.5);
  for(const backend of ['cpu','webgpu']){await versioned.selectOption('#backend',backend);await render(versioned,backend==='cpu'?'CPU':'WebGPU');}
  console.log('PASS mobile layout, docs, missing WebGPU error, and query-bearing worker regression');
  const livePage=await browser.newPage({viewport:{width:1440,height:1000}});
  let offlineRequests=0;
  livePage.on('request',request=>{if(request.url().includes('render.worker-'))offlineRequests++;});
  await livePage.addInitScript(()=>{
    const NativeNode=window.AudioWorkletNode;
    (window as unknown as {liveNodes:number}).liveNodes=0;
    window.AudioWorkletNode=class extends NativeNode{constructor(context:BaseAudioContext,name:string,options?:AudioWorkletNodeOptions){super(context,name,options);(window as unknown as {liveNodes:number}).liveNodes++;}};
  });
  await livePage.goto('http://127.0.0.1:4178/');
  assert.equal(await livePage.locator('#mode-live').getAttribute('aria-pressed'),'true');
  await livePage.locator('#live-start').click();
  await livePage.waitForFunction(()=>document.querySelector('#metric-backend')!.textContent==='CPU live'||document.querySelector('#status')!.classList.contains('error'));
  assert.equal(await livePage.locator('#metric-backend').textContent(),'CPU live',await livePage.locator('#status').textContent()??'');
  await livePage.waitForFunction(()=>Number((document.querySelector('#live-indicator') as HTMLElement).dataset.frames)>48000);
  const before=Number(await livePage.locator('#live-indicator').getAttribute('data-frames'));
  await range(livePage,'frequency',880);await range(livePage,'cutoff',8000);
  await livePage.locator('#delay').check();await livePage.locator('#reverb').check();await range(livePage,'voices',8);
  await livePage.waitForFunction(()=>Number((document.querySelector('#live-indicator') as HTMLElement).dataset.revision)>=6);
  await livePage.waitForFunction(frame=>Number((document.querySelector('#live-indicator') as HTMLElement).dataset.frames)>frame+48000,before,{timeout:8000});
  assert.equal(await livePage.evaluate(()=>(window as unknown as {liveNodes:number}).liveNodes),1);
  assert.equal(offlineRequests,0,'Live mode must never request the offline render worker');
  await livePage.locator('[data-view="spectrum"]').click();await livePage.waitForFunction(()=>document.querySelector('#axis-caption')!.textContent==='LIVE SPECTRUM');
  await livePage.locator('#monitor-dry').click();await livePage.locator('#live-retrigger').click();
  await livePage.screenshot({path:'artifacts/live-desktop.png',fullPage:true});
  await livePage.setViewportSize({width:390,height:844});assert.equal(await livePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await livePage.screenshot({path:'artifacts/live-mobile.png',fullPage:true});
  await livePage.locator('#live-stop').click();assert.match(await livePage.locator('#status').textContent()??'',/stopped/);
  assert.equal(await livePage.locator('#live-start').isDisabled(),false);
  await livePage.locator('#live-start').click();await livePage.waitForFunction(()=>document.querySelector('#status')!.textContent!.includes('Live on CPU'));
  await livePage.locator('#mode-render').click();assert.equal(await livePage.locator('#render').isVisible(),true);
  await livePage.close();
  console.log('PASS continuous AudioWorklet output, 8 voices, live edits without node replacement or render worker, live spectrum, stop/restart, and mode switch');

} finally {
  await browser.close();await new Promise<void>((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
}
