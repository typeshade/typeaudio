// Experiment 7 on a CPU arm: the module's functions and their derivatives, run by the compiler's CPU
// code generator at `f32` precision (`compileModuleJs`), the generator the host face's CPU tier uses
// (compiler Rule 11.7, surface §64). The oracle arm runs this file in Bun; the Node arm runs it
// bundled with the compiler. A derivative is IR that `grad` adds to a module after the source
// compiled, so the host face of a `.shade.ts` file never holds one at the pin (change 0056, step 4,
// is not implemented): `compileModuleJs` of `grad`'s module is the nearest form of the CPU tier.

import { compile, compileModuleJs, grad, gradCheck, type GradCheckResult, type ModuleDecl } from 'typeshade';
import { Adam, gradientDistance, timed, withLoopInitsHoisted, type Repeats, type Timing } from './match.ts';
import { namesOf, startOf, truthOf } from './patch.ts';

type Fn = (...args: unknown[]) => unknown;

/** The four ways a gradient is taken, each a function of the parameters. */
export const FORMS = ['forward', 'along', 'reverse', 'probe'] as const;
export type Form = (typeof FORMS)[number];

/** A module compiled once, with its derivatives and the target its loss is held to. */
export interface Prepared {
  readonly count: number;
  readonly names: readonly string[];
  readonly module: ModuleDecl;
  /** The target the loss is held to, four bins to a vector: `logPower` of the known answer. */
  readonly target: readonly (readonly number[])[];
  /** This arm's own `logPower` of the known answer, which is the target unless one was given. */
  readonly ownTarget: readonly (readonly number[])[];
  readonly render: Fn;
  readonly loss: Fn;
  readonly gradient: Readonly<Record<Form, (params: readonly number[]) => number[]>>;
  /** What building the derivatives cost, and what they are. */
  readonly codegen: Codegen;
}

export interface Codegen {
  /** Milliseconds of the `grad` calls of each form, and of `compileModuleJs` of its module. */
  readonly gradMs: Readonly<Record<Form, number>>;
  readonly compileMs: Readonly<Record<Form, number>>;
  /** The functions `grad` added for each form, the helpers it generated included. */
  readonly added: Readonly<Record<Form, number>>;
  /** Reverse mode's report of the function memory its tape takes in one call. */
  readonly tapeBytes: number;
  /** The loop headers the probe rewrote. */
  readonly rewritten: number;
}

const now = (): number => performance.now();

/**
 * Compiles `source`, the module of `count` parameters, and builds the derivatives of its loss. The
 * loss is held to `given`, sixteen numbers, or to this arm's own `logPower` of the known answer.
 */
export function prepare(source: string, count: number, given?: readonly number[]): Prepared {
  const compiled = compile(source);
  const errors = compiled.diagnostics.filter((d) => d.category === 'error');
  if (errors.length > 0) throw new Error(`the module of ${count} parameters does not compile: ${errors.map((d) => d.message).join('; ')}`);
  const m = compiled.module;
  const names = namesOf(count);
  const base = compileModuleJs(m, { precision: 'f32' });
  const ownTarget = (base.fns['logPower'] as Fn)(...truthOf(count)) as number[][];
  const target = given === undefined ? ownTarget : [0, 1, 2, 3].map((g) => given.slice(4 * g, 4 * g + 4));
  const gradMs = {} as Record<Form, number>;
  const compileMs = {} as Record<Form, number>;
  const added = {} as Record<Form, number>;
  const before = m.funcs.length;

  // Forward mode, as the method takes it: one derivative function for each parameter.
  let t = now();
  let fm = m;
  const perParameter: string[] = [];
  for (const w of names) {
    const d = grad(fm, 'loss', w);
    fm = d.module;
    perParameter.push(d.name);
  }
  gradMs.forward = now() - t;
  added.forward = fm.funcs.length - before;
  t = now();
  const forward = compileModuleJs(fm, { precision: 'f32' });
  compileMs.forward = now() - t;
  const forwardFns = perParameter.map((n) => forward.fns[n] as Fn);

  // Forward mode along a direction given as an argument: one function, one call for each parameter.
  t = now();
  const a = grad(m, 'lossAlong', 't');
  gradMs.along = now() - t;
  added.along = a.module.funcs.length - before;
  t = now();
  const along = compileModuleJs(a.module, { precision: 'f32' });
  compileMs.along = now() - t;
  const alongFn = along.fns[a.name] as Fn;

  // Reverse mode: one function, one call for the whole gradient.
  t = now();
  const r = grad(m, 'loss', names, { mode: 'reverse' });
  gradMs.reverse = now() - t;
  added.reverse = r.module.funcs.length - before;
  t = now();
  const reverse = compileModuleJs(r.module, { precision: 'f32' });
  compileMs.reverse = now() - t;
  const reverseFn = reverse.fns[r.name] as Fn;
  const fields = names.map((n) => r.adjoints![n]!);

  // The probe: reverse mode with its loop headers rewritten, so the generated code runs it.
  t = now();
  const p = withLoopInitsHoisted(r.module);
  gradMs.probe = gradMs.reverse + (now() - t);
  added.probe = added.reverse;
  t = now();
  const probe = compileModuleJs(p.module, { precision: 'f32' });
  compileMs.probe = now() - t;
  const probeFn = probe.fns[r.name] as Fn;

  const unit = (j: number): number[] => names.map((_, i) => (i === j ? 1 : 0));
  const units = names.map((_, j) => unit(j));
  return {
    count,
    names,
    module: m,
    target,
    ownTarget,
    render: base.fns['render'] as Fn,
    loss: base.fns['loss'] as Fn,
    gradient: {
      forward: (q) => forwardFns.map((f) => f(...q, ...target) as number),
      along: (q) => units.map((u) => alongFn(0, ...q, ...u, ...target) as number),
      reverse: (q) => {
        const o = reverseFn(...q, ...target, 1) as Record<string, number>;
        return fields.map((f) => o[f]!);
      },
      probe: (q) => {
        const o = probeFn(...q, ...target, 1) as Record<string, number>;
        return fields.map((f) => o[f]!);
      },
    },
    codegen: { gradMs, compileMs, added, tapeBytes: r.tapeBytes ?? 0, rewritten: p.rewritten },
  };
}

