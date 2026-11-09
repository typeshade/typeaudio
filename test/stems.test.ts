import { describe, expect, test } from 'vitest';
import { eventKey } from '../src/kinds/make.ts';
import { eventSimilarity } from '../src/analyze/similarity.ts';
import { speechStem } from '../experiments/08-sound-design/stems.ts';

// The stand-in dialogue stems of experiment 8 differ by event. Before this, every `voice` event
// read the same stem, and the `variation` of the layered render measured 1.000 for the pair.

const SR = 16000;
const SECONDS = 1.2;

describe('speechStem', () => {
  test('gives two different stems for two events with different keys', () => {
    const a = speechStem(SECONDS, SR, eventKey(7, 'voice-1'));
    const b = speechStem(SECONDS, SR, eventKey(7, 'voice-2'));
    const s = eventSimilarity(a, b, SR);
    expect(s.similarity).toBeLessThan(0.95);
  });

  test('gives the same bits for the same key', () => {
    const a = speechStem(SECONDS, SR, eventKey(7, 'voice-1'));
    const b = speechStem(SECONDS, SR, eventKey(7, 'voice-1'));
    expect(a.length).toBe(b.length);
    expect(b).toEqual(a);
  });

  test('peaks at 0.3 and stays within its event length', () => {
    const a = speechStem(SECONDS, SR, eventKey(7, 'voice-1'));
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.3, 6);
    expect(a.length).toBeLessThanOrEqual(Math.round(SECONDS * SR));
    expect(a.length).toBeGreaterThanOrEqual(Math.round(0.9 * SECONDS * SR));
  });
});
