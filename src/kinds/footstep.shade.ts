'use typeshade';

// The kind `footstep`: eight grains of experiment 6's `Grain`, a thud and a crunch, drawn on the
// host from experiment 6's `Cloud` (`src/kinds/make.ts`). The repository holds no recorded step, so
// the grain source is a synthesized burst, a windowed sine: a deviation of experiment 8.

import { Grain } from '../units/grain.shade.ts';

export class Footstep {
  age: u32 = 0;
  g0: Grain = new Grain(0, 1, 0, 0);
  g1: Grain = new Grain(0, 1, 0, 0);
  g2: Grain = new Grain(0, 1, 0, 0);
  g3: Grain = new Grain(0, 1, 0, 0);
  g4: Grain = new Grain(0, 1, 0, 0);
  g5: Grain = new Grain(0, 1, 0, 0);
  g6: Grain = new Grain(0, 1, 0, 0);
  g7: Grain = new Grain(0, 1, 0, 0);

  /** One sample: the sum of the grains at this frame, in the order of the fields. */
  tick(): f32 {
    const t = this.age;
    this.age = t + 1;
    return (
      this.g0.at(t) +
      this.g1.at(t) +
      this.g2.at(t) +
      this.g3.at(t) +
      this.g4.at(t) +
      this.g5.at(t) +
      this.g6.at(t) +
      this.g7.at(t)
    );
  }
}
