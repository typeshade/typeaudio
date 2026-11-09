// The host half of the retired `Cue` (`cue.shade.ts`): `makeCue` builds the lane of one event with
// `makeLane` (`src/kinds/make.ts`) and moves its unit into a `Cue`, for the scripts that measure the
// one-bank form (docs/lanes.md, steps 1 and 1b).

import type { PlanEvent } from '../../src/plan/types.ts';
import { KIND_INDEX, makeLane, type MakeOptions } from '../../src/kinds/make.ts';
import { Cue } from './cue.shade.ts';

export interface MadeCue {
  cue: Cue;
  /** How many frames the sound lasts. */
  length: number;
}

/** The `Cue` of `e`, with the unit of the event's kind and `kind` set. */
export function makeCue(e: PlanEvent, o: MakeOptions): MadeCue {
  const made = makeLane(e, o);
  const cue = new Cue();
  cue.kind = KIND_INDEX[made.kind];
  switch (made.kind) {
    case 'whoosh':
      cue.whoosh = made.lane.whoosh;
      break;
    case 'impact':
      cue.impact = made.lane.impact;
      break;
    case 'shimmer':
      cue.shimmer = made.lane.shimmer;
      break;
    case 'riser':
      cue.riser = made.lane.riser;
      break;
    case 'wind':
      cue.wind = made.lane.wind;
      break;
    case 'drone':
      cue.drone = made.lane.drone;
      break;
    case 'footstep':
      cue.footstep = made.lane.footstep;
      break;
    case 'cloth':
      cue.cloth = made.lane.cloth;
      break;
    case 'voice':
      cue.stem = made.lane.stem;
      break;
  }
  return { cue, length: made.length };
}
