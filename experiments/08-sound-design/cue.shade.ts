'use typeshade';

// The retired one-bank form of the kinds (docs/lanes.md, "Step 2"): one `Cue` holds the unit of every
// kind and one kernel dispatches on `kind` in the frame loop. The render no longer uses it
// (`src/kinds/lanes.shade.ts` has one bank and one kernel for each kind). It stays here so that the
// measurements of docs/lanes.md steps 1 and 1b (`run-split.ts`, `run-overhead.ts`) can run again.
//
// One event as one lane. A `Cue` holds the unit of every kind by its fields (static composition,
// as `Voice` holds its oscillator and filter) and the kind it plays, so that one bank of cues
// renders every event of a plan with one kernel, whatever the kinds. Only the unit of the cue's
// kind ticks. A cue is silent before `start` and from `end` on, in frames from the start of the clip.

import { Whoosh } from '../../src/kinds/whoosh.shade.ts';
import { Impact } from '../../src/kinds/impact.shade.ts';
import { Shimmer } from '../../src/kinds/shimmer.shade.ts';
import { Riser } from '../../src/kinds/riser.shade.ts';
import { Wind } from '../../src/kinds/wind.shade.ts';
import { Drone } from '../../src/kinds/drone.shade.ts';
import { Footstep } from '../../src/kinds/footstep.shade.ts';
import { Cloth } from '../../src/kinds/cloth.shade.ts';
import { Stem } from '../../src/kinds/voice.shade.ts';

export class Cue {
  /** The frame the next tick plays. */
  t: u32 = 0;
  /** The first frame that sounds. */
  start: u32 = 0;
  /** The first frame that is silent again. */
  end: u32 = 0;
  /** The kind: 0 whoosh, 1 impact, 2 shimmer, 3 riser, 4 wind, 5 drone, 6 footstep, 7 cloth, 8 voice. */
  kind: u32 = 0;
  whoosh: Whoosh = new Whoosh();
  impact: Impact = new Impact();
  shimmer: Shimmer = new Shimmer();
  riser: Riser = new Riser();
  wind: Wind = new Wind();
  drone: Drone = new Drone();
  footstep: Footstep = new Footstep();
  cloth: Cloth = new Cloth();
  stem: Stem = new Stem();

  /** One sample; `x` is the event's input stem at this frame, which only `voice` reads. */
  tick(x: f32): f32 {
    const t = this.t;
    this.t = t + 1;
    if (t < this.start || t >= this.end) {
      return 0;
    }
    const k = this.kind;
    if (k == 0) {
      return this.whoosh.tick();
    }
    if (k == 1) {
      return this.impact.tick();
    }
    if (k == 2) {
      return this.shimmer.tick();
    }
    if (k == 3) {
      return this.riser.tick();
    }
    if (k == 4) {
      return this.wind.tick();
    }
    if (k == 5) {
      return this.drone.tick();
    }
    if (k == 6) {
      return this.footstep.tick();
    }
    if (k == 7) {
      return this.cloth.tick();
    }
    return this.stem.at(x);
  }
}

/**
 * Renders one block of every cue of the bank, one lane per cue (shape V): lane `v` writes its
 * `block` frames to `out[v * block + n]`. `inputs` holds the stems, laid out the same way.
 */
export function cues(out: array<f32>, lanes: array<Cue>, inputs: array<f32>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = lanes[v].tick(inputs[v * block + n]);
    }
  }
}
