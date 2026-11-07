import { describe, expect, it } from 'vitest';
import { ReflectionTap } from '../../src/spatial/room/ReflectionTap.ts';

describe('moving reflection delay', () => {
  it('interpolates a fractional delay across the ring boundary', () => {
    const buffer = Float32Array.from({ length: 16 }, (_, i) => i);
    const tap = new ReflectionTap(1, 8);
    tap.set(1.25, 1, 0, 0); tap.reset();
    expect(tap.tick(buffer, 1)).toBe(15 * 0.25);
    expect(tap.tick(buffer, 4)).toBe(2.75);
  });
  it('crossfades fixed reads and coalesces updates without restarting a running transition', () => {
    const buffer = Float32Array.from({ length: 64 }, (_, i) => Math.cos(i * 0.4));
    const tap = new ReflectionTap(1, 8);
    tap.set(0, 1, 0, 0); tap.reset();
    tap.set(17, 1, 0, 0);
    let previous = buffer[32];
    for (let i = 0; i < 16; i++) {
      if (i === 3) tap.set(8, 1, 0, 0);
      if (i === 4) tap.set(10, 1, 0, 0);
      const fraction = (i % 8 + 1) / 8;
      const expected = i < 8 ? buffer[32] * (1 - fraction) + buffer[15] * fraction
        : buffer[15] * (1 - fraction) + buffer[22] * fraction;
      const sample = tap.tick(buffer, 32);
      expect(sample).toBeCloseTo(expected, 12);
      expect(Math.abs(sample - previous)).toBeLessThanOrEqual(0.25);
      previous = sample;
    }
    expect(tap.tick(buffer, 32)).toBe(buffer[22]);
    tap.set(3, 0.5, 0, 0); tap.reset();
    expect(tap.tick(buffer, 32)).toBe(buffer[29]);
    expect(tap.left).toBe(0.5);
  });
});
