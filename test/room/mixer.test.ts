import { describe, expect, it } from 'vitest';
import { prepareRoom, prepareRoomSource, RoomMixer } from '../../src/spatial/room/index.ts';
import { definition, isolated, listener, room, source, target } from './helpers.ts';

function render(block: number): Float32Array {
  const plan = prepareRoom({ ...definition, lateGain: 0.2, decaySeconds: 0.5 }, 12000);
  const mixer = new RoomMixer(plan, { capacity: 2, maxFrames: block });
  const input = new Float32Array(block), other = input.slice(), left = input.slice(), right = input.slice();
  const output = new Float32Array(12000 * 2), events = [1000, 1100, 1180, 2500, 12000];
  mixer.setSource(0, prepareRoomSource(plan, listener, { position: { x: -1, y: 0, z: -1 }, gain: 0.2 }));
  mixer.setSource(1, prepareRoomSource(plan, listener, { position: { x: 1, y: 0, z: 1 }, gain: 0.2 }));
  let event = 0;
  for (let at = 0; at < 12000;) {
    if (at === events[event]) {
      if (event < 3) mixer.setSource(0, prepareRoomSource(plan, listener, {
        position: { x: event === 1 ? -1.5 : 1.5, y: 0.5, z: 2 }, occlusion: event * 0.1, gain: 0.2,
      }));
      event++;
    }
    const count = Math.min(block, events[event] - at);
    for (let i = 0; i < count; i++) { input[i] = Math.sin((at + i) * 0.13); other[i] = Math.sin((at + i) * 0.23); }
    mixer.process(at < 2500 ? [input, other] : [], left, right, count);
    for (let i = 0; i < count; i++) { output[(at + i) * 2] = left[i]; output[(at + i) * 2 + 1] = right[i]; }
    at += count;
  }
  return output;
}

