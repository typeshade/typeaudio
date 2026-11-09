// The plain-JavaScript reference of the spatial kernels: the same formulas as
// `src/spatial/*.shade.ts`, each operation rounded to an `f32` with `Math.fround` (compiler Rule
// 11.7). It reads a lane's numbers from the host object that built the lane, and keeps its own state.

const f = Math.fround;
export const BLOCK = 1024;
export const HIST = 4096;
export const WIDTH = 5120;

export interface LaneFields {
  layer: number;
  g: number;
  kAir: number;
  panL: number;
  panR: number;
  send: number;
  itd: number;
  farLeft: number;
  kFar: number;
  d0: number;
  r0: number;
  d1: number;
  r1: number;
  d2: number;
  r2: number;
  d3: number;
  r3: number;
  d4: number;
  r4: number;
  d5: number;
  r5: number;
}

/** `history`: one block on. */
export function refHistory(prev: Float32Array, fresh: Float32Array, lanes: number): Float32Array {
  const next = new Float32Array(lanes * WIDTH);
  for (let i = 0; i < next.length; i++) {
    const v = Math.floor(i / WIDTH);
    const k = i % WIDTH;
    next[i] = k < HIST ? prev[v * WIDTH + k + BLOCK]! : fresh[v * BLOCK + k - HIST]!;
  }
  return next;
}

/** The state of `place` for one lane. */
export class RefPlace {
  zAir = 0;
  zFar = 0;
  constructor(readonly lane: LaneFields) {}
}

/** `place` for every lane over one block: the outputs are rows of `BLOCK` frames per lane. */
export function refPlace(
  states: RefPlace[],
  hist: Float32Array,
  binaural: number,
): { l: Float32Array; r: Float32Array; send: Float32Array } {
  const n = states.length * BLOCK;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  const send = new Float32Array(n);
  states.forEach((s, v) => {
    const a = s.lane;
    const base = v * WIDTH + HIST;
    for (let i = 0; i < BLOCK; i++) {
      const x = hist[base + i]!;
      s.zAir = f(s.zAir + f(f(a.kAir) * f(f(x * f(a.g)) - s.zAir)));
      const near = s.zAir;
      let left = f(near * f(a.panL));
      let right = f(near * f(a.panR));
      if (binaural === 1) {
        s.zFar = f(s.zFar + f(f(a.kFar) * f(f(hist[base + i - a.itd]! * f(a.g)) - s.zFar)));
        if (a.farLeft === 1) left = f(s.zFar * f(a.panL));
        else right = f(s.zFar * f(a.panR));
      }
      const tap = (d: number, g: number): number => f(hist[base + i - d]! * f(g));
      const early0 = f(f(tap(a.d0, a.r0) + tap(a.d2, a.r2)) + tap(a.d4, a.r4));
      const early1 = f(f(tap(a.d1, a.r1) + tap(a.d3, a.r3)) + tap(a.d5, a.r5));
      const g = f(a.g);
      l[v * BLOCK + i] = f(left + f(g * f(f(early0 * f(0.8)) + f(early1 * f(0.45)))));
      r[v * BLOCK + i] = f(right + f(g * f(f(early0 * f(0.45)) + f(early1 * f(0.8)))));
      send[v * BLOCK + i] = f(x * f(a.send));
    }
  });
  return { l, r, send };
}

/** `layers`: the sum of each layer's lanes, in lane order. */
export function refLayers(lanes: LaneFields[], input: Float32Array): Float32Array {
  const out = new Float32Array(5 * BLOCK);
  for (let i = 0; i < out.length; i++) {
    const l = Math.floor(i / BLOCK);
    const n = i % BLOCK;
    let s = 0;
    lanes.forEach((lane, v) => {
      if (lane.layer === l) s = f(s + input[v * BLOCK + n]!);
    });
    out[i] = s;
  }
  return out;
}

export class RefShelf {
  z = 0;
  constructor(
    public k: number,
    public lo: number,
    public hi: number,
  ) {
    this.k = f(k);
    this.lo = f(lo);
    this.hi = f(hi);
  }
  tick(x: number): number {
    this.z = f(this.z + f(this.k * f(x - this.z)));
    return f(f(this.lo * this.z) + f(this.hi * f(x - this.z)));
  }
}

