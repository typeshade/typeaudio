// The checklist of experiment 8 on the two renders of the plan: the one-layer version and the layered
// render. Both arms call these functions, the CPU tier in Node (`harness.ts`, through `runTier`) and
// each page tier that renders the whole clip, so that the two arms cannot read the renders differently.

import type { Device } from 'typeshade/runtime';
import { checklist, DIMENSIONS, type ChecklistReport } from '../../src/analyze/index.ts';
import type { SoundPlan } from '../../src/plan/index.ts';
import { onePlan, renderPlan, SAMPLE_RATE, type Rendered } from '../../src/render-plan.ts';

/** One rule of one arm: the measure, and whether each render meets it (null where it is not measurable). */
export interface Verdict {
  dimension: string;
  measure: string;
  oneLayer: boolean | null;
  layered: boolean | null;
}

/** What the checklist step writes for a tier that rendered the whole clip. */
export interface Scores {
  events: { oneLayer: number; layered: number };
  oneLayerMaster: Rendered['master'];
  checklist: { oneLayer: ChecklistReport; layered: ChecklistReport };
  verdicts: Verdict[];
}

/**
 * The one-layer version of `sound` (`onePlan`), rendered without the spatial chain, the guards and the
 * reverb: its master is the raw sum. `dev` renders it, on the tier that runs the caller.
 */
export async function renderOneLayer(
  dev: Device,
  sound: SoundPlan,
): Promise<{ flat: SoundPlan; one: Rendered }> {
  const flat = onePlan(sound);
  const one = await renderPlan(dev, flat, { spatial: false, guards: false });
  return { flat, one };
}

/**
 * Scores the one-layer render and the layered render on the eight dimensions. The inputs are the
 * mix (the master's output), the stems and the dry render (the stems summed) of each render, and the
 * plan's picture times (the checklist's default).
 */
export function scoreRenders(
  sound: SoundPlan,
  flat: SoundPlan,
  one: Rendered,
  layered: Rendered,
): Scores {
  const oneLayer = checklist({
    channels: one.mix,
    sampleRate: SAMPLE_RATE,
    plan: flat,
    stems: one.stems,
    dry: one.dry,
  });
  const lay = checklist({
    channels: layered.mix,
    sampleRate: SAMPLE_RATE,
    plan: sound,
    stems: layered.stems,
    dry: layered.dry,
  });
  // Which rules the one-layer render fails and the layered render meets, and the rest.
  const verdicts: Verdict[] = [];
  for (const d of DIMENSIONS)
    for (const rule of lay[d].rules) {
      const other = oneLayer[d].rules.find((r) => r.measure === rule.measure);
      verdicts.push({
        dimension: d,
        measure: rule.measure,
        oneLayer: other?.met ?? null,
        layered: rule.met,
      });
    }
  return {
    events: { oneLayer: flat.events.length, layered: sound.events.length },
    oneLayerMaster: one.master,
    checklist: { oneLayer, layered: lay },
    verdicts,
  };
}
