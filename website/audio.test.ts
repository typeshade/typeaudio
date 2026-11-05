import { describe, it, expect } from 'vitest';
import { wav } from './audio.ts';
describe('playback and export', () => {
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
});
