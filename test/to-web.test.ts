// The site's project of the force passage (experiments/10-seven-questions/to-web.ts): each cue's
// function nodes pass the document's validation and the compile with its CPU audit, sound as the
// event's lane does, sit where the engine places the event, and have the engine's direct gain and pan.

import { describe, expect, it } from 'vitest';
import { compileFunctionGraph } from '../src/function-graph/compiler/index.ts';
import { FunctionGraphDsp } from '../src/function-graph/runtime/index.ts';
import { validateFunctionDocument } from '../src/function-graph/index.ts';
import type { FunctionGraphDocument } from '../src/function-graph/types.ts';
import {
  PASSAGE_NORMALIZE_DB,
  PATCH_VOLUME,
  PEAK_CEILING_DB,
  SAMPLE_RATE,
  directSum,
  editorDirect,
  engineDirect,
  forcePassageProject,
  laneOf,
  wallHitEvents,
  type WebCue,
} from '../experiments/10-seven-questions/to-web.ts';

function run(doc: FunctionGraphDocument, frames: number): Float32Array {
  const program = compileFunctionGraph(doc);
  for (const artifact of program.artifacts) new Function(artifact.code)();
  const dsp = new FunctionGraphDsp(program);
  const pcm = new Float32Array(frames);
  const out = new Float32Array(128);
  for (let at = 0; at < frames; at += 128) {
    const n = Math.min(128, frames - at);
    if (!dsp.process(out, n)) throw dsp.fault;
    pcm.set(out.subarray(0, n), at);
  }
  return pcm;
}

const { project, report } = forcePassageProject('test');
const scene = project.scene as {
  start: number;
  end: number;
  media: { kind: string; id: string };
  cues: WebCue[];
  space: { gainDb: number };
};

describe('the force passage as a project of the site', () => {
  it('holds the twelve events of the accepted wall hit, at the frames the render places them', () => {
    const events = wallHitEvents();
    expect(scene.cues.map((c) => c.id)).toEqual(events.map((e) => e.event.id));
    expect(scene.cues).toHaveLength(12);
    expect(scene.start).toBe(136.5);
    expect(scene.end).toBeCloseTo(152.2, 9);
    // Every onset of the hit snaps to the peak of motion at clip second 9.437458.
    for (const cue of scene.cues)
      expect(cue.time).toBe(136.5 + Math.round(9.437458 * SAMPLE_RATE) / SAMPLE_RATE);
  });

  it('refers to the picture by its YouTube id and holds no audio', () => {
    expect(scene.media).toEqual({
      kind: 'youtube',
      name: 'Frieren sound-design reference',
      id: 'YHCqcyX9N3s',
    });
    expect(project).not.toHaveProperty('audioAssets');
    for (const cue of scene.cues) expect(cue).not.toHaveProperty('audio');
  });

  it('gives every cue a function document that validates and compiles with its CPU audit', () => {
    for (const cue of scene.cues) {
      expect(() => validateFunctionDocument(cue.patch.functions)).not.toThrow();
      expect(compileFunctionGraph(cue.patch.functions).artifacts.length).toBeGreaterThan(0);
      expect(cue.patch.functions.parameters.length).toBeGreaterThan(0);
      expect(Object.keys(cue.patch.functionLayout as object).sort()).toEqual(
        cue.patch.functions.nodes.map((n) => n.id).sort(),
      );
    }
  });

  it('sounds as the engine lane of each event does, within 1e-4 of its peak', () => {
    const events = wallHitEvents();
    events.forEach((e, i) => {
      const cue = scene.cues[i]!;
      const made = laneOf(e);
      expect(cue.patch.duration).toBeCloseTo(made.length / SAMPLE_RATE, 9);
      const frames = Math.min(made.length, SAMPLE_RATE);
      const fn = run(cue.patch.functions, frames);
      const unit = Object.values(laneOf(e).lane).find(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { tick?: unknown }).tick === 'function',
      ) as { tick(): number };
      let worst = 0;
      let peak = 0;
      for (let t = 0; t < frames; t++) {
        const r = unit.tick();
        worst = Math.max(worst, Math.abs(fn[t]! - r));
        peak = Math.max(peak, Math.abs(r));
      }
      expect(peak, cue.id).toBeGreaterThan(0.001);
      expect(worst / peak, cue.id).toBeLessThan(1e-4);
    });
  }, 120_000);

  it('gives each cue the engine direct gain and pan', () => {
    const events = wallHitEvents();
    events.forEach((e, i) => {
      const cue = scene.cues[i]!;
      const engine = engineDirect(e.event);
      const editor = editorDirect(cue.space.points[0]!);
      expect(cue.gain * editor.left).toBeCloseTo(engine.left, 9);
      expect(cue.gain * editor.right).toBeCloseTo(engine.right, 9);
      expect(cue.patch.volume).toBe(PATCH_VOLUME);
    });
  });

  it('carries the master of the passage, less what keeps the direct sum at the ceiling', () => {
    const engineDb = PASSAGE_NORMALIZE_DB + 20 * Math.log10(1 / PATCH_VOLUME);
    expect(report.engineDb).toBeCloseTo(engineDb, 9);
    expect(scene.space.gainDb).toBeLessThanOrEqual(engineDb);
    const [l, r] = directSum(wallHitEvents(), scene.cues);
    let peak = 0;
    for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]!), Math.abs(r[i]!));
    const peakDb = 20 * Math.log10(peak) + scene.space.gainDb;
    expect(peakDb).toBeLessThanOrEqual(PEAK_CEILING_DB + 0.01);
    expect(peakDb).toBeGreaterThan(PEAK_CEILING_DB - 0.1);
  });
});
