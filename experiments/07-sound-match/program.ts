// Experiment 7 on the GPU tiers: the program the page runs, built by the runner in Bun.
//
// At the pin a derivative reaches no GPU tier through the compiler's public path: the host face and
// the manifest carry no derivative (change 0056, step 4, is not implemented), and the WGSL and GLSL
// writers emit a function only for an entry that calls it, while no entry of a source can name a
// function `grad` adds after the source compiled. So the runner appends entries to the patch's source
// that call two placeholders, `lossAlongDt` and `adjoints`, compiles it, has `grad` build the two
// derivatives, gives each placeholder the body `grad` built, and packs the module with `packModule`.
// The page loads the pack with `typeshade/runtime`. This is a workaround of this experiment, not a
// path the compiler offers (docs/records/07-sound-match-container.md, "What departs from the method").

import type { CpuValue, FuncDecl, ModuleDecl, Pack, StructDecl } from 'typeshade';
import { compile, compileModuleJs, grad, packModule } from 'typeshade';
import { BINS, ENTRY, FORWARD_LANES, FRAMES, namesOf, patchSource } from './patch.ts';

/** The harness's entries and the two placeholders, appended to the patch's source. */
export function entriesSource(count: number): string {
  const names = namesOf(count);
  const groups = BINS / 4;
  const params = names.map((n) => `${n}: f32`).join(', ');
  const directions = names.map((n) => `d${n}: f32`).join(', ');
  const targets = Array.from({ length: groups }, (_, g) => `target${g}: vec4`).join(', ');
  const theta = names.map((_, i) => `theta[${i}]`).join(', ');
  const target = Array.from({ length: groups }, (_, g) => `target[${g}]`).join(', ');
  const unit = names.map((_, i) => `j == ${i} ? 1. : 0.`).join(', ');
  return `
// ---- The harness's entries: experiments/07-sound-match/program.ts appends them ----

/** The parameters of the patch, in the order the functions take them. */
declare const theta: storage<array<f32>>;
/** The target's analysis, four bins to a vector. */
declare const target: storage<array<vec4>>;
/** What an entry writes: the frames of the render, the loss, or the gradient. */
declare const out: storage<array<f32>, "read_write">;

/** The parameters of the patch. */
const COUNT: i32 = ${count};

/** A placeholder: the runner gives it the body of \`grad\`'s forward-mode derivative of \`lossAlong\` in \`t\`. */
function lossAlongDt(t: f32, ${params}, ${directions}, ${targets}): f32 {
  return 0.;
}

/** The gradient of the loss, one field for each parameter. */
interface Adjoints {
${names.map((n) => `  ${n}: f32;`).join('\n')}
}

/** A placeholder: the runner gives it the body of \`grad\`'s reverse-mode derivative of \`loss\`. */
function adjoints(${params}, ${targets}, dy: f32): Adjoints {
  return { ${names.map((n) => `${n}: 0.`).join(', ')} };
}

/** The render, by one invocation. */
export const ${ENTRY.render} = compute([1], function ${ENTRY.render}() {
  const y = render(${theta});
  for (let n: i32 = 0; n < FRAMES; n++) {
    out[n] = y[n];
  }
});

/**
 * The render, one invocation for each frame: frame \`n\` of segment \`j\`, by the expressions \`render\`
 * evaluates for it, so on one tier the frames are \`render\`'s bit for bit.
 */
export const ${ENTRY.frames} = compute([${FORWARD_LANES}], function ${ENTRY.frames}(gid: builtin<"global_invocation_id", vec3u>) {
  const n = i32(gid.x);
  if (n >= FRAMES) {
    return;
  }
  const j = ((n + 1) * SEGMENTS - 1) / FRAMES;
  const lo = level(j, ${names.slice(2).map((_, i) => `theta[${i + 2}]`).join(', ')});
  const hi = level(j + 1, ${names.slice(2).map((_, i) => `theta[${i + 2}]`).join(', ')});
  const first = (j * FRAMES) / SEGMENTS;
  const last = ((j + 1) * FRAMES) / SEGMENTS;
  const span = f32(last - first);
  const env = mix(lo, hi, f32(n - first) / span);
  out[n] = voice(n, env, theta[0], theta[1]);
});

/** The loss, by one invocation. */
export const ${ENTRY.loss} = compute([1], function ${ENTRY.loss}() {
  out[0] = loss(${theta}, ${target});
});

/** Forward mode: invocation \`j\` writes the derivative along parameter \`j\`. */
export const ${ENTRY.forward} = compute([${FORWARD_LANES}], function ${ENTRY.forward}(gid: builtin<"global_invocation_id", vec3u>) {
  const j = i32(gid.x);
  if (j >= COUNT) {
    return;
  }
  out[j] = lossAlongDt(0., ${theta}, ${unit}, ${target});
});

/** Reverse mode: one invocation writes the whole gradient. */
export const ${ENTRY.reverse} = compute([1], function ${ENTRY.reverse}() {
  const g = adjoints(${theta}, ${target}, 1.);
${names.map((n, i) => `  out[${i}] = g.${n};`).join('\n')}
});
`;
}

