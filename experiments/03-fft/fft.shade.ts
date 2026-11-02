"use typeshade";

// Experiment 3 (docs/experiments.md, section 3): a radix-2 FFT as a `@compute` entry with
// barriers, one transform per workgroup. The input is read in bit-reversed order, then each stage
// of butterflies runs between two barriers (decimation in time). Each invocation owns its
// butterflies in a stage, so a stage reads and writes in place; the barrier after it is what lets
// the next stage read what another invocation wrote (surface §25).
//
// - The small transform, 1,024 points, holds its points in workgroup memory: 1,024 `vec2`s are
//   8 KiB, inside WebGPU's default of 16 KiB per workgroup.
// - The large transform, 4,096 points, needs 32 KiB, over that default, so it works in the output
//   array, a storage binding, with `storageBarrier()` between its stages.
//
// Three variants of each, by where the twiddles come from: `Device`, `sin` and `cos` of an `f32`
// angle on the device (variant A); `Table`, a table the host computes in doubles and uploads
// (variant B); `Double`, `sin` and `cos` of an emulated double on the device (surface §39),
// narrowed to `f32` (variant C). The sizes are module constants: the entries read no `.length`
// inside an index, the form the WebGL2 pass program at the pin leaves undeclared
// (docs/compiler-asks.md, J; compiler issue #900). A module constant cannot be an `f64` at the pin
// ("must be f32, i32, u32, or bool for now"), so variant C writes 2π as an `f64` literal.

/** One full turn, in radians. */
const TAU: f32 = 6.283185307179586;
/** The invocations of a workgroup. Each workgroup runs one transform. */
const THREADS: u32 = 256;

/** The points of the small transform. */
const SMALL: u32 = 1024;
/** The stages of the small transform: log2 of its points. */
const SMALL_STAGES: u32 = 10;
/** The angle of one twiddle step of the small transform, in radians: 2π / 1,024. */
const SMALL_STEP: f32 = TAU / 1024.;
/** One twiddle step of the small transform, in turns: 1 / 1,024. */
const SMALL_TURN: f32 = 1. / 1024.;

/** The points of the large transform. */
const LARGE: u32 = 4096;
/** The stages of the large transform: log2 of its points. */
const LARGE_STAGES: u32 = 12;
/** The angle of one twiddle step of the large transform, in radians: 2π / 4,096. */
const LARGE_STEP: f32 = TAU / 4096.;
/** One twiddle step of the large transform, in turns: 1 / 4,096. */
const LARGE_TURN: f32 = 1. / 4096.;

/** The direction of a call and the scale of its output. */
interface Transform {
  /** -1 for the forward transform, +1 for the inverse. */
  sign: f32;
  /** What each output point is multiplied by: 1 for the forward transform, 1 / N for the inverse. */
  scale: f32;
}

declare const transform: uniform<Transform>;
/** The input: one transform of N complex points per workgroup, each point (real, imaginary). */
declare const src: storage<array<vec2>>;
/** The output, in the layout of the input. The large transform works in it. */
declare const dst: storage<array<vec2>, "read_write">;
/**
 * Variant B: the twiddles of the forward transform's size, `(cos(2πt / N), sin(2πt / N))` for
 * `t` below N / 2, computed on the host in doubles and rounded to `f32`.
 */
declare const twiddles: storage<array<vec2>>;

/** The points of one small transform, shared by the invocations of its workgroup. */
let points: workgroup<array<vec2, 1024>>;

/** `i` with its low `bits` bits in reverse order: the place a point of the input takes. */
function reversed(i: u32, bits: u32): u32 {
  let r: u32 = 0;
  let v: u32 = i;
  for (let b: u32 = 0; b < bits; b++) {
    r = (r << 1) | (v & 1);
    v = v >> 1;
  }
  return r;
}

