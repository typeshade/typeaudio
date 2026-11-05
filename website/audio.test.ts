import { describe, it, expect } from 'vitest';
import { fade, wav, frequencies } from './audio.ts';
describe('playback and export', () => {
  it('fades both edges without mutating the rendered samples', () => {
    const raw = new Float32Array(2000).fill(0.25);
    const out = fade(raw, 48000);
    expect(out[0]).toBe(0); expect(out[1999]).toBe(0);
    expect(out[1000]).toBe(0.25); expect(raw[0]).toBe(0.25);
    expect(out.every(Number.isFinite)).toBe(true);
  });
  it('writes a playable mono PCM header and saturates extreme samples', () => {
    const view = new DataView(wav(new Float32Array([-2, 0, 2]), 48000));
    expect(view.byteLength).toBe(50);
    expect(view.getUint32(4,true)).toBe(42);
    expect(view.getUint32(24,true)).toBe(48000);
    expect(view.getUint32(40,true)).toBe(6);
    expect(view.getInt16(44,true)).toBe(-32768);
    expect(view.getInt16(46,true)).toBe(0);
    expect(view.getInt16(48,true)).toBe(32767);
  });
  it('uses musical fifths for the bright preset', () => {
    const values = frequencies({preset:'bright',frequency:220,voices:4,cutoff:1600,drive:1,duration:1,backend:'cpu'});
    expect(values[0]).toBe(220); expect(values[2]).toBe(440);
    expect(values[1]).toBeCloseTo(329.6276, 3);
  });
});