export class RefStrip {
  env = 0;
  left: RefShelf;
  right: RefShelf;
  sendBus: RefShelf;
  constructor(
    readonly atk: number,
    readonly rel: number,
    readonly depth: number,
    readonly thr: number,
    shelf: { k: number; lo: number; hi: number },
  ) {
    this.atk = f(atk);
    this.rel = f(rel);
    this.depth = f(depth);
    this.thr = f(thr);
    this.left = new RefShelf(shelf.k, shelf.lo, shelf.hi);
    this.right = new RefShelf(shelf.k, shelf.lo, shelf.hi);
    this.sendBus = new RefShelf(shelf.k, shelf.lo, shelf.hi);
  }
  duck(sc: number): number {
    const a = Math.abs(sc);
    const c = a > this.env ? this.atk : this.rel;
    this.env = f(this.env + f(c * f(a - this.env)));
    return f(1 + f(f(this.depth - 1) * Math.min(f(this.env / this.thr), 1)));
  }
}

/** `strips` for every layer over one block. */
export function refStrips(
  bank: RefStrip[],
  inL: Float32Array,
  inR: Float32Array,
  inS: Float32Array,
): { l: Float32Array; r: Float32Array; s: Float32Array } {
  const l = new Float32Array(bank.length * BLOCK);
  const r = new Float32Array(bank.length * BLOCK);
  const s = new Float32Array(bank.length * BLOCK);
  bank.forEach((strip, k) => {
    for (let n = 0; n < BLOCK; n++) {
      const g = strip.duck(f(Math.abs(inL[n]!) + Math.abs(inR[n]!)));
      const i = k * BLOCK + n;
      l[i] = f(strip.left.tick(inL[i]!) * g);
      r[i] = f(strip.right.tick(inR[i]!) * g);
      s[i] = f(strip.sendBus.tick(inS[i]!) * g);
    }
  });
  return { l, r, s };
}

/** `sendSum`. */
export function refSendSum(inS: Float32Array): Float32Array {
  const out = new Float32Array(BLOCK);
  for (let n = 0; n < BLOCK; n++) {
    let s = 0;
    for (let l = 0; l < 5; l++) s = f(s + inS[l * BLOCK + n]!);
    out[n] = s;
  }
  return out;
}

/** `fftStage` over interleaved complex points, `points` = 2,048 per transform. */
export function refFftStage(
  inp: Float32Array,
  tw: Float32Array,
  stride: number,
  half: number,
  sign: number,
  scale: number,
): Float32Array {
  const POINTS = 2048;
  const out = new Float32Array(inp.length);
  const count = inp.length / 2;
  for (let i = 0; i < count; i++) {
    const base = Math.floor(i / POINTS) * POINTS;
    const j = i % POINTS;
    const q = j % stride;
    const k = Math.floor(j / stride);
    const p = k >> 1;
    const ia = base + q + stride * p;
    const ib = base + q + stride * (p + half);
    const ax = inp[2 * ia]!;
    const ay = inp[2 * ia + 1]!;
    const bx = inp[2 * ib]!;
    const by = inp[2 * ib + 1]!;
    const s = f(scale);
    if ((k & 1) === 0) {
      out[2 * i] = f(f(ax + bx) * s);
      out[2 * i + 1] = f(f(ay + by) * s);
    } else {
      const dx = f(ax - bx);
      const dy = f(ay - by);
      const wx = tw[2 * (p * stride)]!;
      const wy = f(f(sign) * tw[2 * (p * stride) + 1]!);
      out[2 * i] = f(f(f(dx * wx) - f(dy * wy)) * s);
      out[2 * i + 1] = f(f(f(dx * wy) + f(dy * wx)) * s);
    }
  }
  return out;
}

/** `accumulate2`. */
export function refAccumulate2(
  line: Float32Array,
  spectra: Float32Array,
  head: number,
  partitions: number,
  lanes: number,
): Float32Array {
  const POINTS = 2048;
  const out = new Float32Array(lanes * 2);
  for (let i = 0; i < lanes; i++) {
    const c = Math.floor(i / POINTS);
    const j = i % POINTS;
    let ax = 0;
    let ay = 0;
    for (let p = 0; p < partitions; p++) {
      const slot = (head + partitions - p) % partitions;
      const a = (slot * POINTS + j) * 2;
      const b = ((c * partitions + p) * POINTS + j) * 2;
      const x = f(f(line[a]! * spectra[b]!) - f(line[a + 1]! * spectra[b + 1]!));
      const y = f(f(line[a]! * spectra[b + 1]!) + f(line[a + 1]! * spectra[b]!));
      ax = f(ax + x);
      ay = f(ay + y);
    }
    out[2 * i] = ax;
    out[2 * i + 1] = ay;
  }
  return out;
}
