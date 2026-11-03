// Experiment 7 (docs/experiments.md, section 7): the patch, its loss and the text of the shader
// modules that hold them. It imports no shader module and no compiler, so the runner, Node and the
// page share it.
//
// The patch is a two-operator FM voice over FRAMES frames at RATE:
//
//   y[n] = env(n) · sin(2π c n + index · env(n) · sin(2π ratio c n)),   c = 375 Hz / 48 kHz = 1/128
//
// with a piecewise-linear envelope that is 0 at the first and the last frame and passes through
// B breakpoint levels, equally spaced. Its parameters are the ratio, the index and the B levels,
// so a count of P parameters has B = P - 2 breakpoints: 3, 10, 30 and 100 parameters are 1, 8, 28
// and 98 breakpoints.
//
// The loss is the mean squared distance between log(|X_k|² + 1) of the render and of the target
// over BINS bins of a FRAMES-point DFT: every STRIDE-th bin from bin 0. `grad` cannot carry a
// derivative through an array or an entry (compiler `SD0118`), so the render cannot be kept for
// an FFT: the loss renders each frame and feeds it to one Goertzel recurrence per bin, in the same
// loop (docs/records/07-sound-match-container.md, "What departs from the method").

/** The frames of one render. */
export const FRAMES = 1024;
/** The sample rate, Hz. */
export const RATE = 48000;
/** The carrier's cycles per frame: 375 Hz at 48 kHz, bin 8 of the transform. Exact in `f32`. */
export const CARRIER_STEP = 1 / 128;
/** The bins of the loss. */
export const BINS = 16;
/** The spacing of the bins of the loss: bins 0, 4, 8, …, 60, from 0 to 2,812.5 Hz. */
export const STRIDE = 4;
/** What each bin's power is offset by before its logarithm. */
export const EPS = 1;
/** The parameter counts the experiment measures. */
export const COUNTS = [3, 10, 30, 100] as const;
export type Count = (typeof COUNTS)[number];

/** The entries the runner appends for the GPU tiers (`program.ts`), by what each computes. */
export const ENTRY = {
  render: 'renderEntry',
  frames: 'framesEntry',
  loss: 'lossEntry',
  forward: 'forwardStep',
  reverse: 'reverseStep',
} as const;

/** The invocations of a workgroup of `forwardStep` (one for each parameter) and of `framesEntry` (one for each frame). */
export const FORWARD_LANES = 64;

/** The bins of the loss, by index into the FRAMES-point transform. */
export const LOSS_BINS: readonly number[] = Array.from({ length: BINS }, (_, i) => i * STRIDE);

/** The breakpoints of the envelope for a parameter count. */
export const breakpointsOf = (count: number): number => count - 2;

/** The names of the parameters, in the order every function takes them. */
export function namesOf(count: number): string[] {
  return ['ratio', 'index', ...Array.from({ length: breakpointsOf(count) }, (_, i) => `l${i + 1}`)];
}

/**
 * The known answer: ratio 2, index 1, and breakpoint levels on a line from 1.05 at the start to
 * 0.55 at the end of the render. One breakpoint (3 parameters) sits at the middle, at 0.8.
 */
export function truthOf(count: number): number[] {
  const b = breakpointsOf(count);
  return [2, 1, ...Array.from({ length: b }, (_, i) => 0.8 - 0.5 * ((i + 1) / (b + 1) - 0.5))];
}

/** Where the descent starts: the ratio 2 % high, the index at 0.7, every level at 60 % of its answer. */
export function startOf(count: number): number[] {
  const t = truthOf(count);
  return [2.04, 0.7, ...t.slice(2).map((l) => 0.6 * l)];
}

/** An `f32` value as a literal the front end reads back to the same `f32`. */
function literal(x: number): string {
  const text = String(Math.fround(x));
  return /[.e]/.test(text) ? text : `${text}.`;
}

