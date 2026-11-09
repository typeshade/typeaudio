'use typeshade';

// The kind `cloth`: eight grains of experiment 6's `Grain`, short and high, drawn on the host from
// `Cloud`, through a one-pole lowpass that softens them. The grain source is a synthesized burst,
// as for `footstep`: a deviation of experiment 8.

import { Grain } from '../units/grain.shade.ts';
import { OnePole } from '../units/one-pole.shade.ts';

export class Cloth {
  age: u32 = 0;
  lp: OnePole = new OnePole(0.5);
  g0: Grain = new Grain(0, 1, 0, 0);
  g1: Grain = new Grain(0, 1, 0, 0);
  g2: Grain = new Grain(0, 1, 0, 0);
  g3: Grain = new Grain(0, 1, 0, 0);
  g4: Grain = new Grain(0, 1, 0, 0);
  g5: Grain = new Grain(0, 1, 0, 0);
  g6: Grain = new Grain(0, 1, 0, 0);
  g7: Grain = new Grain(0, 1, 0, 0);

  /** One sample: the sum of the grains at this frame, lowpassed. */
  tick(): f32 {
    const t = this.age;
    this.age = t + 1;
    const sum =
      this.g0.at(t) +
      this.g1.at(t) +
      this.g2.at(t) +
      this.g3.at(t) +
      this.g4.at(t) +
      this.g5.at(t) +
      this.g6.at(t) +
      this.g7.at(t);
    return this.lp.tick(sum);
  }
}