/** What the runner hands the page for one parameter count, and what it learned building it. */
export interface Program {
  readonly count: number;
  readonly pack: Pack;
  /** Reverse mode's report of the function memory its tape takes in one invocation. */
  readonly tapeBytes: number;
  /** The characters of the WGSL, and the entries that have a WebGL2 pass program. */
  readonly wgslChars: number;
  readonly glComputes: readonly string[];
  /** The source the runner compiled, the patch and the entries. */
  readonly source: string;
  /** The module after the swap, which the pack holds. */
  readonly module: ModuleDecl;
  readonly ms: { compile: number; grad: number; pack: number };
}

/** What the program's entries give on the oracle, which holds the swap to the CPU arms. */
export interface ProgramCheck {
  /** `renderEntry` and `framesEntry` give `render`'s frames bit for bit. */
  readonly render: boolean;
  readonly frames: boolean;
  /** `lossEntry` gives `loss` bit for bit. */
  readonly loss: boolean;
  /** `forwardStep` and `reverseStep` give the gradients the CPU arm's `along` and `reverse` give, bit for bit. */
  readonly forward: boolean;
  readonly reverse: boolean;
}

/**
 * Dispatches the program's entries on the oracle at `f32` (`compileModuleJs`), at `theta` with
 * `target`, and holds them to the CPU arm's values: the frames of `render`, the loss, and the
 * gradients of the forms `along` and `reverse`.
 */
export function checkProgram(
  p: Program,
  theta: readonly number[],
  target: readonly number[],
  expected: { frames: readonly number[]; loss: number; along: readonly number[]; reverse: readonly number[] },
): ProgramCheck {
  const cpu = compileModuleJs(p.module, { precision: 'f32' });
  const run = (entry: string, workgroups: number, size: number): number[] => {
    const out = new Array<number>(size).fill(0);
    cpu.setBinding('theta', [...theta] as CpuValue);
    cpu.setBinding('target', [0, 1, 2, 3].map((g) => target.slice(4 * g, 4 * g + 4)) as unknown as CpuValue);
    cpu.setBinding('out', out as CpuValue);
    cpu.dispatch(entry, workgroups);
    return out;
  };
  const same = (a: readonly number[], b: readonly number[]): boolean =>
    a.length === b.length && a.every((v, i) => Object.is(Math.fround(v), Math.fround(b[i]!)));
  const count = p.count;
  const size = Math.max(FRAMES, count);
  return {
    render: same(run(ENTRY.render, 1, size).slice(0, FRAMES), expected.frames),
    frames: same(run(ENTRY.frames, FRAMES / FORWARD_LANES, size).slice(0, FRAMES), expected.frames),
    loss: same(run(ENTRY.loss, 1, size).slice(0, 1), [expected.loss]),
    forward: same(run(ENTRY.forward, Math.ceil(count / FORWARD_LANES), size).slice(0, count), expected.along),
    reverse: same(run(ENTRY.reverse, 1, size).slice(0, count), expected.reverse),
  };
}

