import { describe, expect, it } from 'vitest';
import { DiffuseTail } from '../../src/spatial/room/DiffuseTail.ts';
import { prepareRoom, prepareRoomSource, RoomMixer } from '../../src/spatial/room/index.ts';
import { definition, isolated, listener, room, source } from './helpers.ts';

function tail(decaySeconds: number) {
  const dsp = new DiffuseTail(prepareRoom({ ...definition, lateGain: 1, decaySeconds }, 12000));
  const input = new Float32Array(128), left = input.slice(), right = input.slice();
  const energy = new Float64Array(6); let difference = 0;
  for (let at = 0; at < 72000; at += 128) {
    input.fill(0); if (at === 0) input[0] = 1;
    left.fill(0); right.fill(0);
    const count = Math.min(128, 72000 - at); dsp.mix(input, left, right, count);
    for (let i = 0; i < count; i++) {
      energy[Math.floor((at + i) / 12000)] += left[i] ** 2 + right[i] ** 2;
      difference += (left[i] - right[i]) ** 2;
    }
  }
  return { energy, difference, dsp };
}

describe('room damping and diffuse decay', () => {
  it('attenuates high frequencies on material reflections while keeping low frequencies', () => {
    const damped = prepareRoomSource(prepareRoom({ ...definition, walls: { xMin: { reflection: 0.5, damping: 1 } } }, room.sampleRate), listener, source);
    function energy(frequency: number, pole: number) {
      const mixer = new RoomMixer(room, { capacity: 1 }); mixer.setSource(0, isolated(30, pole));
      const input = new Float32Array(128), left = input.slice(), right = input.slice(); let sum = 0;
      for (let at = 0; at < 12800; at += 128) {
        for (let i = 0; i < 128; i++) input[i] = Math.sin(2 * Math.PI * frequency * (at + i) / room.sampleRate);
        mixer.process([input], left, right);
        if (at > 6400) for (const value of left) sum += value * value;
      }
      return sum;
    }
    const pole = damped.reflections[0].pole;
    expect(energy(50, pole) / energy(50, 0)).toBeGreaterThan(0.97);
    expect(energy(8000, pole) / energy(8000, 0)).toBeLessThan(0.01);
  });
  it('produces a stereo tail which loses energy and follows the decay override', () => {
    const short = tail(0.4), long = tail(1.6);
    expect(long.difference).toBeGreaterThan(0.01);
    expect(short.energy[0]).toBeGreaterThan(0.1);
    expect(long.energy[1]).toBeGreaterThan(short.energy[1] * 1000);
    for (let i = 1; i < 6; i++) expect(long.energy[i]).toBeLessThan(long.energy[i - 1]);
    expect(long.energy[3] / long.energy[0]).toBeLessThan(1e-9);
    expect(long.dsp.invalidSamples + short.dsp.invalidSamples).toBe(0);
  });
  it('bounds feedback at the largest decay and recovers after a reset', () => {
    const long = tail(8);
    expect(long.energy[5]).toBeLessThan(long.energy[1]);
    expect(long.energy.every(Number.isFinite)).toBe(true);
    long.dsp.reset();
    const input = new Float32Array(128), left = input.slice(), right = input.slice();
    for (let i = 0; i < 100; i++) {
      long.dsp.mix(input, left, right, 128);
      expect(left.every(x => x === 0) && right.every(x => x === 0)).toBe(true);
    }
  });
});
