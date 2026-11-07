import { describe, expect, it } from 'vitest';
import { prepareSpatialSource, SpatialMixer } from '../../src/spatial/index.ts';
import type { SpatialTarget } from '../../src/spatial/index.ts';
const centre = prepareSpatialSource({ position: { x: 0, y: 0, z: 0 } }, { position: { x: 0, y: 0, z: -1 } });
const target = (left: number, right: number, pole = 0): SpatialTarget => ({ ...centre, left, right, pole });
function render(block: number) {
  const mixer = new SpatialMixer({ capacity: 2, maxFrames: block });
  const a = new Float32Array(block), b = new Float32Array(block);
  const left = new Float32Array(block), right = new Float32Array(block);
  const inputs = [a, b], output = new Float32Array(6000 * 2);
  mixer.setSource(0, target(0.9, 0.1, 0.8));
  mixer.setSource(1, target(0.1, 0.7, 0.2));
  for (let at = 0; at < 6000;) {
    if (at === 3000) mixer.setSource(0, target(0.15, 0.8, 0.95));
    const count = Math.min(block, 6000 - at, at < 3000 ? 3000 - at : 6000 - at);
    for (let i = 0; i < count; i++) {
      a[i] = Math.sin((at + i) * 0.13) * 0.3;
      b[i] = Math.sin((at + i) * 0.23) * 0.2;
    }
    mixer.process(inputs, left, right, count);
    for (let i = 0; i < count; i++) { output[(at + i) * 2] = left[i]; output[(at + i) * 2 + 1] = right[i]; }
    at += count;
  }
  return output;
}
describe('synchronous spatial bus', () => {
  it('applies the first pose immediately without delaying a new transient', () => {
    const mixer = new SpatialMixer({ capacity: 1 });
    const x = new Float32Array(128), l = x.slice(), r = x.slice();
    x[0] = 1;
    mixer.setSource(0, target(1, 0));
    mixer.process([x], l, r);
    expect(l[0]).toBe(1); expect(r[0]).toBe(0);
    expect(l.slice(1).every(v => v === 0)).toBe(true);
    mixer.clearSource(0);
    mixer.setSource(0, target(0, 1));
    mixer.process([x], l, r);
    expect(r[0]).toBe(1); expect(l[0]).toBe(0);
  });
  it('matches an independent gain and lowpass recurrence synchronously', () => {
    const mixer = new SpatialMixer({ capacity: 1, smoothingSeconds: 0.01 });
    mixer.setSource(0, target(0.8, 0.3, 0.9));
    const input = Float32Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.3));
    const left = new Float32Array(128).fill(NaN), right = left.slice();
    expect(mixer.process([input], left, right)).toBeUndefined();
    const step = 1 - Math.exp(-1 / 480);
    let l = 0.8, r = 0.3, pole = 0.9, z = 0;
    for (let i = 0; i < input.length; i++) {
      l += (0.8 - l) * step; r += (0.3 - r) * step; pole += (0.9 - pole) * step;
      z += (input[i] - z) * (1 - pole);
      expect(left[i]).toBe(Math.fround(z * l));
      expect(right[i]).toBe(Math.fround(z * r));
    }
  });
  it('preserves movement and source state across arbitrary block partitions', () => {
    expect(render(1)).toEqual(render(73));
    expect(render(73)).toEqual(render(128));
  });
  it('smooths a large position change instead of stepping channel gain', () => {
    const mixer = new SpatialMixer({ capacity: 1 });
    const x = new Float32Array(128).fill(1), l = new Float32Array(128), r = new Float32Array(128);
    mixer.setSource(0, target(1, 0));
    for (let i = 0; i < 60; i++) mixer.process([x], l, r);
    const before = l[127];
    mixer.setSource(0, target(0, 1)); mixer.process([x], l, r);
    expect(Math.abs(l[0] - before)).toBeLessThan(0.003);
    expect(r[0]).toBeLessThan(0.003);
    for (let i = 0; i < 60; i++) mixer.process([x], l, r);
    expect(l[127]).toBeLessThan(0.00001);
    expect(r[127]).toBeGreaterThan(0.99999);
  });
  it('attenuates high-frequency energy more than low-frequency energy when distant', () => {
    function energy(frequency: number, pole: number) {
      const mixer = new SpatialMixer({ capacity: 1 });
      const input = new Float32Array(128), l = input.slice(), r = input.slice();
      mixer.setSource(0, target(1, 0, pole)); let total = 0;
      for (let block = 0; block < 200; block++) {
        for (let i = 0; i < 128; i++) input[i] = Math.sin(2 * Math.PI * frequency * (block * 128 + i) / 48000);
        mixer.process([input], l, r);
        if (block > 100) for (let i = 0; i < 128; i++) total += l[i] ** 2;
      }
      return total;
    }
    const pole = prepareSpatialSource({ position: { x: 0, y: 0, z: 0 } }, { position: { x: 0, y: 0, z: -80 } }).pole;
    expect(energy(100, pole) / energy(100, 0)).toBeGreaterThan(0.98);
    expect(energy(10000, pole) / energy(10000, 0)).toBeLessThan(0.3);
  });
  it('drains missing inputs, clears recycled slots and resets deterministically', () => {
    const mixer = new SpatialMixer({ capacity: 2 });
    const x = new Float32Array(128).fill(1), l = x.slice(), r = x.slice();
    mixer.setSource(0, target(1, 0, 0.9));
    mixer.process([x], l, r); const first = l.slice();
    mixer.reset(); mixer.process([x], l, r); expect(l).toEqual(first);
    mixer.process([], l, r); expect(l[0]).toBeGreaterThan(0); expect(l[127]).toBeLessThan(l[0]);
    mixer.clearSource(0); mixer.setSource(1, target(0, 1));
    mixer.process([null, x], l, r); expect(l.every(v => v === 0)).toBe(true); expect(r[127]).toBeGreaterThan(0);
    mixer.removeSource(1);
    for (let i = 0; i < 80; i++) mixer.process([null, x], l, r);
    expect(r[127]).toBeLessThan(1e-8);
  });
  it('isolates invalid samples and reports overloads without a hidden limiter', () => {
    const mixer = new SpatialMixer({ capacity: 1 });
    const x = new Float32Array(128).fill(1), l = x.slice(), r = x.slice();
    mixer.setSource(0, target(4, 4));
    x[0] = NaN; x[1] = Infinity;
    mixer.process([x], l, r); expect(mixer.invalidSamples).toBe(2);
    x.fill(1); for (let i = 0; i < 20; i++) mixer.process([x], l, r);
    expect(l[127]).toBeGreaterThan(3);
    expect(mixer.overloadFrames).toBeGreaterThan(0);
    expect(mixer.peak).toBeGreaterThan(3);
    x.fill(3e38); mixer.process([x], l, r);
    expect(mixer.invalidOutputSamples).toBeGreaterThan(0);
    expect(l.every(Number.isFinite) && r.every(Number.isFinite)).toBe(true);
    x.fill(0); mixer.process([x], l, r); expect(l.every(v => v === 0)).toBe(true);
  });
  it('rejects invalid updates atomically and aliasing before changing output', () => {
    const mixer = new SpatialMixer({ capacity: 1 });
    const x = new Float32Array(128).fill(1), l = new Float32Array(128).fill(42), r = l.slice();
    mixer.setSource(0, target(1, 0));
    expect(() => mixer.setSource(0, target(0, NaN))).toThrow();
    expect(() => mixer.setSource(0, { ...centre, sampleRate: 44100 })).toThrow();
    expect(() => mixer.setSource(1, centre)).toThrow();
    expect(() => mixer.process([x], l, l)).toThrow();
    expect(() => mixer.process([l], l, r)).toThrow();
    const backing = new Float32Array(256);
    expect(() => mixer.process([x], backing.subarray(0, 128), backing.subarray(64, 192))).toThrow();
    expect(() => mixer.process([new Float32Array(12)], l, r)).toThrow();
    expect(() => mixer.process([x, x], l, r)).toThrow();
    expect(() => mixer.process([x], l, r, 0)).toThrow();
    expect(l.every(v => v === 42)).toBe(true);
    mixer.process([x], l, r, 64);
    expect(l[63]).toBeGreaterThan(0); expect(r[63]).toBe(0);
    expect(l[64]).toBe(42); expect(r[64]).toBe(42);
  });
});
