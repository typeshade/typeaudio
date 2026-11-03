// Experiment 7: the forms the method asks for that `grad` refuses at the pin, each as the smallest
// program that shows it, with the sentence `grad` throws. The runner records them in Bun, where the
// compiler's front end loads (docs/compiler-asks.md, Q).

import { compile, grad, type GradOptions } from 'typeshade';

export interface RefusalProbe {
  readonly name: string;
  /** What the probe stands for in the method. */
  readonly why: string;
  readonly source: string;
  readonly fn: string;
  readonly wrt: string | readonly string[];
  readonly options?: GradOptions;
}

export interface RefusalResult {
  readonly name: string;
  readonly why: string;
  readonly mode: 'forward' | 'reverse';
  readonly outcome: 'refused' | 'accepted';
  readonly sentence?: string;
}

const head = '"use typeshade";\n';

/** The probes, each run in the mode its options name. */
export const PROBES: readonly RefusalProbe[] = [
  {
    name: 'buffer',
    why: 'the render kept in an array for an FFT, inside the function grad differentiates',
    source: `${head}export function energy(ratio: f32): f32 {
  let y = array<f32, 64>();
  for (let n: i32 = 0; n < 64; n++) {
    y[n] = sin(ratio * f32(n));
  }
  let s: f32 = 0.;
  for (let n: i32 = 0; n < 64; n++) {
    s += y[n] * y[n];
  }
  return s;
}
`,
    fn: 'energy',
    wrt: 'ratio',
  },
  {
    name: 'entry',
    why: 'the FFT of experiment 3, a @compute entry',
    source: `${head}declare const xs: storage<array<f32>, "read_write">;
export const scale = compute([64], function scale(gid: builtin<"global_invocation_id", vec3u>) {
  xs[gid.x] = xs[gid.x] * 2.;
});
`,
    fn: 'scale',
    wrt: 'gid',
  },
  {
    name: 'array parameter',
    why: 'the envelope levels as one array parameter',
    source: `${head}export function shape(levels: array<f32, 4>): f32 {
  return levels[0] * levels[1] + levels[2] * levels[3];
}
`,
    fn: 'shape',
    wrt: 'levels',
  },
  {
    name: 'struct parameter',
    why: 'the patch as one struct of scalars',
    source: `${head}interface Patch {
  ratio: f32;
  index: f32;
}
export function voice(p: Patch, t: f32): f32 {
  return sin(t + p.index * sin(p.ratio * t));
}
`,
    fn: 'voice',
    wrt: 'p',
  },
  {
    name: 'matrix parameter',
    why: 'sixteen levels as one mat4x4',
    source: `${head}export function shape(m: mat4x4): f32 {
  return m[0][0] * m[1][1] + m[2][2] * m[3][3];
}
`,
    fn: 'shape',
    wrt: 'm',
  },
  {
    name: 'vector parameter',
    why: 'four levels as one vec4, with no direction',
    source: `${head}export function shape(v: vec4): f32 {
  return v.x * v.y + v.z * v.w;
}
`,
    fn: 'shape',
    wrt: 'v',
  },
  {
    name: 'kernel array',
    why: "the frames of a render as a kernel function's array parameter",
    source: `${head}export function total(xs: array<f32>, k: f32): f32 {
  let s: f32 = 0.;
  for (let i: u32 = 0; i < xs.length; i++) {
    s += xs[i] * k;
  }
  return s;
}
`,
    fn: 'total',
    wrt: 'xs',
  },
];

/** Runs every probe in forward mode and in reverse mode. */
export function probeRefusals(): RefusalResult[] {
  const out: RefusalResult[] = [];
  for (const p of PROBES) {
    const compiled = compile(p.source);
    const errors = compiled.diagnostics.filter((d) => d.category === 'error');
    if (errors.length > 0) throw new Error(`refusals.ts: the probe "${p.name}" does not compile: ${errors.map((d) => d.message).join('; ')}`);
    for (const mode of ['forward', 'reverse'] as const) {
      try {
        grad(compiled.module, p.fn, mode === 'reverse' && typeof p.wrt === 'string' ? [p.wrt] : p.wrt, { ...p.options, mode });
        out.push({ name: p.name, why: p.why, mode, outcome: 'accepted' });
      } catch (e) {
        out.push({ name: p.name, why: p.why, mode, outcome: 'refused', sentence: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return out;
}
