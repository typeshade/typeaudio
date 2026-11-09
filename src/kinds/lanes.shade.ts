'use typeshade';

// One event as one lane, one bank and one kernel for each kind (docs/lanes.md, "Step 1" and
// "Step 1b", and the owner's decision of 2026-11-09). A lane holds its clock (`t`, `start`, `end`),
// and the unit of its own kind only. A kernel of shape V takes the
// lane's element into a local before the frame loop, ticks it for each frame of the block and
// writes it back once. Each kernel writes its own `out`, lane `v` to row `v`: an index made from
// `v` alone, which the compiler proves disjoint (it refuses `base + v` and `rows[v]`, TS8070, so
// the lane's row in `raws` is not the write index). `gather` then copies each event's row to its
// place in `raws`. A lane is silent before `start` and from `end` on, in frames from the start of the clip.

import { Whoosh } from './whoosh.shade.ts';
import { Impact } from './impact.shade.ts';
import { Shimmer } from './shimmer.shade.ts';
import { Riser } from './riser.shade.ts';
import { Wind } from './wind.shade.ts';
import { Drone } from './drone.shade.ts';
import { Footstep } from './footstep.shade.ts';
import { Cloth } from './cloth.shade.ts';
import { Stem } from './voice.shade.ts';

/** The clock of a lane. Each kind's lane extends it with the unit of that kind. */
export class Lane {
  /** The frame the next tick plays. */
  t: u32 = 0;
  /** The first frame that sounds. */
  start: u32 = 0;
  /** The first frame that is silent again. */
  end: u32 = 0;

  /** Advances the clock one frame and tells whether this frame sounds. */
  live(): bool {
    const t = this.t;
    this.t = t + 1;
    return t >= this.start && t < this.end;
  }
}

export class WhooshLane extends Lane {
  whoosh: Whoosh = new Whoosh();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.whoosh.tick();
  }
}

/** Renders one block of every whoosh lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function whooshes(out: array<f32>, lanes: array<WhooshLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class ImpactLane extends Lane {
  impact: Impact = new Impact();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.impact.tick();
  }
}

/** Renders one block of every impact lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function impacts(out: array<f32>, lanes: array<ImpactLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class ShimmerLane extends Lane {
  shimmer: Shimmer = new Shimmer();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.shimmer.tick();
  }
}

/** Renders one block of every shimmer lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function shimmers(out: array<f32>, lanes: array<ShimmerLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class RiserLane extends Lane {
  riser: Riser = new Riser();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.riser.tick();
  }
}

/** Renders one block of every riser lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function risers(out: array<f32>, lanes: array<RiserLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class WindLane extends Lane {
  wind: Wind = new Wind();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.wind.tick();
  }
}

/** Renders one block of every wind lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function winds(out: array<f32>, lanes: array<WindLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class DroneLane extends Lane {
  drone: Drone = new Drone();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.drone.tick();
  }
}

/** Renders one block of every drone lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function drones(out: array<f32>, lanes: array<DroneLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class FootstepLane extends Lane {
  footstep: Footstep = new Footstep();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.footstep.tick();
  }
}

/** Renders one block of every footstep lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function footsteps(out: array<f32>, lanes: array<FootstepLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class ClothLane extends Lane {
  cloth: Cloth = new Cloth();

  /** One sample. */
  tick(): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.cloth.tick();
  }
}

/** Renders one block of every cloth lane of the bank: lane `v` writes its `block` frames to `out[v * block + n]`. */
export function cloths(out: array<f32>, lanes: array<ClothLane>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick();
    }
    lanes[v] = c;
  }
}

export class VoiceLane extends Lane {
  stem: Stem = new Stem();

  /** One sample; `x` is the event's input stem at this frame. */
  tick(x: f32): f32 {
    if (!this.live()) {
      return 0;
    }
    return this.stem.at(x);
  }
}

/** Renders one block of every voice lane of the bank; `inputs` holds the lanes' stems, laid out as `out` is. */
export function voices(out: array<f32>, lanes: array<VoiceLane>, inputs: array<f32>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick(inputs[v * block + n]);
    }
    lanes[v] = c;
  }
}

/**
 * Puts each event's block in its row of `raws`: event `i` reads the row `slots[i]` of the `out` of
 * its kind `kinds[i]` (`w0` whoosh, `w1` impact, `w2` shimmer, `w3` riser, `w4` wind, `w5` drone,
 * `w6` footstep, `w7` cloth, `w8` voice) and writes `raws[i * block + n]`. A kind with no event
 * gets any array: it is not read.
 */
export function gather(
  raws: array<f32>,
  kinds: array<u32>,
  slots: array<u32>,
  w0: array<f32>,
  w1: array<f32>,
  w2: array<f32>,
  w3: array<f32>,
  w4: array<f32>,
  w5: array<f32>,
  w6: array<f32>,
  w7: array<f32>,
  w8: array<f32>,
  block: u32,
) {
  for (let i: u32 = 0; i < kinds.length; i++) {
    const k = kinds[i];
    const r = slots[i] * block;
    for (let n: u32 = 0; n < block; n++) {
      let y: f32 = 0;
      if (k == 0) {
        y = w0[r + n];
      } else if (k == 1) {
        y = w1[r + n];
      } else if (k == 2) {
        y = w2[r + n];
      } else if (k == 3) {
        y = w3[r + n];
      } else if (k == 4) {
        y = w4[r + n];
      } else if (k == 5) {
        y = w5[r + n];
      } else if (k == 6) {
        y = w6[r + n];
      } else if (k == 7) {
        y = w7[r + n];
      } else {
        y = w8[r + n];
      }
      raws[i * block + n] = y;
    }
  }
}