/** Every struct type named `from` in `node`, renamed `to`. */
function renamed<T>(node: T, from: string, to: string): T {
  if (Array.isArray(node)) return node.map((x) => renamed(x, from, to)) as T;
  if (node !== null && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (o['kind'] === 'struct' && o['name'] === from) return { ...o, name: to } as T;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, renamed(v, from, to)])) as T;
  }
  return node;
}

/** Builds the packed program of the patch with `count` parameters. */
export function buildProgram(count: number): Program {
  const source = patchSource(count) + entriesSource(count);
  let t = performance.now();
  const compiled = compile(source);
  const errors = compiled.diagnostics.filter((d) => d.category === 'error');
  if (errors.length > 0) throw new Error(`the program of ${count} parameters does not compile: ${errors.map((d) => d.message).join('; ')}`);
  const ms = { compile: performance.now() - t, grad: 0, pack: 0 };
  t = performance.now();
  const forward = grad(compiled.module, 'lossAlong', 't', { name: 'lossAlongDt_generated' });
  const reverse = grad(forward.module, 'loss', namesOf(count), { mode: 'reverse', name: 'adjoints_generated' });
  ms.grad = performance.now() - t;
  const m: ModuleDecl = reverse.module;
  const fn = (name: string): FuncDecl => {
    const f = m.funcs.find((g) => g.name === name);
    if (f === undefined) throw new Error(`program.ts: no function "${name}" after grad`);
    return f;
  };
  const generatedForward = fn('lossAlongDt_generated');
  const generatedReverse = fn('adjoints_generated');
  const ret = generatedReverse.ret as { kind: string; name?: string };
  if (ret.kind !== 'struct' || ret.name === undefined) throw new Error('program.ts: the reverse-mode derivative does not return a struct');
  const struct = (name: string): StructDecl => {
    const s = m.structs.find((x) => x.name === name);
    if (s === undefined) throw new Error(`program.ts: no struct "${name}"`);
    return s;
  };
  // The placeholder's struct must be the one `grad` made, field for field, for the body to fit it.
  const made = struct(ret.name);
  const declared = struct('Adjoints');
  const shape = (s: StructDecl): string => JSON.stringify(s.fields.map((f) => [f.name, f.type]));
  if (shape(made) !== shape(declared)) throw new Error(`program.ts: grad's struct ${ret.name} is not the placeholder's struct Adjoints`);
  for (const [name, field] of Object.entries(reverse.adjoints ?? {})) {
    if (name !== field) throw new Error(`program.ts: grad put the adjoint of "${name}" in the field "${field}"`);
  }
  const swapped: ModuleDecl = {
    ...m,
    structs: m.structs.filter((s) => s.name !== ret.name),
    funcs: m.funcs
      .filter((f) => f !== generatedForward && f !== generatedReverse)
      .map((f) =>
        f.name === 'lossAlongDt'
          ? { ...f, body: generatedForward.body }
          : f.name === 'adjoints'
            ? { ...f, body: renamed(generatedReverse.body, ret.name!, 'Adjoints') }
            : f,
      ),
  };
  t = performance.now();
  const pack = packModule(swapped);
  ms.pack = performance.now() - t;
  const computes = (pack as { gl?: { computes?: Record<string, unknown> } }).gl?.computes ?? {};
  return {
    count,
    pack,
    tapeBytes: reverse.tapeBytes ?? 0,
    wgslChars: pack.wgsl.length,
    glComputes: Object.entries(computes)
      .filter(([, v]) => !(v !== null && typeof v === 'object' && 'none' in v))
      .map(([k]) => k),
    source,
    module: swapped,
    ms,
  };
}