/** The measures of one parameter count on one CPU arm. */
export interface CountResult {
  readonly count: number;
  readonly codegen: Codegen;
  /** The render alone, at the known answer. */
  readonly render: Timing;
  /** The loss alone, at the start. */
  readonly loss: Timing;
  /** One step of the descent with the gradient of each form: the gradient, then Adam's update. */
  readonly steps: Readonly<Partial<Record<Form, Timing>>>;
  readonly lossAtStart: number;
  /** Each form's gradient at the start, and how far it is from forward mode's. */
  readonly gradients: Readonly<Partial<Record<Form, number[]>>>;
  readonly agreement: Readonly<Partial<Record<Form, { relative: number; differ: number }>>>;
}

/** Times the render, the loss and a step of each form in `forms`, as `repeats` says. */
export function measure(
  prep: Prepared,
  repeats: Repeats,
  forms: readonly Form[] = FORMS,
  progress: (line: string) => void = () => {},
): CountResult {
  const truth = truthOf(prep.count);
  const start = startOf(prep.count);
  const render = timed(repeats, () => prep.render(...truth));
  progress(`${prep.count} render: ${render.median.toFixed(3)} ms`);
  const loss = timed(repeats, () => prep.loss(...start, ...prep.target));
  progress(`${prep.count} loss: ${loss.median.toFixed(3)} ms`);
  const steps: Partial<Record<Form, Timing>> = {};
  const gradients: Partial<Record<Form, number[]>> = {};
  for (const form of forms) {
    gradients[form] = prep.gradient[form](start);
    const params = [...start];
    const adam = new Adam(prep.count);
    steps[form] = timed(repeats, () => adam.step(params, prep.gradient[form](params)));
    progress(`${prep.count} ${form} step: ${steps[form]!.median.toFixed(3)} ms`);
  }
  const agreement: Partial<Record<Form, { relative: number; differ: number }>> = {};
  for (const form of forms) {
    if (gradients.forward !== undefined) agreement[form] = gradientDistance(gradients.forward, gradients[form]!);
  }
  return {
    count: prep.count,
    codegen: prep.codegen,
    render,
    loss,
    steps,
    lossAtStart: prep.loss(...start, ...prep.target) as number,
    gradients,
    agreement,
  };
}

/** The descent of the method, step 3: Adam on forward mode's gradient from the start. */
export interface Descent {
  readonly iterations: number;
  readonly rate: number;
  readonly start: readonly number[];
  readonly truth: readonly number[];
  /** The loss before each step, and after the last. */
  readonly losses: readonly number[];
  /** The parameters after the last step. */
  readonly final: readonly number[];
}

export function descend(prep: Prepared, iterations: number, form: Form = 'forward', rate = 0.01): Descent {
  const start = startOf(prep.count);
  const params = [...start];
  const adam = new Adam(prep.count, rate);
  const losses: number[] = [];
  for (let i = 0; i < iterations; i++) {
    losses.push(prep.loss(...params, ...prep.target) as number);
    adam.step(params, prep.gradient[form](params));
  }
  losses.push(prep.loss(...params, ...prep.target) as number);
  return { iterations, rate, start, truth: truthOf(prep.count), losses, final: params };
}

/** `gradCheck` of the loss in both modes, at the start and halfway to the known answer. */
export function checks(prep: Prepared): { at: number[][]; forward: GradCheckResult; reverse: GradCheckResult } {
  const start = startOf(prep.count);
  const truth = truthOf(prep.count);
  const half = start.map((s, i) => (s + truth[i]!) / 2);
  const at = [start, half];
  const points = at.map((p) => [...p, ...prep.target]);
  return {
    at,
    forward: gradCheck(prep.module, 'loss', { wrt: [...prep.names], at: points, mode: 'forward' }),
    reverse: gradCheck(prep.module, 'loss', { wrt: [...prep.names], at: points, mode: 'reverse' }),
  };
}
