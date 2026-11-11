// The cue sheet of experiment 11: each segment is a valid plan, the accepted passage stays out of
// the segments, every cue lies in one place that makes it, and `cues.md` matches `cues.json`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatePlan } from '../src/plan/index.ts';
import { cuesMarkdown } from '../experiments/11-full-video/cues-md.ts';
import { engineCues, readSheet, segmentPlan, TAIL } from '../experiments/11-full-video/draft.ts';
import { eventsOf, RECIPES } from '../experiments/11-full-video/recipes.ts';

const sheet = readSheet();

describe('experiment 11: the cue sheet', () => {
  it('makes each segment a plan that validatePlan accepts', () => {
    sheet.segments.forEach((seg, i) => {
      const plan = validatePlan(segmentPlan(sheet, i));
      expect(plan.clip.duration).toBeCloseTo(seg.to - seg.from + TAIL, 6);
      expect(plan.events.length).toBeGreaterThan(0);
    });
  });

  it('keeps the segments apart, in order, and outside the accepted passage', () => {
    const { from, to } = sheet.accepted;
    let end = 0;
    for (const seg of sheet.segments) {
      expect(seg.from).toBeGreaterThanOrEqual(end - 1e-9);
      expect(seg.to <= from + 1e-9 || seg.from >= to - 1e-9).toBe(true);
      end = seg.to;
    }
    expect(end).toBeLessThanOrEqual(sheet.end + 1e-9);
  });

  it('places every cue in its scene and makes it once', () => {
    const scenes = new Map(sheet.scenes.map((s) => [s.id, s]));
    const ids = new Set<string>();
    for (const cue of sheet.cues) {
      expect(ids.has(cue.id)).toBe(false);
      ids.add(cue.id);
      const scene = scenes.get(cue.scene)!;
      expect(scene).toBeDefined();
      expect(cue.t).toBeGreaterThanOrEqual(scene.from - 1e-9);
      expect(cue.t).toBeLessThan(scene.to);
      const makers = [cue.recipe, cue.store, cue.accepted].filter(Boolean).length;
      expect(makers).toBe(1);
      if (cue.accepted) {
        expect(cue.t).toBeGreaterThanOrEqual(sheet.accepted.from);
        expect(cue.t).toBeLessThan(sheet.accepted.to);
      } else if (cue.recipe) {
        expect(Object.keys(RECIPES)).toContain(cue.recipe);
        expect(sheet.segments.some((s) => cue.t >= s.from && cue.t < s.to)).toBe(true);
      }
    }
  });

  it('gives each recipe cue events of the engine with ids of their own', () => {
    for (const cue of engineCues(sheet)) {
      const events = eventsOf(cue);
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) expect(e.id.startsWith(`${cue.id}-`)).toBe(true);
    }
  });

  it('keeps cues.md the readable form of cues.json', () => {
    const file = join(import.meta.dirname, '..', 'experiments', '11-full-video', 'cues.md');
    expect(readFileSync(file, 'utf8')).toBe(cuesMarkdown(sheet));
  });
});
