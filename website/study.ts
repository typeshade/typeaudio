// The scene study: the viewer's own copy of the video, with the accepted force passage of
// experiment 10 rendered on the viewer's device and played in place of the original sound from
// 136.5 s to 152.2 s. Outside that span the video keeps its own sound. Nothing leaves the browser.

import './style.css';
import type { StudyResult } from './study.worker.ts';

/** The span of the passage, picture seconds, and the edge of each change of sound. */
const FROM = 136.5;
const TO = 152.2;
const EDGE = 0.03;
const SR = 48000;

const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const video = el<HTMLVideoElement>('video');
const status = (text: string, error = false): void => {
  el('status').textContent = text;
  el('status').classList.toggle('error', error);
};

let context: AudioContext | undefined;
let original: GainNode | undefined;
let ours: GainNode | undefined;
let buffer: AudioBuffer | undefined;
let source: AudioBufferSourceNode | undefined;
/** Where the running source would be now, in picture seconds, when it is in sync. */
let started: { at: number; offset: number } | undefined;

function audio(): AudioContext {
  if (context) return context;
  context = new AudioContext({ sampleRate: SR });
  original = context.createGain();
  ours = context.createGain();
  context.createMediaElementSource(video).connect(original).connect(context.destination);
  ours.connect(context.destination);
  return context;
}

function stopOurs(): void {
  if (!context || !original) return;
  source?.stop();
  source?.disconnect();
  source = undefined;
  started = undefined;
  original.gain.setTargetAtTime(1, context.currentTime, EDGE / 3);
}

function startOurs(t: number): void {
  if (!context || !buffer || !original || !ours) return;
  stopOurs();
  source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(ours);
  source.start(context.currentTime, t - FROM);
  started = { at: context.currentTime, offset: t - FROM };
  original.gain.setTargetAtTime(0, context.currentTime, EDGE / 3);
}

/** Keeps our sound in the passage and in step with the picture, at every frame. */
function follow(): void {
  const t = video.currentTime;
  const inside = !video.paused && !video.seeking && t >= FROM && t < TO;
  if (!inside) {
    if (source) stopOurs();
  } else if (!source || !started) {
    startOurs(t);
  } else {
    const where = started.offset + (context!.currentTime - started.at) * video.playbackRate;
    if (Math.abs(where - (t - FROM)) > 0.04) startOurs(t);
  }
  requestAnimationFrame(follow);
}

el<HTMLInputElement>('file').addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  video.src = URL.createObjectURL(file);
  el('player').hidden = false;
  status(
    buffer
      ? 'Ready. Play the video; the passage plays from 136.5 s.'
      : 'Video loaded. Render the passage to hear it.',
  );
});

el<HTMLButtonElement>('render').addEventListener('click', () => {
  if (!('gpu' in navigator && navigator.gpu)) {
    status('This page needs WebGPU, and this browser has none.', true);
    return;
  }
  el<HTMLButtonElement>('render').disabled = true;
  status('Rendering on your device…');
  const worker = new Worker(new URL('./study.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({
    data,
  }: MessageEvent<StudyResult | { error: string } | { progress: string }>) => {
    if ('progress' in data) {
      status(data.progress);
      return;
    }
    worker.terminate();
    el<HTMLButtonElement>('render').disabled = false;
    if ('error' in data) {
      status(`The render failed: ${data.error}`, true);
      return;
    }
    const ctx = audio();
    buffer = ctx.createBuffer(2, data.left.length, SR);
    buffer.copyToChannel(data.left, 0);
    buffer.copyToChannel(data.right, 1);
    const sound = data.left.length / SR;
    const engineMs = data.renders.reduce((sum, r) => sum + r.ms, 0);
    const engineSeconds = data.renders.reduce((sum, r) => sum + r.seconds, 0);
    el('report').textContent = [
      `Device: ${data.tier}`,
      ...data.renders.map(
        (r) =>
          `${r.name}: ${r.seconds.toFixed(1)} s of sound in ${(r.ms / 1000).toFixed(2)} s (${(r.seconds / (r.ms / 1000)).toFixed(2)}x real time)`,
      ),
      `Engine in all: ${engineSeconds.toFixed(1)} s of sound in ${(engineMs / 1000).toFixed(2)} s (${(engineSeconds / (engineMs / 1000)).toFixed(2)}x real time)`,
      `Composition on the CPU: ${(data.composeMs / 1000).toFixed(2)} s`,
      `Whole render: ${(data.totalMs / 1000).toFixed(2)} s for ${sound.toFixed(1)} s of passage`,
    ].join('\n');
    status(
      video.src
        ? 'Ready. Play the video; the passage plays from 136.5 s.'
        : 'Rendered. Choose the video file to watch it.',
    );
  };
  worker.onerror = (event) => {
    worker.terminate();
    el<HTMLButtonElement>('render').disabled = false;
    status(`The render failed: ${event.message}`, true);
  };
  worker.postMessage(null);
});

el<HTMLButtonElement>('jump').addEventListener('click', () => {
  video.currentTime = FROM - 3;
  void audio().resume();
  void video.play();
});
video.addEventListener('play', () => void audio().resume());
requestAnimationFrame(follow);
