// Experiment 7 on the CPU tier, in Node: `run.ts` bundles this file with Vite, the compiler's plugin
// and the compiler itself (`typescript` kept external, which Node loads from `node_modules`), and
// runs it with Node. It prints the result as JSON on stdout, and a line for each measure on stderr.
//
// The render and the loss are timed twice: through the host face, as an application imports the
// module (compiler surface §64), and through `compileModuleJs` of the compiled module, the same code
// generator at `f32`, where the derivatives are (`cpu.ts`).

import { readFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { measure, prepare, type CountResult, type Form } from './cpu.ts';
import { timed, type Repeats, type Timing } from './match.ts';
import { startOf, truthOf } from './patch.ts';
import * as patch3 from './patch-3.shade.ts';
import * as patch10 from './patch-10.shade.ts';
import * as patch30 from './patch-30.shade.ts';
import * as patch100 from './patch-100.shade.ts';

type Fn = (...args: unknown[]) => unknown;

export interface NodeOptions {
  readonly root: string;
  readonly counts: readonly number[];
  readonly forms: readonly Form[];
  readonly repeats: Repeats;
  /** The target of each count, from the runner's oracle: 16 numbers. */
  readonly targets: Readonly<Record<string, readonly number[]>>;
}

/** The host face of each module: what an application that imports it calls. */
const FACES: Record<number, { render: Fn; loss: Fn }> = {
  3: { render: patch3.render as Fn, loss: patch3.loss as Fn },
  10: { render: patch10.render as Fn, loss: patch10.loss as Fn },
  30: { render: patch30.render as Fn, loss: patch30.loss as Fn },
  100: { render: patch100.render as Fn, loss: patch100.loss as Fn },
};

/** One count on the CPU tier: the measures of `cpu.ts`, the host face's times, and what agrees. */
export interface NodeCount extends CountResult {
  readonly hostFace: {
    readonly render: Timing;
    readonly loss: Timing;
    /** The host face's render and loss give the bits of `compileModuleJs`'s. */
    readonly sameRender: boolean;
    readonly sameLoss: boolean;
  };
  /** Node's own `logPower` of the known answer gives the runner's target bit for bit. */
  readonly sameTarget: boolean;
}

const options = JSON.parse(process.argv[2] ?? '{}') as NodeOptions;
const progress = (line: string): void => {
  process.stderr.write(`cpu ${line}\n`);
};
const counts: NodeCount[] = [];
for (const count of options.counts) {
  const source = readFileSync(join(options.root, `experiments/07-sound-match/patch-${count}.shade.ts`), 'utf8');
  const given = options.targets[String(count)]!;
  const prep = prepare(source, count, given);
  const sameTarget = prep.ownTarget.flat().every((v, i) => Object.is(Math.fround(v), Math.fround(given[i]!)));
  const target = prep.target;
  const result = measure(prep, options.repeats, options.forms, progress);
  const face = FACES[count]!;
  const truth = truthOf(count);
  const start = startOf(count);
  const render = timed(options.repeats, () => face.render(...truth));
  const loss = timed(options.repeats, () => face.loss(...start, ...target));
  progress(`${count} host face: render ${render.median.toFixed(3)} ms, loss ${loss.median.toFixed(3)} ms`);
  const a = Array.from(face.render(...truth) as ArrayLike<number>);
  const b = Array.from(prep.render(...truth) as ArrayLike<number>);
  counts.push({
    ...result,
    hostFace: {
      render,
      loss,
      sameRender: a.length === b.length && a.every((v, i) => Object.is(Math.fround(v), Math.fround(b[i]!))),
      sameLoss: Object.is(Math.fround(face.loss(...start, ...target) as number), Math.fround(prep.loss(...start, ...target) as number)),
    },
    sameTarget,
  });
}
const cpu = cpus();
process.stdout.write(
  JSON.stringify({
    environment: { node: process.version, cpu: cpu[0]?.model ?? 'unknown', cores: cpu.length, os: `${platform()} ${release()}` },
    counts,
  }),
);