/** The product of two complex numbers. */
function cmul(a: vec2, b: vec2): vec2 {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

/** Variant A: the twiddle `t` steps of `step` radians round the circle, from `cos` and `sin`. */
function onDevice(t: u32, step: f32): vec2 {
  const angle = f32(t) * step;
  return vec2(cos(angle), sin(angle));
}

/**
 * Variant C: the twiddle at `t` times `turn` of a full turn, from `cos` and `sin` of an emulated
 * double, narrowed to `f32`. `t * turn` is exact in `f32`, since `turn` is ±1 / N; the double starts
 * here and ends here, so no `f64` is live across a barrier, which the WebGL2 pass program cannot
 * keep in an invocation's state at the pin ("a f64 cannot be kept in state").
 */
function inDouble(t: u32, turn: f32): vec2 {
  const angle = f64(f32(t) * turn) * f64(6.283185307179586);
  return vec2(f32(cos(angle)), f32(sin(angle)));
}

/** Variant B: the twiddle `t` of the host's table, conjugated by `sign` for the forward transform. */
function fromTable(t: u32, sign: f32): vec2 {
  const w = twiddles[t];
  return vec2(w.x, sign * w.y);
}

/**
 * The butterflies of the small transform, in workgroup memory: stage `s` joins pairs of points
 * `2^(s-1)` apart, and invocation `lid` runs the butterflies `lid` and `lid + 256` of each stage.
 * `twiddle(t)` is `exp(±2πi t / 1024)`.
 */
function smallStages(lid: u32, twiddle: (t: u32) => vec2) {
  for (let s: u32 = 1; s <= SMALL_STAGES; s++) {
    const half = u32(1) << (s - 1);
    for (let j: u32 = 0; j < SMALL / 2 / THREADS; j++) {
      const b = lid + j * THREADS;
      const k = b & (half - 1);
      const top = ((b - k) << 1) + k;
      const bottom = top + half;
      const w = twiddle(k << (SMALL_STAGES - s));
      const u = points[top];
      const v = cmul(points[bottom], w);
      points[top] = u + v;
      points[bottom] = u - v;
    }
    workgroupBarrier();
  }
}

/**
 * The butterflies of the large transform, in the output array from `base`: as `smallStages`, with
 * eight butterflies for each invocation in each stage and a storage barrier between stages.
 */
function largeStages(lid: u32, base: u32, twiddle: (t: u32) => vec2) {
  for (let s: u32 = 1; s <= LARGE_STAGES; s++) {
    const half = u32(1) << (s - 1);
    for (let j: u32 = 0; j < LARGE / 2 / THREADS; j++) {
      const b = lid + j * THREADS;
      const k = b & (half - 1);
      const top = base + ((b - k) << 1) + k;
      const bottom = top + half;
      const w = twiddle(k << (LARGE_STAGES - s));
      const u = dst[top];
      const v = cmul(dst[bottom], w);
      dst[top] = u + v;
      dst[bottom] = u - v;
    }
    storageBarrier();
  }
}

/** Loads one small transform into workgroup memory in bit-reversed order. */
function smallLoad(lid: u32, base: u32) {
  for (let j: u32 = 0; j < SMALL / THREADS; j++) {
    const i = lid + j * THREADS;
    points[reversed(i, SMALL_STAGES)] = src[base + i];
  }
  workgroupBarrier();
}

/** Stores one small transform from workgroup memory, scaled. */
function smallStore(lid: u32, base: u32) {
  for (let j: u32 = 0; j < SMALL / THREADS; j++) {
    const i = lid + j * THREADS;
    dst[base + i] = points[i] * transform.scale;
  }
}

/** Loads one large transform into the output array in bit-reversed order. */
function largeLoad(lid: u32, base: u32) {
  for (let j: u32 = 0; j < LARGE / THREADS; j++) {
    const i = lid + j * THREADS;
    dst[base + reversed(i, LARGE_STAGES)] = src[base + i];
  }
  storageBarrier();
}

/** Scales one large transform in place. Each invocation scales the points it alone touches. */
function largeScale(lid: u32, base: u32) {
  for (let j: u32 = 0; j < LARGE / THREADS; j++) {
    const i = base + lid + j * THREADS;
    dst[i] = dst[i] * transform.scale;
  }
}

/** The 1,024-point transform of each workgroup's points, the twiddles from `sin` and `cos` (variant A). */
export const fftSmallDevice = compute([THREADS], function fftSmallDevice(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * SMALL;
  const step = transform.sign * SMALL_STEP;
  smallLoad(lid.x, base);
  smallStages(lid.x, (t) => onDevice(t, step));
  smallStore(lid.x, base);
});

/** The 1,024-point transform of each workgroup's points, the twiddles from the host's table (variant B). */
export const fftSmallTable = compute([THREADS], function fftSmallTable(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * SMALL;
  const sign = transform.sign;
  smallLoad(lid.x, base);
  smallStages(lid.x, (t) => fromTable(t, sign));
  smallStore(lid.x, base);
});

/** The 1,024-point transform of each workgroup's points, the twiddles from `sin` and `cos` of a double (variant C). */
export const fftSmallDouble = compute([THREADS], function fftSmallDouble(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * SMALL;
  const turn = transform.sign * SMALL_TURN;
  smallLoad(lid.x, base);
  smallStages(lid.x, (t) => inDouble(t, turn));
  smallStore(lid.x, base);
});

/** The 4,096-point transform of each workgroup's points, the twiddles from `sin` and `cos` (variant A). */
export const fftLargeDevice = compute([THREADS], function fftLargeDevice(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * LARGE;
  const step = transform.sign * LARGE_STEP;
  largeLoad(lid.x, base);
  largeStages(lid.x, base, (t) => onDevice(t, step));
  largeScale(lid.x, base);
});

/** The 4,096-point transform of each workgroup's points, the twiddles from the host's table (variant B). */
export const fftLargeTable = compute([THREADS], function fftLargeTable(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * LARGE;
  const sign = transform.sign;
  largeLoad(lid.x, base);
  largeStages(lid.x, base, (t) => fromTable(t, sign));
  largeScale(lid.x, base);
});

/** The 4,096-point transform of each workgroup's points, the twiddles from `sin` and `cos` of a double (variant C). */
export const fftLargeDouble = compute([THREADS], function fftLargeDouble(
  lid: builtin<"local_invocation_id", vec3u>,
  wid: builtin<"workgroup_id", vec3u>,
) {
  const base = wid.x * LARGE;
  const turn = transform.sign * LARGE_TURN;
  largeLoad(lid.x, base);
  largeStages(lid.x, base, (t) => inDouble(t, turn));
  largeScale(lid.x, base);
});
