import { describe, expect, test } from 'vitest';
import { limiterGain, normalizationGain } from '../src/master.ts';
import { integratedLoudness, truePeak } from '../src/analyze/index.ts';

// The master of the layered render: the loudness gain and the look-ahead true-peak limiter, held to
// synthetic signals whose answer is known.

const SR = 48000;
const at = (seconds: number): number => Math.round(seconds * SR);

describe('the master', () => {
  /** A signal with overshoots between its samples: a sine at a quarter of the rate, 45 degrees, whose samples reach 1.12 and whose true peak is 1.58 (+4 dBFS). */
  const overshoot = (seconds: number): Float32Array =>
    Float32Array.from({ length: at(seconds) }, (_, i) => {
      const burst = Math.floor(i / 12000) % 2 === 0 ? 1 : 0.1;
      return burst * 1.58 * Math.sin((Math.PI / 2) * i + Math.PI / 4);
    });

  test('the limiter never lets the true peak pass its ceiling, on a synthetic overshoot', () => {
    const x = overshoot(1.5);
    expect(truePeak([x])).toBeGreaterThan(3);
    for (const ceiling of [-1, -3, -0.5]) {
      const g = limiterGain([x, x], SR, ceiling);
      const y = x.map((v, i) => v * g[i]!);
      expect(truePeak([y, y])).toBeLessThanOrEqual(ceiling);
      // It limits, and does not squash what was under the ceiling: the quiet bursts keep most of their level.
      // The true peak is 1.58 (+4 dBFS), so the gain needs to reach 10^(ceiling / 20) / 1.58.
      expect(Math.min(...g)).toBeLessThan((10 ** (ceiling / 20) / 1.58) * 1.05);
      expect(g[12000 + 6000]).toBeGreaterThan(Math.min(...g));
    }
    const quiet = x.map((v) => v * 0.05);
    const g = limiterGain([quiet], SR, -1);
    expect(Math.min(...g)).toBe(1);
  });

  test('the normalization gain takes a tone to the target loudness', () => {
    const tone = Float32Array.from(
      { length: at(3) },
      (_, i) => 0.05 * Math.sin((2 * Math.PI * 1000 * i) / SR),
    );
    const gain = normalizationGain([tone, tone], SR, -23);
    const scaled = tone.map((v) => v * gain);
    expect(integratedLoudness([scaled, scaled], SR)).toBeCloseTo(-23, 2);
    expect(normalizationGain([new Float32Array(at(1))], SR, -23)).toBe(1);
  });
});
