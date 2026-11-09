'use typeshade';

// Scratch forms of the `cues` kernel, to find the per-lane, per-frame overhead (docs/lanes.md,
// "Step 1b: the overhead"). They are not used by the render. `cues` itself is in
// `src/kinds/cue.shade.ts`.
//
// - `cuesHoisted`: the same loop, with the lane's `Cue` copied into a local before the frame loop
//   and written back once after it.
// - `cuesWide`: the full `Cue` in the bank, but the kernel ticks its `whoosh` field directly: no `t`,
//   `start`, `end` or `kind` is read, so the width of the struct stays and the dispatch goes.
// - `cuesOneBranch`: the full `Cue`, with the window check and the dispatch written in the kernel,
//   and only the `whoosh` branch present: the other eight kinds are not called.
// - `cuesInlined`: the dispatch of `Cue.tick` written out in the kernel, all nine kinds present, with
//   no call of `Cue.tick`.
// - `NarrowCue` and `cuesNarrow`: a cue that holds the fields of the `whoosh` kind only and calls
//   its tick with no dispatch on `kind`.

import { Cue } from '../../src/kinds/cue.shade.ts';
import { Whoosh } from '../../src/kinds/whoosh.shade.ts';

export function cuesHoisted(out: array<f32>, lanes: array<Cue>, inputs: array<f32>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    let c = lanes[v];
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = c.tick(inputs[v * block + n]);
    }
    lanes[v] = c;
  }
}

export function cuesWide(out: array<f32>, lanes: array<Cue>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = lanes[v].whoosh.tick();
    }
  }
}

export function cuesOneBranch(out: array<f32>, lanes: array<Cue>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      const t = lanes[v].t;
      lanes[v].t = t + 1;
      let y: f32 = 0;
      if (t >= lanes[v].start && t < lanes[v].end && lanes[v].kind == 0) {
        y = lanes[v].whoosh.tick();
      }
      out[v * block + n] = y;
    }
  }
}

export function cuesInlined(out: array<f32>, lanes: array<Cue>, inputs: array<f32>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      const t = lanes[v].t;
      lanes[v].t = t + 1;
      let y: f32 = 0;
      if (t >= lanes[v].start && t < lanes[v].end) {
        const k = lanes[v].kind;
        if (k == 0) {
          y = lanes[v].whoosh.tick();
        } else if (k == 1) {
          y = lanes[v].impact.tick();
        } else if (k == 2) {
          y = lanes[v].shimmer.tick();
        } else if (k == 3) {
          y = lanes[v].riser.tick();
        } else if (k == 4) {
          y = lanes[v].wind.tick();
        } else if (k == 5) {
          y = lanes[v].drone.tick();
        } else if (k == 6) {
          y = lanes[v].footstep.tick();
        } else if (k == 7) {
          y = lanes[v].cloth.tick();
        } else {
          y = lanes[v].stem.at(inputs[v * block + n]);
        }
      }
      out[v * block + n] = y;
    }
  }
}

export class NarrowCue {
  t: u32 = 0;
  start: u32 = 0;
  end: u32 = 0;
  whoosh: Whoosh = new Whoosh();

  tick(): f32 {
    const t = this.t;
    this.t = t + 1;
    if (t < this.start || t >= this.end) {
      return 0;
    }
    return this.whoosh.tick();
  }
}

export function cuesNarrow(out: array<f32>, lanes: array<NarrowCue>, block: u32) {
  for (let v: u32 = 0; v < lanes.length; v++) {
    for (let n: u32 = 0; n < block; n++) {
      out[v * block + n] = lanes[v].tick();
    }
  }
}