/** The module of the patch with `count` parameters, as `run.ts --write` writes it. */
export function patchSource(count: number): string {
  const b = breakpointsOf(count);
  const groups = BINS / 4;
  const levels = Array.from({ length: b }, (_, i) => `l${i + 1}`);
  const levelParams = levels.map((l) => `${l}: f32`).join(', ');
  const levelArgs = levels.join(', ');
  const params = `ratio: f32, index: f32, ${levelParams}`;
  const targets = Array.from({ length: groups }, (_, g) => `target${g}: vec4`).join(', ');
  const targetArgs = Array.from({ length: groups }, (_, g) => `target${g}`).join(', ');
  const coefficients = LOSS_BINS.map(
    (k, i) => `/** Bin ${k}: 2 cos(2π · ${k} / ${FRAMES}). */\nconst C${i}: f32 = ${literal(2 * Math.cos((2 * Math.PI * k) / FRAMES))};`,
  ).join('\n');
  const cases = levels.map((l, i) => `    case ${i + 1}:\n      return ${l};`).join('\n');
  const states = LOSS_BINS.map((_, i) => `  let a${i}: f32 = 0.;\n  let b${i}: f32 = 0.;`).join('\n');
  const goertzel = LOSS_BINS.map(
    (_, i) => `      const s${i} = y + C${i} * a${i} - b${i};\n      b${i} = a${i};\n      a${i} = s${i};`,
  ).join('\n');
  const power = (i: number): string => `log(a${i} * a${i} + b${i} * b${i} - C${i} * a${i} * b${i} + EPS)`;
  const group = (g: number): string => `vec4(\n    ${[0, 1, 2, 3].map((c) => power(4 * g + c)).join(',\n    ')},\n  )`;
  const frames = (body: string): string => `  for (let j: i32 = 0; j < SEGMENTS; j++) {
    const lo = level(j, ${levelArgs});
    const hi = level(j + 1, ${levelArgs});
    const first = (j * FRAMES) / SEGMENTS;
    const last = ((j + 1) * FRAMES) / SEGMENTS;
    const span = f32(last - first);
    for (let n: i32 = first; n < last; n++) {
      const env = mix(lo, hi, f32(n - first) / span);
      const y = voice(n, env, ratio, index);
${body}
    }
  }`;
  const along = namesOf(count)
    .map((name) => `${name} + t * d${name}`)
    .join(', ');
  const directions = namesOf(count)
    .map((name) => `d${name}: f32`)
    .join(', ');
  return `"use typeshade";

// Experiment 7 (docs/experiments.md, section 7): the two-operator FM patch with ${count} parameters, its
// render and its spectral loss. Generated by experiments/07-sound-match/patch.ts; do not edit.
// \`bun run exp:07 --write\` writes it again.

/** The frames of one render: 1,024 frames at 48 kHz. */
const FRAMES: i32 = ${FRAMES};
/** The segments of the envelope: its ${b} breakpoint${b === 1 ? '' : 's'} and one more. */
const SEGMENTS: i32 = ${b + 1};
/** The carrier's cycles per frame: 375 Hz at 48 kHz, which is 1/128 and exact. */
const STEP: f32 = ${literal(CARRIER_STEP)};
/** One full turn, in radians. */
const TAU: f32 = 6.283185307179586;
/** What each bin's power is offset by before its logarithm. */
const EPS: f32 = ${literal(EPS)};

${coefficients}

/** The level of breakpoint \`j\`: 0 at both ends of the render, the parameter between them. */
function level(j: i32, ${levelParams}): f32 {
  switch (j) {
${cases}
    default:
      return 0.;
  }
}

/** The sine of a phase in cycles, reduced to [-π, π) first. */
function turn(cycles: f32): f32 {
  return sin(TAU * (fract(cycles + 0.5) - 0.5));
}

/** Frame \`n\` of the voice under the envelope's value \`env\`. */
function voice(n: i32, env: f32, ratio: f32, index: f32): f32 {
  const c = f32(n) * STEP;
  return env * turn(c + (index * env * turn(ratio * c)) / TAU);
}

/** The render: every frame of the voice. */
export function render(${params}): array<f32, ${FRAMES}> {
  let out = array<f32, ${FRAMES}>();
${frames('      out[n] = y;')}
  return out;
}

/**
 * The analysis the loss holds a render to: log(|X_k|² + 1) of bins ${LOSS_BINS.join(', ')} of the render's
 * ${FRAMES}-point DFT, four bins to a vector, each from a Goertzel recurrence.
 */
export function logPower(${params}): array<vec4, ${groups}> {
${states}
${frames(goertzel)}
  let out = array<vec4, ${groups}>();
${Array.from({ length: groups }, (_, g) => `  out[${g}] = ${group(g)};`).join('\n')}
  return out;
}

/**
 * The loss: the mean squared distance between \`logPower\` of the render and the target's, over the
 * ${BINS} bins. It renders each frame and feeds it to the bins' recurrences in the same loop, since
 * \`grad\` carries no derivative through an array.
 */
export function loss(${params}, ${targets}): f32 {
${states}
${frames(goertzel)}
  let sum: f32 = 0.;
${Array.from({ length: groups }, (_, g) => `  const d${g} = ${group(g)} - target${g};\n  sum += dot(d${g}, d${g});`).join('\n')}
  return sum / ${literal(BINS)};
}

/**
 * The loss at the parameters moved by \`t\` along the direction \`d…\`. Its forward-mode derivative in
 * \`t\` at 0 is the derivative of \`loss\` along the direction, with the direction an argument.
 */
export function lossAlong(t: f32, ${params}, ${directions}, ${targets}): f32 {
  return loss(${along}, ${targetArgs});
}
`;
}