describe('room stereo bus', () => {
  it('preserves direct onset and emits wall impulses only at their travel time', () => {
    const mixer = new RoomMixer(room, { capacity: 1, maxFrames: 1024 });
    mixer.setSource(0, target);
    const input = new Float32Array(1024), left = input.slice(), right = input.slice(); input[0] = 1;
    mixer.process([input], left, right);
    expect(left[0]).toBeCloseTo(Math.SQRT1_2);
    expect(right[0]).toBeCloseTo(Math.SQRT1_2);
    expect(left[400]).toBeCloseTo(0.5); expect(right[400]).toBeCloseTo(0.5);
    expect(left[600]).toBeCloseTo(Math.SQRT1_2); expect(right[600]).toBeCloseTo(Math.SQRT1_2);
    expect(left[800]).toBeCloseTo(Math.SQRT1_2);
    expect(left.every((value, i) => [0, 400, 600, 800].includes(i) || value === 0)).toBe(true);
  });
  it('splits a fractional impulse between adjacent samples without advancing its lower delay bound', () => {
    const mixer = new RoomMixer(room, { capacity: 1 });
    mixer.setSource(0, isolated(10.25));
    const input = new Float32Array(128), left = input.slice(), right = input.slice(); input[0] = 1;
    mixer.process([input], left, right);
    expect(left[10]).toBe(0.75); expect(left[11]).toBe(0.25);
    expect(left.every((value, i) => i === 10 || i === 11 || value === 0)).toBe(true);
    expect(right.every(value => value === 0)).toBe(true);
  });
  it('produces bit-identical output across block partitions, moving poses and a drained tail', () => {
    const reference = render(1);
    expect(render(73)).toEqual(reference); expect(render(128)).toEqual(reference);
    expect(reference.slice(10000).some(value => value !== 0)).toBe(true);
  });
  it('resets reproducibly, drains absent inputs and isolates recycled source histories', () => {
    const mixer = new RoomMixer(room, { capacity: 2 });
    mixer.setSource(0, isolated(150));
    const input = new Float32Array(128), left = input.slice(), right = input.slice(); input[0] = 1;
    mixer.process([input], left, right); expect(left.every(x => x === 0)).toBe(true);
    mixer.process([], left, right); expect(left[22]).toBe(1); const result = left.slice();
    mixer.reset(); mixer.process([input], left, right); mixer.process([], left, right);
    expect(left).toEqual(result);
    mixer.reset(); mixer.process([input], left, right); mixer.clearSource(0);
    mixer.setSource(1, isolated(150)); mixer.process([], left, right);
    expect(left.every(x => x === 0)).toBe(true);
  });
  it('fades removed sources and keeps source control snapshots independent of caller mutation', () => {
    const mixer = new RoomMixer(room, { capacity: 1 });
    const copied = structuredClone(isolated(0)); mixer.setSource(0, copied);
    (copied.reflections[0] as { left: number }).left = 0;
    const input = new Float32Array(128).fill(1), left = input.slice(), right = input.slice();
    mixer.process([input], left, right); expect(left[127]).toBe(1);
    mixer.removeSource(0); mixer.process([input], left, right);
    expect(left[0]).toBeGreaterThan(0.99); expect(left[127]).toBeLessThan(1);
    for (let i = 0; i < 80; i++) mixer.process([input], left, right);
    expect(left[127]).toBeLessThan(1e-8);
  });
  it('retains a cleared source in the shared tail and makes a full reset repeatable', () => {
    const plan = prepareRoom({ ...definition, lateGain: 1, decaySeconds: 1.5 }, 12000);
    const mixer = new RoomMixer(plan, { capacity: 1 });
    const pose = prepareRoomSource(plan, listener, source);
    const input = new Float32Array(128), left = input.slice(), right = input.slice(); input[0] = 1;
    mixer.setSource(0, pose); mixer.process([input], left, right);
    for (let i = 0; i < 10; i++) mixer.process([], left, right);
    mixer.clearSource(0);
    let energy = 0;
    for (let i = 0; i < 20; i++) {
      mixer.process([], left, right);
      for (let j = 0; j < 128; j++) energy += left[j] ** 2 + right[j] ** 2;
    }
    expect(energy).toBeGreaterThan(1e-6);
    mixer.reset();
    for (let i = 0; i < 20; i++) {
      mixer.process([], left, right); expect(left.every(x => x === 0) && right.every(x => x === 0)).toBe(true);
    }
    mixer.setSource(0, pose);
    const output = new Float32Array(128 * 30 * 2);
    for (let pass = 0; pass < 2; pass++) {
      mixer.reset();
      for (let block = 0; block < 30; block++) {
        mixer.process(block === 0 ? [input] : [], left, right);
        for (let i = 0; i < 128; i++) {
          const at = (block * 128 + i) * 2;
          if (pass === 0) { output[at] = left[i]; output[at + 1] = right[i]; }
          else { expect(left[i]).toBe(output[at]); expect(right[i]).toBe(output[at + 1]); }
        }
      }
    }
  });
  it('rejects a whole invalid control message and overlapping buffers before mutating state', () => {
    const mixer = new RoomMixer(room, { capacity: 1 }), reference = new RoomMixer(room, { capacity: 1 });
    mixer.setSource(0, isolated(10)); reference.setSource(0, isolated(10));
    const input = new Float32Array(128).fill(0.3), left = input.slice().fill(42), right = left.slice();
    const wantedLeft = input.slice(), wantedRight = input.slice();
    const invalid = { ...target, late: { delayFrames: -1, gain: 0 } };
    expect(() => mixer.setSource(0, invalid)).toThrow();
    expect(() => mixer.setSource(0, { ...target, roomKey: 'different' })).toThrow();
    expect(() => mixer.setSource(0, { ...target, reflections: target.reflections.slice(1) })).toThrow();
    expect(() => mixer.setSource(0, { ...target, direct: { ...target.direct, sampleRate: 48000 } })).toThrow();
    expect(() => mixer.process([input], left, left)).toThrow();
    expect(() => mixer.process([left], left, right)).toThrow();
    const shared = new Float32Array(256);
    expect(() => mixer.process([input], shared.subarray(0, 128), shared.subarray(64, 192))).toThrow();
    expect(() => mixer.process([input.slice(0, 12)], left, right)).toThrow();
    expect(() => mixer.process([input, input], left, right)).toThrow();
    expect(() => mixer.process([input], left, right, 0)).toThrow();
    expect(left.every(x => x === 42)).toBe(true);
    mixer.process([input], left, right, 64); reference.process([input], wantedLeft, wantedRight, 64);
    expect(left.slice(0, 64)).toEqual(wantedLeft.slice(0, 64));
    expect(right.slice(0, 64)).toEqual(wantedRight.slice(0, 64));
    expect(left[64]).toBe(42);
  });
  it('recovers invalid inputs and reports finite overload without limiting the signal', () => {
    const plan = prepareRoom({ ...definition, lateGain: 1, decaySeconds: 0.05 }, 12000);
    const mixer = new RoomMixer(plan, { capacity: 1 });
    mixer.setSource(0, prepareRoomSource(plan, listener, { ...source, gain: 16 }));
    const input = new Float32Array(128).fill(1), left = input.slice(), right = input.slice();
    input[0] = NaN; input[1] = Infinity; mixer.process([input], left, right);
    expect(mixer.invalidSamples).toBe(2); expect(mixer.overloadFrames).toBeGreaterThan(0);
    expect(mixer.peak).toBeGreaterThan(1);
    input.fill(3e38);
    for (let i = 0; i < 50; i++) mixer.process([input], left, right);
    expect(mixer.invalidOutputSamples).toBeGreaterThan(0);
    expect(mixer.invalidTailSamples).toBeGreaterThan(0);
    expect(left.every(Number.isFinite) && right.every(Number.isFinite)).toBe(true);
    for (let i = 0; i < 1000; i++) mixer.process([], left, right);
    expect(left.every(x => Math.abs(x) < 1e-8) && right.every(x => Math.abs(x) < 1e-8)).toBe(true);
    mixer.reset(); expect(mixer.invalidSamples + mixer.invalidOutputSamples + mixer.invalidTailSamples + mixer.peak).toBe(0);
  });
  it('removes room energy when every wall absorbs completely', () => {
    const walls = Object.fromEntries(Object.keys(room.walls).map(wall => [wall, { reflection: 0, damping: 0 }]));
    const plan = prepareRoom({ ...definition, walls, lateGain: 1 }, 12000);
    const mixer = new RoomMixer(plan, { capacity: 1 });
    mixer.setSource(0, prepareRoomSource(plan, listener, source));
    const input = new Float32Array(128), left = input.slice(), right = input.slice(); input[0] = 1;
    mixer.process([input], left, right); expect(left[0]).toBeCloseTo(Math.SQRT1_2);
    expect(left.slice(1).every(x => x === 0)).toBe(true);
    for (let i = 0; i < 200; i++) {
      mixer.process([], left, right); expect(left.every(x => x === 0) && right.every(x => x === 0)).toBe(true);
    }
  });
});
