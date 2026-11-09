// The host half of the spatial chain: the numbers of each event's `Spatial` lane, of each layer's
// `Strip`, and the synthesized impulse response of the room. All are functions of the plan, with no
// measured data: the repository holds no HRTF set, so the binaural stage is an interaural delay and
// a head-shadow lowpass (a deviation of experiment 8), and the impulse response is exponentially
// decaying noise, 0.5 to 2.5 s by material.

import { LAYERS, type PlanEvent, type PlanMaterial, type PlanScene } from '../plan/index.ts';
import { draw, mix32 } from '../kinds/make.ts';
import { Spatial, Strip } from './spatial.shade.ts';

/** The frames of a block, the history before it and the width of a lane's history. */
export const BLOCK = 1024;
export const HIST = 4096;
export const WIDTH = HIST + BLOCK;
/** The speed of sound, in metres a second. */
const SOUND = 343;

export interface Material {
  /** The impulse response's length, which is its 60 dB decay time, in seconds. */
  seconds: number;
  /** The reverb send against the direct sound before distance. */
  send: number;
  /** The share of a reflection's pressure a wall keeps. */
  reflect: number;
  /** The one-pole smoothing of the impulse response's noise: its fraction a sample. */
  tone: number;
}

/** The six materials of the plan, from the liveliest to the driest. */
export const MATERIALS: Record<PlanMaterial, Material> = {
  stone: { seconds: 2.5, send: 0.5, reflect: 0.85, tone: 0.6 },
  glass: { seconds: 1.6, send: 0.4, reflect: 0.8, tone: 0.8 },
  plaster: { seconds: 1.2, send: 0.3, reflect: 0.7, tone: 0.5 },
  wood: { seconds: 0.9, send: 0.25, reflect: 0.6, tone: 0.35 },
  fabric: { seconds: 0.5, send: 0.1, reflect: 0.25, tone: 0.2 },
  open: { seconds: 0.5, send: 0.05, reflect: 0.1, tone: 0.3 },
};

/** The fraction of its way a one-pole lowpass at `hz` moves each frame. */
export const onePoleK = (hz: number, sr: number): number => 1 - Math.exp((-2 * Math.PI * hz) / sr);

export interface SpatialOptions {
  /** The chain: distance, air, pan, early reflections and the send. False: a centred dry sound. */
  spatial: boolean;
  sr: number;
}

/** The lane of event `e`: its place in the scene, from its screen position, its distance and the room. */
export function spatialOf(e: PlanEvent, scene: PlanScene, o: SpatialOptions): Spatial {
  const s = new Spatial();
  s.layer = LAYERS.indexOf(e.layer);
  if (!o.spatial) {
    s.g = 1;
    s.kAir = 1;
    s.panL = Math.SQRT1_2;
    s.panR = Math.SQRT1_2;
    s.send = 0;
    s.d0 = s.d1 = s.d2 = s.d3 = s.d4 = s.d5 = 1;
    return s;
  }
  const d = Math.max(e.position.distance, 0.1);
  const material = MATERIALS[scene.room.material];
  s.g = Math.min(1, 2 / d);
  const air = 20000 / (1 + 0.08 * d);
  s.kAir = onePoleK(air, o.sr);
  // The screen's x covers 60 degrees to each side; the pan is equal power.
  const azimuth = e.position.x * (Math.PI / 3);
  const angle = ((e.position.x + 1) * Math.PI) / 4;
  s.panL = Math.cos(angle);
  s.panR = Math.sin(angle);
  s.send = material.send * 0.5 * Math.sqrt(s.g);
  // The far ear: delayed by up to 0.66 ms and shadowed by the head.
  const side = Math.abs(Math.sin(azimuth));
  s.itd = Math.round(0.00066 * side * o.sr);
  s.farLeft = e.position.x > 0 ? 1 : 0;
  s.kFar = onePoleK(Math.min(air, 16000 * (1 - 0.8 * side)), o.sr);
  // Six early reflections, one off each wall: a wall at W metres puts the image of the source
  // sqrt(d^2 + (2W)^2) away, and the reflection arrives that much later than the direct sound. The
  // listener stands a little off the centre, so the two walls of a pair differ.
  const [w, depth, h] = scene.room.size;
  const walls = [w / 2, w / 2, depth / 2, depth / 2, h / 2, h / 2].map(
    (half, i) => half * (i % 2 === 0 ? 0.85 : 1.15),
  );
  const taps = walls.map((wall) => {
    const path = Math.sqrt(d * d + 4 * wall * wall);
    const frames = Math.round(((path - d) / SOUND) * o.sr);
    // A reflection later than the history holds is left out: the reverb carries that time. Moved
    // to the end of the history it would be an echo at the wrong time, at its full gain.
    const inHistory = frames <= HIST - 96;
    return {
      frames: Math.min(Math.max(frames, 96), HIST - 96),
      gain: inHistory ? material.reflect * 0.9 * Math.min(1, d / path) : 0,
    };
  });
  [s.d0, s.d1, s.d2, s.d3, s.d4, s.d5] = taps.map((t) => t.frames) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  [s.r0, s.r1, s.r2, s.r3, s.r4, s.r5] = taps.map((t) => t.gain) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return s;
}

