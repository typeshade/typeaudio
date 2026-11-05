import './style.css';
import { fade, wav, frequencies, type Settings } from './audio.ts';
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const field = (id: string): HTMLInputElement => el<HTMLInputElement>(id);
const button = (id: string): HTMLButtonElement => el<HTMLButtonElement>(id);
const status = (text: string, error = false): void => {
  el('status').textContent = text; el('status').classList.toggle('error', error);
};
let samples: Float32Array | undefined;
let worker: Worker | undefined;
let context: AudioContext | undefined;
let source: AudioBufferSourceNode | undefined;
let playing = false;
let playbackId = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;
const sr = 48000;
function settings(): Settings {
  return { backend: field('backend').value as Settings['backend'], frequency: +field('frequency').value,
    voices: +field('voices').value, cutoff: +field('cutoff').value, drive: +field('drive').value,
    duration: +field('duration').value, preset: field('preset').value };
}
function update(): void {
  const s = settings();
  for (const [key, suffix] of [['frequency', ' Hz'], ['voices', ''], ['cutoff', ' Hz'], ['drive', '×']]) {
    el(`${key}-value`).textContent = field(key!).value + suffix;
  }
  el('code').textContent = `const dev = await createDevice({ prefer: ['${s.backend}'] });\nconst voices = bank(dev, [\n${frequencies(s).map(f => `  new Voice(${f.toFixed(3)}, ${s.cutoff}, 0.7, 48000),`).join('\n')}\n]);\nconst p = plan(voices, { drive: ${(s.drive / s.voices).toFixed(4)}, gain: 0.35 });\nconst pcm = await render(p, { frames: ${sr * s.duration}, block: 1024 });\nconsole.log(explain(p.reports));\n// Playback and WAV export add a 10 ms edge fade.`;
}
for (const id of ['frequency','voices','cutoff','drive','duration','backend']) field(id).addEventListener('input', update);
field('preset').addEventListener('change', () => {
  const presets: Record<string, number[]> = { warm: [220,4,1600,1.5], bass: [82,2,500,2], bright: [220,4,5000,1] };
  const values = presets[field('preset').value]!;
  ['frequency','voices','cutoff','drive'].forEach((key,i) => { field(key).value = String(values[i]); });
  update();
});
function controls(disabled: boolean): void {
  el<HTMLFormElement>('controls').querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(node => { node.disabled = disabled; });
  button('render').disabled = disabled;
  button('play').disabled = disabled || !samples || playing;
  button('download').disabled = disabled || !samples;
  button('stop').disabled = !disabled && !playing;
}
function stopPlayback(): void {
  playbackId++;
  source?.stop(); source?.disconnect(); source = undefined; playing = false;
}
function finishWorker(): void { clearTimeout(timeout); worker?.terminate(); worker = undefined; controls(false); }
function draw(): void {
  const canvas = el<HTMLCanvasElement>('waveform');
  const g = canvas.getContext('2d')!;
  g.clearRect(0,0,canvas.width,canvas.height);
  if (!samples) return;
  g.strokeStyle = '#75e3bd'; g.lineWidth = 1.4; g.beginPath();
  for (let x = 0; x < canvas.width; x++) {
    const start = Math.floor(x * samples.length / canvas.width);
    const end = Math.max(start + 1, Math.floor((x + 1) * samples.length / canvas.width));
    let low = 1, high = -1;
    for (let i = start; i < end; i++) { low = Math.min(low, samples[i]!); high = Math.max(high, samples[i]!); }
    g.moveTo(x,130-low*320); g.lineTo(x,130-high*320);
  }
  g.stroke();
}
el<HTMLFormElement>('controls').addEventListener('submit', event => {
  event.preventDefault(); stopPlayback();
  const s = settings();
  if (s.backend === 'webgpu' && !('gpu' in navigator && navigator.gpu)) { status('WebGPU is unavailable in this browser. Select CPU to render here.', true); controls(false); return; }
  samples = undefined; draw(); el('empty-wave').style.display = 'grid';
  el('empty-wave').textContent = 'Rendering your sound…';
  el('clip-label').textContent = 'RENDERING';
  for (const id of ['metric-backend','metric-time','metric-peak']) el(id).textContent = '—';
  el('report').textContent = 'Waiting for the engine…';
  controls(true); status(`Rendering on ${s.backend === 'cpu' ? 'CPU' : 'WebGPU'}… Stop cancels this render.`);
  try {
    worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    const fail = (message: string): void => {
      finishWorker(); el('clip-label').textContent = 'RENDER FAILED';
      el('empty-wave').textContent = 'No audio rendered.'; el('report').textContent = message;
      status(message + (s.backend === 'webgpu' ? ' Try selecting CPU explicitly.' : ''), true);
    };
    worker.onmessage = ({ data }) => {
      if (data.error) { fail(data.error); return; }
      samples = fade(data.samples, sr);
      el('metric-backend').textContent = data.tier === 'cpu' ? 'CPU' : 'WebGPU';
      el('metric-time').textContent = `${Math.round(data.milliseconds)} ms`;
      el('metric-peak').textContent = data.peak.toFixed(3);
      el('clip-label').textContent = `${s.duration.toFixed(1)} SEC / ${samples!.length.toLocaleString()} FRAMES`;
      el('report').textContent = data.report;
      el('empty-wave').style.display = 'none'; draw(); finishWorker();
      status('Render complete. Press Play to listen, or download the WAV.');
    };
    worker.onerror = event => fail(event.message || 'The audio worker failed.');
    timeout = setTimeout(() => fail('Render timed out after 90 seconds. Reduce the voice count or duration.'), 90000);
    worker.postMessage(s);
  } catch (error) { finishWorker(); el('empty-wave').textContent = 'No audio rendered.'; status(String(error), true); }
});
button('play').addEventListener('click', async () => {
  if (!samples || playing) return;
  const clip = samples;
  const id = ++playbackId;
  playing = true; controls(false);
  try {
    context ??= new AudioContext({ sampleRate: sr });
    await context.resume();
    if (id !== playbackId) return;
    const buffer = context.createBuffer(1, clip.length, sr);
    buffer.copyToChannel(new Float32Array(clip), 0);
    source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    source.onended = () => {
      if (id !== playbackId) return;
      source?.disconnect(); source = undefined; playing = false; controls(false); status('Playback finished. Play again or render another sound.');
    };
    source.start(); status('Playing the rendered clip…');
  } catch (error) { playing = false; controls(false); status(`Playback failed: ${String(error)}`, true); }
});
button('stop').addEventListener('click', () => {
  const wasRendering = !!worker;
  stopPlayback(); finishWorker();
  if (wasRendering) { el('empty-wave').textContent = 'Render cancelled.'; el('clip-label').textContent = 'CANCELLED'; el('report').textContent = 'Render cancelled before completion.'; }
  status(wasRendering ? 'Render cancelled. Adjust the settings and try again.' : 'Playback stopped.');
});
button('download').addEventListener('click', () => {
  if (!samples) return;
  const url = URL.createObjectURL(new Blob([wav(samples, sr)], { type: 'audio/wav' }));
  const a = document.createElement('a'); a.href = url; a.download = 'typeaudio.wav'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('pagehide', () => { stopPlayback(); worker?.terminate(); void context?.close(); context = undefined; });
update();
