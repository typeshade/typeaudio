import test from 'node:test';
import assert from 'node:assert/strict';
import { compareFeedback } from './compare-feedback.mjs';

const report = () => ({ format: 'typeaudio.feedback-report', version: 1, results: [{ fixture: 'tone.json', warm: {
  frames: 128, pcmHash: 'abc', peak: 0.5, rms: 0.1, invalidSamples: 0, updates: 2,
} }] });
test('candidate comparison detects missing cases, silence and changed samples', () => {
  assert.equal(compareFeedback(report(), report()), 1);
  assert.throws(() => compareFeedback({ ...report(), results: [] }, report()), /empty/);
  for (const field of ['pcmHash', 'frames', 'peak', 'rms', 'updates', 'invalidSamples']) {
    const broken = report();
    broken.results[0].warm[field] = field === 'pcmHash' ? 'different' : 0;
    if (field === 'invalidSamples') broken.results[0].warm[field] = 1;
    assert.throws(() => compareFeedback(report(), broken), /changed/);
  }
  const missing = report(); missing.results[0].fixture = 'another.json';
  assert.throws(() => compareFeedback(report(), missing), /corpus differs/);
});