/**
 * The slot of each layer, in the order of `LAYERS`: how far the layer sinks while dialogue speaks
 * (dB), and its shelf: `[corner in Hz, gain in dB, 'low' or 'high']`. Starting values, not measured.
 */
export const SLOTS: readonly {
  duck: number;
  corner: number;
  gain: number;
  side: 'low' | 'high';
}[] = [
  { duck: 0, corner: 150, gain: -3, side: 'low' }, // dialogue: clear the mud under the voice
  { duck: -4, corner: 4000, gain: 2, side: 'high' }, // foley: a little air
  { duck: -5, corner: 6000, gain: 1.5, side: 'high' }, // effects: the top of the mix
  { duck: -8, corner: 300, gain: -4, side: 'low' }, // ambience: no rumble
  { duck: -8, corner: 2500, gain: -3, side: 'high' }, // music: tuck the top away
];

/** The strip of layer `index`. With `guards` false it passes the layer through untouched. */
export function stripOf(index: number, sr: number, guards: boolean): Strip {
  const strip = new Strip();
  strip.atk = 1 - Math.exp(-1 / (0.01 * sr));
  strip.rel = 1 - Math.exp(-1 / (0.25 * sr));
  strip.thr = 0.05;
  const slot = SLOTS[index]!;
  const set = (shelf: Strip['left']): void => {
    shelf.k = onePoleK(slot.corner, sr);
    const g = guards ? 10 ** (slot.gain / 20) : 1;
    shelf.lo = slot.side === 'low' ? g : 1;
    shelf.hi = slot.side === 'high' ? g : 1;
  };
  set(strip.left);
  set(strip.right);
  set(strip.sendBus);
  strip.depth = guards ? 10 ** (slot.duck / 20) : 1;
  return strip;
}

/**
 * The room's impulse response, two channels: noise that decays by 60 dB over the material's length,
 * smoothed by a one-pole lowpass, each channel from its own seed, and each scaled to unit energy.
 */
export function impulseResponse(
  material: PlanMaterial,
  sr: number,
  seed: number,
): { left: Float32Array; right: Float32Array } {
  const m = MATERIALS[material];
  const n = Math.round(m.seconds * sr);
  const channel = (c: number): Float32Array => {
    const key = mix32(seed >>> 0, 0x1e5 + c);
    const x = new Float32Array(n);
    let z = 0;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const noise = 2 * draw(key, i) - 1;
      z += m.tone * (noise - z);
      x[i] = z * Math.exp((-6.907755278982137 * i) / n);
      energy += x[i]! * x[i]!;
    }
    const scale = 1 / Math.sqrt(energy);
    for (let i = 0; i < n; i++) x[i]! *= scale;
    return x;
  };
  return { left: channel(0), right: channel(1) };
}
